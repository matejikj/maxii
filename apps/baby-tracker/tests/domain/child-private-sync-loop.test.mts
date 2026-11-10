import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asOperationId,
  createEmptyChildPrivateSyncState,
  createMemoryChildPrivateSyncStateStore,
  enqueueChildPrivateOutbox,
  pendingChildPrivateOutbox,
} from '../../src/domain/index.ts';
import { createChildPrivateSyncSessionBinding } from '../../src/application/bindChildPrivateSyncSession.ts';
import {
  createChildPrivateSyncLoop,
  runChildPrivateSyncTickWithStore,
} from '../../src/application/childPrivateSyncLoop.ts';
import type { FamilyAuthSession } from '../../src/infrastructure/family/familyAuthPort.ts';

const NOW = { epochMs: Date.parse('2026-11-11T00:30:00.000Z') };

function session(): FamilyAuthSession {
  return {
    appUserId: 'child-owner-1',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    transport: 'bearer',
    accessToken: 'bearer-token',
    csrfToken: null,
  };
}

test('child-private sync loop stays cold without sync session and never opens the API', async () => {
  let fetchCalls = 0;
  const store = createMemoryChildPrivateSyncStateStore();
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-loop-cold'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-cold',
    revisionId: 'rev-cold',
    payload: { title: 'Cold' },
    enqueuedAt: NOW,
  });
  await store.save(state);

  const binding = createChildPrivateSyncSessionBinding({
    boundary: { apiBaseUrl: null, syncConfigured: false },
    deviceId: 'device-loop-cold',
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{}', { status: 500 });
    },
  });
  binding.bindAuthSession(session());

  const loop = createChildPrivateSyncLoop({
    binding,
    store,
    createAttemptId: () => 'attempt-cold',
    nowIso: () => '2026-11-11T00:30:00.000Z',
    setIntervalFn: (() => 1) as unknown as typeof setInterval,
    clearIntervalFn: () => undefined,
  });

  const result = await loop.runOnce();
  assert.equal(result.personalCold, true);
  assert.equal(result.pushed, 0);
  assert.equal(fetchCalls, 0);
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 1);
});

test('child-private sync loop push/pull round-trip persists receipts into the store', async () => {
  const calls: string[] = [];
  const store = createMemoryChildPrivateSyncStateStore();
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-loop-net'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-net',
    revisionId: 'rev-net',
    payload: { title: 'Online' },
    enqueuedAt: NOW,
  });
  await store.save(state);

  const binding = createChildPrivateSyncSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      syncConfigured: true,
    },
    deviceId: 'device-loop-net',
    fetchImpl: async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${String(url)}`);
      assert.doesNotMatch(String(url), /\/v1\/families\//);
      if (String(url).endsWith('/push')) {
        return new Response(
          JSON.stringify({
            ownerAppUserId: 'child-owner-1',
            attemptId: 'attempt-net',
            epoch: 2,
            receipts: [{ operationId: 'cp-loop-net', status: 'accepted' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ownerAppUserId: 'child-owner-1',
          epoch: 2,
          entries: [
            {
              changelogSeq: 1,
              operationId: 'cp-loop-net',
              revisionId: 'rev-net',
              entityId: 'project-net',
              kind: 'child_private.project.upsert',
              payloadHash: 'c'.repeat(64),
              payload: { title: 'Online' },
            },
          ],
          nextCursor: 'cp-loop-c1',
          resyncRequired: false,
          includesLivePrivateProjects: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  binding.bindAuthSession(session());

  const result = await runChildPrivateSyncTickWithStore({
    binding,
    store,
    attemptId: 'attempt-net',
    nowIso: '2026-11-11T00:31:00.000Z',
  });

  assert.equal(result.personalCold, false);
  assert.equal(result.pushed, 1);
  assert.equal(result.pulled, 1);
  const saved = await store.load();
  assert.equal(pendingChildPrivateOutbox(saved).length, 0);
  assert.equal(saved.cursor, 'cp-loop-c1');
  assert.equal(saved.epoch, 2);
  assert.deepEqual(calls, [
    'POST https://api.example.test/v1/child-private/sync/push',
    'GET https://api.example.test/v1/child-private/sync/pull',
  ]);
});

test('logged-out session keeps the durable outbox and skips HTTP', async () => {
  let fetchCalls = 0;
  const store = createMemoryChildPrivateSyncStateStore();
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-loop-logout'),
    commandType: 'child_private.share.publish',
    entityId: 'share-1',
    revisionId: 'rev-share',
    payload: {
      publishedTitle: 'Ukázka',
      publishedBody: 'Jen toto.',
      audienceAppUserIds: ['parent-1'],
    },
    enqueuedAt: NOW,
  });
  await store.save(state);

  const binding = createChildPrivateSyncSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      syncConfigured: true,
    },
    deviceId: 'device-loop-logout',
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{}', { status: 500 });
    },
  });
  // Sync env is on, but no principal is bound — stays cold.
  binding.bindAuthSession(null);

  const result = await runChildPrivateSyncTickWithStore({
    binding,
    store,
    attemptId: 'attempt-logout',
    nowIso: '2026-11-11T00:32:00.000Z',
  });
  assert.equal(result.personalCold, true);
  assert.equal(fetchCalls, 0);
  assert.equal(pendingChildPrivateOutbox(await store.load()).length, 1);
});
