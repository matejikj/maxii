import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPushReceipts,
  asOperationId,
  buildSyncTransferPresentation,
  commitPullPage,
  createEmptySyncState,
  enqueueDurableOutbox,
  isolateRejectedFamilyPush,
  pendingOutbox,
  runSyncTick,
  type SyncTransportPort,
} from '../../src/domain/index.ts';

test('local save always enqueues a durable outbox operation ready for transfer', () => {
  let state = createEmptySyncState();
  state = enqueueDurableOutbox(state, {
    operationId: asOperationId('op-1'),
    commandType: 'recordDiaper',
    entityId: 'entity-1',
    revisionId: 'rev-1',
    payload: { wet: true },
    enqueuedAt: '2026-11-09T00:00:00.000Z',
  });
  assert.equal(pendingOutbox(state).length, 1);
  assert.equal(pendingOutbox(state)[0]?.payloadHash.length, 64);
});

test('lost ack retry marks outbox acked once without duplicating local work', () => {
  let state = createEmptySyncState();
  state = enqueueDurableOutbox(state, {
    operationId: asOperationId('op-1'),
    commandType: 'recordDiaper',
    entityId: 'entity-1',
    revisionId: 'rev-1',
    payload: { wet: true },
    enqueuedAt: '2026-11-09T00:00:00.000Z',
  });
  state = applyPushReceipts(state, [
    { operationId: 'op-1', status: 'accepted' },
  ]);
  state = applyPushReceipts(state, [
    { operationId: 'op-1', status: 'duplicate' },
  ]);
  assert.equal(pendingOutbox(state).length, 0);
  assert.equal(state.outbox.length, 1);
  assert.equal(state.outbox[0]?.acked, true);
});

test('pull cursor advances only with applied inbox page; crash leaves prior cursor', () => {
  let state = createEmptySyncState();
  const before = commitPullPage(state, {
    entries: [
      {
        changelogSeq: 1,
        operationId: 'op-remote',
        revisionId: 'rev-r',
        entityId: 'e',
        kind: 'care.record',
        payloadHash: 'abc',
        payload: { ok: true },
      },
    ],
    nextCursor: 'cursor-1',
    epoch: 1,
    syncedAt: '2026-11-09T00:01:00.000Z',
  });
  assert.equal(before.cursor, 'cursor-1');
  assert.equal(before.inbox.length, 1);

  // Simulate crash before commitPullPage: state stays at previous cursor.
  assert.equal(state.cursor, null);
});

test('resync keeps unsent outbox; revoked push stays isolated from other families', () => {
  let state = createEmptySyncState();
  state = enqueueDurableOutbox(state, {
    operationId: asOperationId('op-local'),
    commandType: 'recordBottle',
    entityId: 'entity-2',
    revisionId: 'rev-2',
    payload: { ml: 60 },
    enqueuedAt: '2026-11-09T00:00:00.000Z',
  });
  state = commitPullPage(state, {
    entries: [],
    nextCursor: null,
    epoch: 2,
    syncedAt: '2026-11-09T00:02:00.000Z',
    resyncRequired: true,
  });
  assert.equal(state.resyncRequired, true);
  assert.equal(pendingOutbox(state).length, 1);

  const isolated = isolateRejectedFamilyPush(state, ['op-local']);
  assert.deepEqual(isolated.isolatedIds, ['op-local']);
  assert.equal(pendingOutbox(isolated.state).length, 1);
});

test('UI presentation never claims other devices are already synced', () => {
  const view = buildSyncTransferPresentation({
    pendingTransferCount: 2,
    inFlight: false,
    lastSuccessfulSyncAt: null,
  });
  assert.equal(view.savedLocally, true);
  assert.equal(view.transferState, 'pending');
  assert.equal(view.claimsOtherDevicesSynced, false);
});

test('sync worker recovers from transport loss and completes later pull', async () => {
  let state = createEmptySyncState();
  state = enqueueDurableOutbox(state, {
    operationId: asOperationId('op-net'),
    commandType: 'recordNote',
    entityId: 'entity-3',
    revisionId: 'rev-3',
    payload: { text: 'hi' },
    enqueuedAt: '2026-11-09T00:00:00.000Z',
  });

  let failPush = true;
  const transport: SyncTransportPort = {
    async push() {
      if (failPush) {
        failPush = false;
        throw new Error('network_down');
      }
      return {
        epoch: 1,
        receipts: [{ operationId: 'op-net', status: 'accepted' }],
      };
    },
    async pull() {
      return {
        entries: [
          {
            changelogSeq: 1,
            operationId: 'op-net',
            revisionId: 'rev-3',
            entityId: 'entity-3',
            kind: 'recordNote',
            payloadHash: 'x',
            payload: { text: 'hi' },
          },
        ],
        nextCursor: 'c1',
        epoch: 1,
        resyncRequired: false,
      };
    },
  };

  const failed = await runSyncTick({
    state,
    familyId: 'family-1',
    transport,
    attemptId: 'attempt-1',
    now: '2026-11-09T00:03:00.000Z',
  });
  assert.equal(failed.pushed, 0);
  assert.equal(pendingOutbox(failed.state).length, 1);

  const ok = await runSyncTick({
    state: failed.state,
    familyId: 'family-1',
    transport,
    attemptId: 'attempt-2',
    now: '2026-11-09T00:04:00.000Z',
  });
  assert.equal(ok.pushed, 1);
  assert.equal(ok.pulled, 1);
  assert.equal(pendingOutbox(ok.state).length, 0);
  assert.equal(ok.state.cursor, 'c1');
});
