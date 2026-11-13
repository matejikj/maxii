import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AppUserId, FamilyId, SyncOperation } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { hashSyncPayload } from '../src/sync/syncStore.ts';

async function boot() {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  return createFamilyApi(config);
}

function op(
  input: Partial<SyncOperation> & Pick<SyncOperation, 'operationId' | 'actorAppUserId'>,
): SyncOperation {
  const payload = input.payload ?? { note: 'hello' };
  return {
    schemaVersion: LUMI_API_PROTOCOL_VERSION,
    operationId: input.operationId,
    deviceId: input.deviceId ?? 'device-1',
    actorAppUserId: input.actorAppUserId,
    kind: input.kind ?? 'care.record',
    entityId: input.entityId ?? randomUUID(),
    revisionId: input.revisionId ?? randomUUID(),
    parentRevisionIds: input.parentRevisionIds ?? [],
    payloadHash: input.payloadHash ?? hashSyncPayload(payload),
    payload,
  };
}

async function familyWithAdmin() {
  const api = await boot();
  const adminId = randomUUID() as AppUserId;
  const token = await api.tokens.mintTestToken({ subject: 'admin', appUserId: adminId });
  const created = await api.app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'sync-family',
      displayName: 'Sync Family',
    },
  });
  assert.equal(created.statusCode, 201);
  return {
    ...api,
    adminId,
    token,
    familyId: created.json().familyId as FamilyId,
  };
}

test('duplicate push with same hash returns original receipt; mismatched body is rejected', async () => {
  const ctx = await familyWithAdmin();
  const operation = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
  });
  const first = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [operation],
    },
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().receipts[0].status, 'accepted');

  const lostAckRetry = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [operation],
    },
  });
  assert.equal(lostAckRetry.json().receipts[0].status, 'duplicate');
  assert.equal(lostAckRetry.json().receipts[0].changelogSeq, first.json().receipts[0].changelogSeq);

  const mismatch = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        {
          ...operation,
          payload: { note: 'tampered' },
          payloadHash: hashSyncPayload({ note: 'tampered' }),
        },
      ],
    },
  });
  assert.equal(mismatch.json().receipts[0].status, 'rejected');
  assert.equal(mismatch.json().receipts[0].reason, 'hash_mismatch');
  await ctx.app.close();
});

test('commit-safe changelog keeps slow first accept ahead of a later fast accept', async () => {
  const ctx = await familyWithAdmin();
  ctx.sync.slowCommitMs = 40;
  const firstOp = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
    payload: { order: 1 },
  });
  const secondOp = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
    payload: { order: 2 },
  });

  const slow = ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [firstOp],
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  ctx.sync.slowCommitMs = 0;
  const fast = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [secondOp],
    },
  });
  const slowResult = await slow;
  assert.equal(slowResult.statusCode, 200);
  assert.equal(fast.statusCode, 200);
  const seq1 = slowResult.json().receipts[0].changelogSeq as number;
  const seq2 = fast.json().receipts[0].changelogSeq as number;
  assert.ok(seq1 < seq2);

  const pull = await ctx.app.inject({
    method: 'GET',
    url: `/v1/families/${ctx.familyId}/sync/pull?limit=10`,
    headers: { authorization: `Bearer ${ctx.token}` },
  });
  assert.equal(pull.statusCode, 200);
  const ids = pull.json().entries.map((item: { operationId: string }) => item.operationId);
  assert.deepEqual(ids, [firstOp.operationId, secondOp.operationId]);
  await ctx.app.close();
});

test('revoked membership cannot push and invalid cursor demands resync without wiping server receipts', async () => {
  const ctx = await familyWithAdmin();
  const invite = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/invitations`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'sync-invite',
      role: 'caregiver',
    },
  });
  const caregiverId = randomUUID() as AppUserId;
  const caregiverToken = await ctx.tokens.mintTestToken({
    subject: 'care',
    appUserId: caregiverId,
  });
  const accepted = await ctx.app.inject({
    method: 'POST',
    url: '/v1/invitations/accept',
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'join',
      oneTimeToken: invite.json().oneTimeToken,
      childLinkDecision: 'defer',
    },
  });
  const membershipId = accepted.json().membershipId;

  const pushed = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        op({
          operationId: randomUUID(),
          actorAppUserId: caregiverId,
        }),
      ],
    },
  });
  assert.equal(pushed.statusCode, 200);

  await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/members/${membershipId}/revoke`,
    headers: { authorization: `Bearer ${ctx.token}` },
  });
  const denied = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${caregiverToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        op({
          operationId: randomUUID(),
          actorAppUserId: caregiverId,
        }),
      ],
    },
  });
  assert.equal(denied.statusCode, 403);

  ctx.sync.rotateEpochKeepReceipts(ctx.familyId);
  const staleCursor = Buffer.from(JSON.stringify({ epoch: 1, seq: 0 }), 'utf8').toString(
    'base64url',
  );
  const resync = await ctx.app.inject({
    method: 'GET',
    url: `/v1/families/${ctx.familyId}/sync/pull?cursor=${staleCursor}`,
    headers: { authorization: `Bearer ${ctx.token}` },
  });
  assert.equal(resync.statusCode, 409);
  assert.equal(resync.json().error.code, 'resync_required');
  assert.equal(resync.json().sync.resyncRequired, true);
  assert.ok(ctx.sync.byOperation.size >= 1);
  await ctx.app.close();
});
