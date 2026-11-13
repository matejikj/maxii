import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asOperationId,
  createEmptyChildPrivateSyncState,
  enqueueChildPrivateOutbox,
  pendingChildPrivateOutbox,
  runChildPrivateSyncTick,
} from '../../src/domain/index.ts';
import { createChildPrivateSyncSessionBinding } from '../../src/application/bindChildPrivateSyncSession.ts';
import {
  createDisabledChildPrivateSyncTransport,
  createHttpChildPrivateSyncTransport,
  resolveChildPrivateSyncTransport,
} from '../../src/infrastructure/family/httpChildPrivateSyncTransport.ts';
import type { FamilyAuthSession } from '../../src/infrastructure/family/familyAuthPort.ts';

const NOW = { epochMs: Date.parse('2026-11-10T22:00:00.000Z') };

function session(overrides?: Partial<FamilyAuthSession>): FamilyAuthSession {
  return {
    appUserId: 'child-owner-1',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    transport: 'bearer',
    accessToken: 'bearer-token',
    csrfToken: null,
    ...overrides,
  };
}

test('personal cold resolve keeps a disabled transport without sync env', async () => {
  const transport = resolveChildPrivateSyncTransport({
    apiBaseUrl: null,
    childPrivateSyncConfigured: false,
    deviceId: 'device-1',
    getAccessCredentials: async () => ({ kind: 'bearer', accessToken: 'x' }),
  });
  await assert.rejects(
    () =>
      transport.push({
        ownerAppUserId: 'child-owner-1',
        attemptId: 'a',
        operations: [],
      }),
    /child_private_sync_not_configured/,
  );
  await assert.rejects(
    () =>
      createDisabledChildPrivateSyncTransport().pull({
        ownerAppUserId: 'x',
        cursor: null,
      }),
    /child_private_sync_not_configured/,
  );
});

