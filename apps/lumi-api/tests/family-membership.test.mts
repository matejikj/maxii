import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AppUserId, FamilyId, MembershipId } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';

async function boot() {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  return createFamilyApi(config);
}

async function createFamilyWithAdmin(
  app: Awaited<ReturnType<typeof createFamilyApi>>['app'],
  tokens: Awaited<ReturnType<typeof createFamilyApi>>['tokens'],
) {
  const adminId = randomUUID() as AppUserId;
  const token = await tokens.mintTestToken({ subject: 'admin', appUserId: adminId });
  const created = await app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'family-once',
      displayName: 'Matejikovi',
    },
  });
  assert.equal(created.statusCode, 201);
  return {
    adminId,
    token,
    familyId: created.json().familyId as FamilyId,
    membershipId: created.json().membershipId as MembershipId,
  };
}

test('founding parent keeps admin membership and idempotent create does not fork families', async () => {
  const { app, tokens } = await boot();
  const first = await createFamilyWithAdmin(app, tokens);
  const again = await app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${first.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'family-once',
      displayName: 'Matejikovi',
    },
  });
  assert.equal(again.statusCode, 200);
  assert.equal(again.json().created, false);
  assert.equal(again.json().familyId, first.familyId);

  const members = await app.inject({
    method: 'GET',
    url: `/v1/families/${first.familyId}/members`,
    headers: { authorization: `Bearer ${first.token}` },
  });
  assert.equal(members.statusCode, 200);
  assert.equal(members.json().members.length, 1);
  assert.equal(members.json().members[0].role, 'admin');
  await app.close();
});

