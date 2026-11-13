import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AppUserId, FamilyId } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { createSoakDevice, runFamilySyncSoak } from '../src/sync/familySyncSoak.ts';

async function bootFamilyWithThreeDevices() {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  const api = await createFamilyApi(config);
  const adminId = randomUUID() as AppUserId;
  const caregiverId = randomUUID() as AppUserId;
  const replicaId = randomUUID() as AppUserId;
  const adminToken = await api.tokens.mintTestToken({ subject: 'admin', appUserId: adminId });
  const caregiverToken = await api.tokens.mintTestToken({
    subject: 'care',
    appUserId: caregiverId,
  });
  const replicaToken = await api.tokens.mintTestToken({
    subject: 'replica',
    appUserId: replicaId,
  });

  const created = await api.app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'soak-family',
      displayName: 'Soak Family',
    },
  });
  assert.equal(created.statusCode, 201);
  const familyId = created.json().familyId as FamilyId;

  async function inviteAndAccept(token: string, idempotencyKey: string): Promise<string> {
    const invite = await api.app.inject({
      method: 'POST',
      url: `/v1/families/${familyId}/invitations`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `invite-${idempotencyKey}`,
        role: 'caregiver',
      },
    });
    assert.equal(invite.statusCode, 201);
    const accepted = await api.app.inject({
      method: 'POST',
      url: '/v1/invitations/accept',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        idempotencyKey: `join-${idempotencyKey}`,
        oneTimeToken: invite.json().oneTimeToken,
        childLinkDecision: 'defer',
      },
    });
    assert.ok(accepted.statusCode === 201 || accepted.statusCode === 200);
    return accepted.json().membershipId as string;
  }

  const caregiverMembershipId = await inviteAndAccept(caregiverToken, 'care');
  await inviteAndAccept(replicaToken, 'replica');

  return {
    api,
    familyId,
    caregiverMembershipId,
    admin: createSoakDevice({
      label: 'admin-phone',
      appUserId: adminId,
      deviceId: 'device-admin',
      token: adminToken,
    }),
    caregiver: createSoakDevice({
      label: 'caregiver-phone',
      appUserId: caregiverId,
      deviceId: 'device-care',
      token: caregiverToken,
    }),
    replica: createSoakDevice({
      label: 'long-disconnected-replica',
      appUserId: replicaId,
      deviceId: 'device-replica',
      token: replicaToken,
    }),
  };
}

test('software sync soak converges with explainable conflicts and refuses physical-phone claims', async () => {
  const ctx = await bootFamilyWithThreeDevices();
  try {
    const report = await runFamilySyncSoak({
      app: ctx.api.app,
      familyId: ctx.familyId,
      admin: ctx.admin,
      caregiver: ctx.caregiver,
      replica: ctx.replica,
      caregiverMembershipId: ctx.caregiverMembershipId,
      rotateEpoch: () => {
        ctx.api.sync.rotateEpochKeepReceipts(ctx.familyId);
      },
      materializeTombstone: (entityId, revisionId) => {
        ctx.api.sync.materializeTombstone(
          ctx.familyId,
          entityId,
          revisionId,
          new Date().toISOString(),
        );
      },
      revokeMembership: async (membershipId) => {
        const revoked = await ctx.api.app.inject({
          method: 'POST',
          url: `/v1/families/${ctx.familyId}/members/${membershipId}/revoke`,
          headers: { authorization: `Bearer ${ctx.admin.token}` },
        });
        assert.equal(revoked.statusCode, 200);
      },
      rounds: 5,
    });

    assert.equal(report.format, 'lumi.family-sync-soak.v1');
    assert.equal(report.physicalPhonesClaimed, false);
    assert.equal(report.devices.length, 3);
    assert.ok(report.acceptedCount >= 5);
    assert.ok(report.conflictCount >= 1);
    assert.equal(report.revokedPushDenied, true);
    assert.equal(report.staleCursorResyncRequired, true);
    assert.equal(report.tombstoneRejectedStaleCreate, true);
    assert.equal(report.convergedOrExplainable, true);
    assert.ok(report.findings.includes('physical_two_phone_proof_not_claimed'));
    assert.ok(report.findings.includes('explainable_conflict_heads_retained'));
  } finally {
    await ctx.api.app.close();
  }
});

test('family sync soak report never claims other offline phones already received changes', async () => {
  const ctx = await bootFamilyWithThreeDevices();
  try {
    const report = await runFamilySyncSoak({
      app: ctx.api.app,
      familyId: ctx.familyId,
      admin: ctx.admin,
      caregiver: ctx.caregiver,
      replica: ctx.replica,
      caregiverMembershipId: ctx.caregiverMembershipId,
      rotateEpoch: () => ctx.api.sync.rotateEpochKeepReceipts(ctx.familyId),
      materializeTombstone: (entityId, revisionId) => {
        ctx.api.sync.materializeTombstone(
          ctx.familyId,
          entityId,
          revisionId,
          new Date().toISOString(),
        );
      },
      revokeMembership: async (membershipId) => {
        await ctx.api.app.inject({
          method: 'POST',
          url: `/v1/families/${ctx.familyId}/members/${membershipId}/revoke`,
          headers: { authorization: `Bearer ${ctx.admin.token}` },
        });
      },
      rounds: 3,
    });
    assert.equal(report.physicalPhonesClaimed, false);
    assert.equal(JSON.stringify(report).toLowerCase().includes('already synced to offline'), false);
  } finally {
    await ctx.api.app.close();
  }
});
