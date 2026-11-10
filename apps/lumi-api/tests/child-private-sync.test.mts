import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { AppUserId, FamilyId, SyncOperation } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { hashChildPrivatePayload } from '../src/childPrivate/childPrivateSyncStore.ts';
import { hashSyncPayload } from '../src/sync/syncStore.ts';

async function boot() {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256-child-private-sync',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  return createFamilyApi(config);
}

function childOp(
  input: Partial<SyncOperation> &
    Pick<SyncOperation, 'operationId' | 'actorAppUserId' | 'kind' | 'payload'>,
): SyncOperation {
  return {
    schemaVersion: LUMI_API_PROTOCOL_VERSION,
    operationId: input.operationId,
    deviceId: input.deviceId ?? 'child-device',
    actorAppUserId: input.actorAppUserId,
    kind: input.kind,
    entityId: input.entityId ?? randomUUID(),
    revisionId: input.revisionId ?? randomUUID(),
    parentRevisionIds: input.parentRevisionIds ?? [],
    payloadHash: input.payloadHash ?? hashChildPrivatePayload(input.payload),
    payload: input.payload,
  };
}

async function principals() {
  const api = await boot();
  const childId = randomUUID() as AppUserId;
  const parentId = randomUUID() as AppUserId;
  const siblingId = randomUUID() as AppUserId;
  const childToken = await api.tokens.mintTestToken({
    subject: 'child',
    appUserId: childId,
  });
  const parentToken = await api.tokens.mintTestToken({
    subject: 'parent',
    appUserId: parentId,
  });
  const siblingToken = await api.tokens.mintTestToken({
    subject: 'sibling',
    appUserId: siblingId,
  });

  // Parent creates a family so family sync is available for the negative case.
  const created = await api.app.inject({
    method: 'POST',
    url: '/v1/families',
    headers: { authorization: `Bearer ${parentToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      idempotencyKey: 'cp-sync-family',
      displayName: 'CP Sync Family',
    },
  });
  assert.equal(created.statusCode, 201);

  return {
    ...api,
    childId,
    parentId,
    siblingId,
    childToken,
    parentToken,
    siblingToken,
    familyId: created.json().familyId as FamilyId,
  };
}

test('owner push/pull round-trips private project including reflection', async () => {
  const ctx = await principals();
  const operation = childOp({
    operationId: randomUUID(),
    actorAppUserId: ctx.childId,
    kind: 'child_private.project.upsert',
    payload: {
      title: 'Most',
      intent: 'Stavím',
      reflection: 'secret-reflection',
      status: 'active',
    },
  });
  const push = await ctx.app.inject({
    method: 'POST',
    url: '/v1/child-private/sync/push',
    headers: { authorization: `Bearer ${ctx.childToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [operation],
    },
  });
  assert.equal(push.statusCode, 200);
  assert.equal(push.json().receipts[0].status, 'accepted');
  assert.equal(push.json().ownerAppUserId, ctx.childId);

  const pull = await ctx.app.inject({
    method: 'GET',
    url: '/v1/child-private/sync/pull',
    headers: { authorization: `Bearer ${ctx.childToken}` },
  });
  assert.equal(pull.statusCode, 200);
  assert.equal(pull.json().includesLivePrivateProjects, false);
  assert.equal(pull.json().entries.length, 1);
  assert.equal(pull.json().entries[0].payload.reflection, 'secret-reflection');
});

test('family admin does not see child private project ops on child-private pull', async () => {
  const ctx = await principals();
  await ctx.app.inject({
    method: 'POST',
    url: '/v1/child-private/sync/push',
    headers: { authorization: `Bearer ${ctx.childToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        childOp({
          operationId: randomUUID(),
          actorAppUserId: ctx.childId,
          kind: 'child_private.project.upsert',
          payload: { title: 'Hidden', status: 'active', reflection: 'nope' },
        }),
      ],
    },
  });

  const parentPull = await ctx.app.inject({
    method: 'GET',
    url: '/v1/child-private/sync/pull',
    headers: { authorization: `Bearer ${ctx.parentToken}` },
  });
  assert.equal(parentPull.statusCode, 200);
  assert.equal(parentPull.json().entries.length, 0);
});

test('named recipient pulls frozen share only; live reflection stays hidden', async () => {
  const ctx = await principals();
  const projectId = randomUUID();
  await ctx.app.inject({
    method: 'POST',
    url: '/v1/child-private/sync/push',
    headers: { authorization: `Bearer ${ctx.childToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        childOp({
          operationId: randomUUID(),
          actorAppUserId: ctx.childId,
          kind: 'child_private.project.upsert',
          entityId: projectId,
          payload: {
            title: 'Most',
            reflection: 'live-secret',
            status: 'active',
          },
        }),
        childOp({
          operationId: randomUUID(),
          actorAppUserId: ctx.childId,
          kind: 'child_private.share.publish',
          entityId: randomUUID(),
          payload: {
            sourceProjectId: projectId,
            publishedTitle: 'Ukázka mostu',
            publishedBody: 'Jen tato věta.',
            audienceAppUserIds: [ctx.parentId],
          },
        }),
      ],
    },
  });

  const parentPull = await ctx.app.inject({
    method: 'GET',
    url: '/v1/child-private/sync/pull',
    headers: { authorization: `Bearer ${ctx.parentToken}` },
  });
  assert.equal(parentPull.statusCode, 200);
  const entries = parentPull.json().entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, 'child_private.share.publish');
  assert.equal(entries[0].payload.publishedBody, 'Jen tato věta.');
  assert.equal(entries[0].payload.reflection, undefined);
  assert.equal(parentPull.json().includesLivePrivateProjects, false);
});

