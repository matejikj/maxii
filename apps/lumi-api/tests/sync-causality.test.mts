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

function op(input: Partial<SyncOperation> & Pick<SyncOperation, 'operationId' | 'actorAppUserId' | 'entityId' | 'revisionId'>): SyncOperation {
  const payload = input.payload ?? { revisionKind: 'create', note: 'n' };
  return {
    schemaVersion: LUMI_API_PROTOCOL_VERSION,
    operationId: input.operationId,
    deviceId: input.deviceId ?? 'device-1',
    actorAppUserId: input.actorAppUserId,
    kind: input.kind ?? 'care.record',
    entityId: input.entityId,
    revisionId: input.revisionId,
    parentRevisionIds: input.parentRevisionIds ?? [],
    payloadHash: input.payloadHash ?? hashSyncPayload(payload),
    payload,
  };
}

async function family() {
  const api = await boot();
  const adminId = randomUUID() as AppUserId;
  const token = await api.tokens.mintTestToken({ subject: 'admin', appUserId: adminId });
  const created = await api.app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'causal-family',
      displayName: 'Causal',
    },
  });
  return {
    ...api,
    adminId,
    token,
    familyId: created.json().familyId as FamilyId,
  };
}

test('branching updates return accepted_with_conflict and keep both heads', async () => {
  const ctx = await family();
  const entityId = randomUUID();
  const root = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
    entityId,
    revisionId: 'rev-root',
    payload: { revisionKind: 'create', text: 'base' },
  });
  await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [root],
    },
  });

  const branchA = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
    entityId,
    revisionId: 'rev-a',
    parentRevisionIds: ['rev-root'],
    kind: 'care.update',
    payload: { revisionKind: 'update', text: 'A', createdAtHint: '2026-10-01' },
  });
  const branchB = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
    entityId,
    revisionId: 'rev-b',
    parentRevisionIds: ['rev-root'],
    kind: 'care.update',
    payload: { revisionKind: 'update', text: 'B', createdAtHint: '2026-11-20' },
  });
  const a = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [branchA],
    },
  });
  const b = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [branchB],
    },
  });
  assert.equal(a.json().receipts[0].status, 'accepted');
  assert.equal(b.json().receipts[0].status, 'accepted_with_conflict');
  assert.deepEqual([...b.json().receipts[0].heads].sort(), ['rev-a', 'rev-b']);
  await ctx.app.close();
});

test('tombstone rejects stale create; hosting fence rejects abandoned writer', async () => {
  const ctx = await family();
  const entityId = randomUUID();
  const create = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
    entityId,
    revisionId: 'rev-1',
  });
  await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [create],
    },
  });
  const del = op({
    operationId: randomUUID(),
    actorAppUserId: ctx.adminId,
    entityId,
    revisionId: 'rev-del',
    parentRevisionIds: ['rev-1'],
    kind: 'care.delete',
    payload: { revisionKind: 'delete' },
  });
  await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [del],
    },
  });
  ctx.sync.materializeTombstone(ctx.familyId, entityId, 'rev-del', new Date().toISOString());

  const resurrect = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        op({
          operationId: randomUUID(),
          actorAppUserId: ctx.adminId,
          entityId,
          revisionId: 'rev-zombie',
        }),
      ],
    },
  });
  assert.equal(resurrect.json().receipts[0].status, 'rejected');
  assert.equal(resurrect.json().receipts[0].reason, 'tombstoned');

  ctx.sync.rotateEpochKeepReceipts(ctx.familyId);
  const staleWriter = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      writerGeneration: 1,
      operations: [
        op({
          operationId: randomUUID(),
          actorAppUserId: ctx.adminId,
          entityId: randomUUID(),
          revisionId: randomUUID(),
        }),
      ],
    },
  });
  assert.equal(staleWriter.json().receipts[0].status, 'rejected');
  assert.equal(staleWriter.json().receipts[0].reason, 'stale_writer');
  await ctx.app.close();
});

test('unknown parents are rejected without inventing a merge', async () => {
  const ctx = await family();
  const denied = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.token}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        op({
          operationId: randomUUID(),
          actorAppUserId: ctx.adminId,
          entityId: randomUUID(),
          revisionId: 'rev-child',
          parentRevisionIds: ['missing-parent'],
          kind: 'care.update',
          payload: { revisionKind: 'update', text: 'x' },
        }),
      ],
    },
  });
  assert.equal(denied.json().receipts[0].status, 'rejected');
  assert.equal(denied.json().receipts[0].reason, 'unknown_parents');
  await ctx.app.close();
});
