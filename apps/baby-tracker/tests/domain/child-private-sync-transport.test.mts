import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asOperationId,
  createEmptyChildPrivateSyncState,
  createEmptySyncState,
  enqueueChildPrivateOutbox,
  enqueueDurableOutbox,
  isAppError,
  pendingChildPrivateOutbox,
  pendingOutbox,
  runChildPrivateSyncTick,
  type ChildPrivateSyncTransportPort,
} from '../../src/domain/index.ts';

const NOW = { epochMs: Date.parse('2026-11-10T12:00:00.000Z') };

test('local child-private save enqueues without needing a server', () => {
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-op-1'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-1',
    revisionId: 'rev-1',
    payload: { title: 'Můj nápad', reflection: 'jen lokálně' },
    enqueuedAt: NOW,
  });
  assert.equal(pendingChildPrivateOutbox(state).length, 1);
  assert.equal(state.ownerAppUserId, 'child-owner-1');
  assert.equal(pendingChildPrivateOutbox(state)[0]?.payloadHash.length, 64);
  assert.equal(
    pendingChildPrivateOutbox(state)[0]?.payload.reflection,
    'jen lokálně',
  );
});

test('family care outbox rejects child_private kinds', () => {
  const state = createEmptySyncState();
  assert.throws(
    () =>
      enqueueDurableOutbox(state, {
        operationId: asOperationId('bad-op'),
        commandType: 'child_private.project.upsert',
        entityId: 'project-1',
        revisionId: 'rev-1',
        payload: { title: 'leak' },
        enqueuedAt: NOW,
      }),
    (error: unknown) =>
      isAppError(error) &&
      error.code === 'FORBIDDEN' &&
      /family care outbox/i.test(error.message),
  );
  assert.equal(pendingOutbox(state).length, 0);
});

test('share publish enqueue rejects live private fields in the snapshot', () => {
  const state = createEmptyChildPrivateSyncState();
  assert.throws(
    () =>
      enqueueChildPrivateOutbox(state, {
        ownerAppUserId: 'child-owner-1',
        operationId: asOperationId('share-bad'),
        commandType: 'child_private.share.publish',
        entityId: 'share-1',
        revisionId: 'rev-share',
        payload: {
          publishedTitle: 'Ukázka',
          publishedBody: 'Text',
          audienceAppUserIds: ['parent-1'],
          reflection: 'nesmí uniknout',
        },
        enqueuedAt: NOW,
      }),
    (error: unknown) =>
      isAppError(error) &&
      error.code === 'VALIDATION' &&
      /frozen snapshots/i.test(error.message),
  );
});

test('safe share publish may enqueue on the owner-scoped outbox', () => {
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('share-ok'),
    commandType: 'child_private.share.publish',
    entityId: 'share-1',
    revisionId: 'rev-share',
    payload: {
      publishedTitle: 'Ukázka',
      publishedBody: 'Jen vybraný text',
      audienceAppUserIds: ['parent-1'],
    },
    enqueuedAt: NOW,
  });
  assert.equal(pendingChildPrivateOutbox(state).length, 1);
  assert.equal(
    pendingChildPrivateOutbox(state)[0]?.commandType,
    'child_private.share.publish',
  );
});

test('child-private tick never passes a familyId and recovers after transport loss', async () => {
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-net'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-2',
    revisionId: 'rev-2',
    payload: { title: 'Offline nápad' },
    enqueuedAt: NOW,
  });

  let failPush = true;
  const seenPushKeys: string[] = [];
  const transport: ChildPrivateSyncTransportPort = {
    async push(input) {
      seenPushKeys.push(...Object.keys(input));
      assert.equal(input.ownerAppUserId, 'child-owner-1');
      assert.equal(
        (input as { familyId?: string }).familyId,
        undefined,
      );
      if (failPush) {
        failPush = false;
        throw new Error('network_down');
      }
      return {
        epoch: 1,
        receipts: [{ operationId: 'cp-net', status: 'accepted' }],
      };
    },
    async pull(input) {
      seenPushKeys.push(...Object.keys(input));
      assert.equal(input.ownerAppUserId, 'child-owner-1');
      assert.equal(
        (input as { familyId?: string }).familyId,
        undefined,
      );
      return {
        entries: [
          {
            changelogSeq: 1,
            operationId: 'cp-net',
            revisionId: 'rev-2',
            entityId: 'project-2',
            kind: 'child_private.project.upsert',
            payloadHash: 'x',
            payload: { title: 'Offline nápad' },
          },
        ],
        nextCursor: 'cp-c1',
        epoch: 1,
        resyncRequired: false,
      };
    },
  };

  const failed = await runChildPrivateSyncTick({
    state,
    ownerAppUserId: 'child-owner-1',
    transport,
    attemptId: 'attempt-1',
    now: '2026-11-10T12:01:00.000Z',
  });
  assert.equal(failed.pushed, 0);
  assert.equal(pendingChildPrivateOutbox(failed.state).length, 1);

  const ok = await runChildPrivateSyncTick({
    state: failed.state,
    ownerAppUserId: 'child-owner-1',
    transport,
    attemptId: 'attempt-2',
    now: '2026-11-10T12:02:00.000Z',
  });
  assert.equal(ok.pushed, 1);
  assert.equal(ok.pulled, 1);
  assert.equal(pendingChildPrivateOutbox(ok.state).length, 0);
  assert.equal(ok.state.cursor, 'cp-c1');
  assert.ok(seenPushKeys.every((key) => key !== 'familyId'));
});

test('child-private outbox refuses a different owner binding', () => {
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('cp-a'),
    commandType: 'child_private.portfolio.upsert',
    entityId: 'port-1',
    revisionId: 'rev-a',
    payload: { title: 'Moje' },
    enqueuedAt: NOW,
  });
  assert.throws(
    () =>
      enqueueChildPrivateOutbox(state, {
        ownerAppUserId: 'sibling-2',
        operationId: asOperationId('cp-b'),
        commandType: 'child_private.portfolio.upsert',
        entityId: 'port-2',
        revisionId: 'rev-b',
        payload: { title: 'Cizí' },
        enqueuedAt: NOW,
      }),
    (error: unknown) =>
      isAppError(error) &&
      error.code === 'FORBIDDEN' &&
      /single owner/i.test(error.message),
  );
});