test('sibling and unaddressed parent do not receive the share', async () => {
  const ctx = await principals();
  await ctx.app.inject({
    method: 'POST',
    url: '/v1/child-private/sync/push',
    headers: { authorization: `Bearer ${ctx.childToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        childOp({
          operationId: randomUUID(),
          actorAppUserId: ctx.childId,
          kind: 'child_private.share.publish',
          payload: {
            publishedTitle: 'Ukázka',
            publishedBody: 'tělo',
            audienceAppUserIds: [ctx.parentId],
          },
        }),
      ],
    },
  });

  const siblingPull = await ctx.app.inject({
    method: 'GET',
    url: '/v1/child-private/sync/pull',
    headers: { authorization: `Bearer ${ctx.siblingToken}` },
  });
  assert.equal(siblingPull.json().entries.length, 0);
});

test('share publish with live reflection fields is rejected', async () => {
  const ctx = await principals();
  const push = await ctx.app.inject({
    method: 'POST',
    url: '/v1/child-private/sync/push',
    headers: { authorization: `Bearer ${ctx.childToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        childOp({
          operationId: randomUUID(),
          actorAppUserId: ctx.childId,
          kind: 'child_private.share.publish',
          payload: {
            publishedTitle: 'Bad',
            publishedBody: 'x',
            audienceAppUserIds: [ctx.parentId],
            reflection: 'leak',
          },
        }),
      ],
    },
  });
  assert.equal(push.statusCode, 200);
  assert.equal(push.json().receipts[0].status, 'rejected');
  assert.equal(push.json().receipts[0].reason, 'validation');
});

test('family sync endpoint rejects child_private kinds', async () => {
  const ctx = await principals();
  const payload = { title: 'nope' };
  const operation: SyncOperation = {
    schemaVersion: LUMI_API_PROTOCOL_VERSION,
    operationId: randomUUID(),
    deviceId: 'device-1',
    actorAppUserId: ctx.parentId,
    kind: 'child_private.project.upsert',
    entityId: randomUUID(),
    revisionId: randomUUID(),
    parentRevisionIds: [],
    payloadHash: hashSyncPayload(payload),
    payload,
  };
  const push = await ctx.app.inject({
    method: 'POST',
    url: `/v1/families/${ctx.familyId}/sync/push`,
    headers: { authorization: `Bearer ${ctx.parentToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [operation],
    },
  });
  assert.equal(push.statusCode, 200);
  assert.equal(push.json().receipts[0].status, 'rejected');
  assert.equal(push.json().receipts[0].reason, 'validation');
});

test('revoked share becomes visible as revoke and publish alone is not enough after revoke pull filter', async () => {
  const ctx = await principals();
  const shareId = randomUUID();
  const audience = {
    publishedTitle: 'Ukázka',
    publishedBody: 'tělo',
    audienceAppUserIds: [ctx.parentId],
  };
  await ctx.app.inject({
    method: 'POST',
    url: '/v1/child-private/sync/push',
    headers: { authorization: `Bearer ${ctx.childToken}` },
    payload: {
      protocolVersion: LUMI_API_PROTOCOL_VERSION,
      attemptId: randomUUID(),
      operations: [
        childOp({
          operationId: randomUUID(),
          actorAppUserId: ctx.childId,
          kind: 'child_private.share.publish',
          entityId: shareId,
          payload: audience,
        }),
        childOp({
          operationId: randomUUID(),
          actorAppUserId: ctx.childId,
          kind: 'child_private.share.revoke',
          entityId: shareId,
          payload: audience,
        }),
      ],
    },
  });

  const parentPull = await ctx.app.inject({
    method: 'GET',
    url: '/v1/child-private/sync/pull',
    headers: { authorization: `Bearer ${ctx.parentToken}` },
  });
  const kinds = parentPull.json().entries.map((row: { kind: string }) => row.kind);
  assert.deepEqual(kinds, [
    'child_private.share.publish',
    'child_private.share.revoke',
  ]);
});