test('invitation accept is idempotent, never escalates role, and respects expiry/revoke', async () => {
  const { app, tokens } = await boot();
  const family = await createFamilyWithAdmin(app, tokens);

  const invite = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/invitations`,
    headers: { authorization: `Bearer ${family.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'invite-1',
      role: 'caregiver',
      ttlSeconds: 3600,
    },
  });
  assert.equal(invite.statusCode, 201);
  const oneTimeToken = invite.json().oneTimeToken as string;
  assert.ok(oneTimeToken.length > 20);

  const caregiverId = randomUUID() as AppUserId;
  const caregiverToken = await tokens.mintTestToken({
    subject: 'caregiver',
    appUserId: caregiverId,
  });

  const preview = await app.inject({
    method: 'POST',
    url: '/v1/invitations/preview',
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: { oneTimeToken },
  });
  assert.equal(preview.statusCode, 200);
  assert.equal(preview.json().familyDisplayName, 'Matejikovi');
  assert.equal(preview.json().invitedRole, 'caregiver');

  const acceptPayload = {
    protocolVersion: LUMI_API_PROTOCOL_VERSION,
    idempotencyKey: 'join-1',
    oneTimeToken,
    childLinkDecision: 'defer',
    localChildId: 'local-child',
    localChildDisplayName: 'Míša',
  };
  const accepted = await app.inject({
    method: 'POST',
    url: '/v1/invitations/accept',
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: acceptPayload,
  });
  assert.equal(accepted.statusCode, 201);
  assert.equal(accepted.json().role, 'caregiver');
  assert.equal(accepted.json().mergeDeferred, true);

  const acceptedAgain = await app.inject({
    method: 'POST',
    url: '/v1/invitations/accept',
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: acceptPayload,
  });
  assert.equal(acceptedAgain.statusCode, 200);
  assert.equal(acceptedAgain.json().created, false);
  assert.equal(acceptedAgain.json().role, 'caregiver');

  const caregiverInvite = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/invitations`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'caregiver-invite',
      role: 'caregiver',
    },
  });
  assert.equal(caregiverInvite.statusCode, 403);

  const secondInvite = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/invitations`,
    headers: { authorization: `Bearer ${family.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'invite-2',
      role: 'caregiver',
      ttlSeconds: 3600,
    },
  });
  const secondToken = secondInvite.json().oneTimeToken as string;
  const revoked = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/invitations/${secondInvite.json().invitationId}/revoke`,
    headers: { authorization: `Bearer ${family.token}` },
  });
  assert.equal(revoked.statusCode, 200);
  const strangerId = randomUUID() as AppUserId;
  const strangerToken = await tokens.mintTestToken({ subject: 'stranger', appUserId: strangerId });
  const revokedAccept = await app.inject({
    method: 'POST',
    url: '/v1/invitations/accept',
    headers: { authorization: `Bearer ${strangerToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'join-revoked',
      oneTimeToken: secondToken,
      childLinkDecision: 'different_child',
    },
  });
  assert.equal(revokedAccept.statusCode, 403);
  assert.equal(revokedAccept.json().error.details.reason, 'invitation_revoked');
  await app.close();
});

test('caregiver cannot erase family or revoke members; revoke blocks further access', async () => {
  const { app, tokens } = await boot();
  const family = await createFamilyWithAdmin(app, tokens);
  const invite = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/invitations`,
    headers: { authorization: `Bearer ${family.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'invite-care',
      role: 'caregiver',
    },
  });
  const caregiverId = randomUUID() as AppUserId;
  const caregiverToken = await tokens.mintTestToken({
    subject: 'care-2',
    appUserId: caregiverId,
  });
  const accepted = await app.inject({
    method: 'POST',
    url: '/v1/invitations/accept',
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'join-care',
      oneTimeToken: invite.json().oneTimeToken,
      childLinkDecision: 'same_child',
      localChildId: 'c1',
    },
  });
  const caregiverMembershipId = accepted.json().membershipId as MembershipId;

  const eraseDenied = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/erasure`,
    headers: { authorization: `Bearer ${caregiverToken}` },
  });
  assert.equal(eraseDenied.statusCode, 403);

  const lastAdminDenied = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/members/${family.membershipId}/revoke`,
    headers: { authorization: `Bearer ${family.token}` },
  });
  assert.equal(lastAdminDenied.statusCode, 409);
  assert.equal(lastAdminDenied.json().error.details.reason, 'last_admin');

  const revoked = await app.inject({
    method: 'POST',
    url: `/v1/families/${family.familyId}/members/${caregiverMembershipId}/revoke`,
    headers: { authorization: `Bearer ${family.token}` },
  });
  assert.equal(revoked.statusCode, 200);

  const membersAfter = await app.inject({
    method: 'GET',
    url: `/v1/families/${family.familyId}/members`,
    headers: { authorization: `Bearer ${caregiverToken}` },
  });
  assert.equal(membersAfter.statusCode, 403);
  await app.close();
});

test('second verified issuer links to the same account; foreign e-mail collision is refused', async () => {
  const { app, tokens, store } = await boot();
  const userA = randomUUID() as AppUserId;
  const userB = randomUUID() as AppUserId;
  const tokenA = await tokens.mintTestToken({ subject: 'a', appUserId: userA });
  store.ensureUser(userA, new Date().toISOString());
  store.bindExternal({
    appUserId: userA,
    issuer: 'https://idp.example/a',
    subject: 'sub-a',
    now: new Date().toISOString(),
  });
  store.ensureUser(userB, new Date().toISOString());
  store.bindExternal({
    appUserId: userB,
    issuer: 'https://idp.example/b',
    subject: 'sub-b',
    now: new Date().toISOString(),
  });

  const linked = await app.inject({
    method: 'POST',
    url: '/v1/me/identities/link',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      issuer: 'https://idp.example/future',
      subject: 'sub-a-future',
    },
  });
  assert.equal(linked.statusCode, 200);
  assert.equal(linked.json().linked, true);

  const stolen = await app.inject({
    method: 'POST',
    url: '/v1/me/identities/link',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      issuer: 'https://idp.example/b',
      subject: 'sub-b',
    },
  });
  assert.equal(stolen.statusCode, 409);
  assert.equal(stolen.json().error.details.reason, 'external_identity_owned_elsewhere');
  await app.close();
});