test('HTTP push targets child-private path with kind mapping and no familyId', async () => {
  const calls: Array<{
    url: string;
    method?: string;
    auth?: string | null;
    body?: unknown;
  }> = [];
  const transport = createHttpChildPrivateSyncTransport({
    apiBaseUrl: 'https://api.example.test/',
    deviceId: 'device-cp',
    getAccessCredentials: async () => ({
      kind: 'bearer',
      accessToken: 'bearer-token',
    }),
    fetchImpl: async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(url),
        method: init?.method,
        auth: headers.get('authorization'),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(
        JSON.stringify({
          ownerAppUserId: 'child-owner-1',
          attemptId: 'attempt-1',
          epoch: 3,
          receipts: [{ operationId: 'cp-1', status: 'accepted' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const result = await transport.push({
    ownerAppUserId: 'child-owner-1',
    attemptId: 'attempt-1',
    operations: [
      {
        operationId: 'cp-1',
        commandType: 'child_private.project.upsert',
        entityId: 'project-1',
        revisionId: 'rev-1',
        parentRevisionIds: [],
        schemaVersion: 1,
        payloadHash: 'a'.repeat(64),
        payload: { title: 'Most', reflection: 'secret' },
      },
    ],
  });

  assert.equal(result.epoch, 3);
  assert.equal(result.receipts[0]?.status, 'accepted');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'POST');
  assert.equal(calls[0]?.url, 'https://api.example.test/v1/child-private/sync/push');
  assert.equal(calls[0]?.auth, 'Bearer bearer-token');
  assert.doesNotMatch(calls[0]!.url, /\/v1\/families\//);
  const body = calls[0]?.body as {
    protocolVersion: number;
    familyId?: string;
    operations: Array<{ kind: string; actorAppUserId: string; deviceId: string }>;
  };
  assert.equal(body.protocolVersion, 1);
  assert.equal(body.familyId, undefined);
  assert.equal(body.operations[0]?.kind, 'child_private.project.upsert');
  assert.equal(body.operations[0]?.actorAppUserId, 'child-owner-1');
  assert.equal(body.operations[0]?.deviceId, 'device-cp');
});

test('HTTP pull uses owner-scoped path and surfaces resync_required without wiping outbox', async () => {
  const transport = createHttpChildPrivateSyncTransport({
    apiBaseUrl: 'https://api.example.test',
    deviceId: 'device-cp',
    getAccessCredentials: async () => ({
      kind: 'cookie',
      csrfToken: 'csrf-secret',
    }),
    fetchImpl: async (url, init) => {
      assert.match(String(url), /\/v1\/child-private\/sync\/pull\?cursor=c0$/);
      assert.doesNotMatch(String(url), /familyId/);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('x-csrf-token'), 'csrf-secret');
      assert.equal(init?.credentials, 'include');
      return new Response(
        JSON.stringify({
          error: { code: 'resync_required', message: 'epoch drift' },
          sync: {
            ownerAppUserId: 'child-owner-1',
            epoch: 9,
            entries: [],
            nextCursor: null,
            resyncRequired: true,
            includesLivePrivateProjects: false,
          },
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-keep'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-keep',
    revisionId: 'rev-keep',
    payload: { title: 'Keep' },
    enqueuedAt: NOW,
  });
  // Mark as if push already succeeded so only pull runs the resync path.
  state = {
    ...state,
    outbox: state.outbox.map((item) => ({ ...item, acked: true })),
    cursor: 'c0',
  };

  const tick = await runChildPrivateSyncTick({
    state,
    ownerAppUserId: 'child-owner-1',
    transport,
    attemptId: 'attempt-resync',
    now: '2026-11-10T22:01:00.000Z',
  });
  assert.equal(tick.state.resyncRequired, true);
  assert.equal(tick.state.epoch, 9);
  assert.equal(pendingChildPrivateOutbox(tick.state).length, 0);
  assert.equal(tick.state.outbox.length, 1);
});

test('session binding stays cold without sync flags and never calls fetch', async () => {
  let fetchCalls = 0;
  const binding = createChildPrivateSyncSessionBinding({
    boundary: { apiBaseUrl: null, syncConfigured: false },
    deviceId: 'device-1',
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{}', { status: 500 });
    },
  });
  binding.bindAuthSession(session());
  assert.equal(binding.isTransferReady(), false);

  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-cold'),
    commandType: 'child_private.portfolio.upsert',
    entityId: 'port-1',
    revisionId: 'rev-cold',
    payload: { title: 'Cold' },
    enqueuedAt: NOW,
  });
  const result = await binding.runTick({
    state,
    attemptId: 'a1',
    now: '2026-11-10T22:02:00.000Z',
  });
  assert.equal(fetchCalls, 0);
  assert.equal(result.pushed, 0);
  assert.equal(pendingChildPrivateOutbox(result.state).length, 1);
});

test('session binding push/pull round-trip through HTTP transport when sync is on', async () => {
  const calls: string[] = [];
  const binding = createChildPrivateSyncSessionBinding({
    boundary: {
      apiBaseUrl: 'https://api.example.test',
      syncConfigured: true,
    },
    deviceId: 'device-cp',
    fetchImpl: async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${String(url)}`);
      assert.doesNotMatch(String(url), /\/v1\/families\//);
      if (String(url).endsWith('/push')) {
        return new Response(
          JSON.stringify({
            ownerAppUserId: 'child-owner-1',
            attemptId: 'a2',
            epoch: 1,
            receipts: [{ operationId: 'cp-net', status: 'accepted' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          ownerAppUserId: 'child-owner-1',
          epoch: 1,
          entries: [
            {
              changelogSeq: 1,
              operationId: 'cp-net',
              revisionId: 'rev-net',
              entityId: 'project-net',
              kind: 'child_private.project.upsert',
              payloadHash: 'b'.repeat(64),
              payload: { title: 'Online' },
            },
          ],
          nextCursor: 'cp-c1',
          resyncRequired: false,
          includesLivePrivateProjects: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  binding.bindAuthSession(session());
  assert.equal(binding.isTransferReady(), true);

  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-net'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-net',
    revisionId: 'rev-net',
    payload: { title: 'Online' },
    enqueuedAt: NOW,
  });
  const result = await binding.runTick({
    state,
    attemptId: 'a2',
    now: '2026-11-10T22:03:00.000Z',
  });
  assert.equal(result.pushed, 1);
  assert.equal(result.pulled, 1);
  assert.equal(pendingChildPrivateOutbox(result.state).length, 0);
  assert.equal(result.state.cursor, 'cp-c1');
  assert.deepEqual(calls, [
    'POST https://api.example.test/v1/child-private/sync/push',
    'GET https://api.example.test/v1/child-private/sync/pull',
  ]);
});
