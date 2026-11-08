import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asActorId,
  asChildId,
  asDeviceId,
  bindLocalActorToVerifiedAccount,
  buildJoinPreview,
  completeEnrollment,
  isolateUnsentChangesAfterRevoke,
  markEnrollmentAwaitingNetwork,
  planHistoryMerge,
  requireEnrollmentCheckpoint,
  startEnrollmentIntent,
} from '../../src/domain/index.ts';

test('enrollment refuses to start without a checkpoint', () => {
  assert.deepEqual(requireEnrollmentCheckpoint({ checkpointId: null }), {
    ok: false,
    reason: 'checkpoint_required',
  });
  assert.throws(
    () =>
      startEnrollmentIntent({
        kind: 'accept_invitation',
        idempotencyKey: 'k1',
        startedAt: '2026-11-09T00:00:00.000Z',
        localChildId: asChildId('child-1'),
        localActorId: asActorId('actor-1'),
        localDeviceId: asDeviceId('device-1'),
        childLinkDecision: 'defer',
        checkpointId: '',
      }),
    /checkpoint_required/,
  );
});

test('join preview never auto-merges on similar name or birthday', () => {
  const preview = buildJoinPreview({
    familyDisplayName: 'Novákovi',
    localChildDisplayName: 'Míša',
    localChildBirthDate: '2025-04-01',
    remoteChildDisplayName: 'míša',
    remoteChildBirthDate: '2025-04-01',
  });
  assert.equal(preview.autoMergeAllowed, false);
  assert.equal(preview.nameLooksSimilar, true);
  assert.equal(preview.birthDateLooksSimilar, true);
  assert.equal(preview.requiresExplicitDecision, true);
  assert.equal(preview.invitedRole, 'caregiver');
});

test('network interruption keeps idempotent enrollment intent', () => {
  const intent = startEnrollmentIntent({
    kind: 'create_family',
    idempotencyKey: 'create-1',
    startedAt: '2026-11-09T00:00:00.000Z',
    localChildId: asChildId('child-1'),
    localActorId: asActorId('actor-1'),
    localDeviceId: asDeviceId('device-1'),
    childLinkDecision: 'founding_profile',
    checkpointId: 'cp-1',
  });
  const waiting = markEnrollmentAwaitingNetwork(intent);
  assert.equal(waiting.status, 'awaiting_network');
  assert.equal(waiting.idempotencyKey, 'create-1');
  const done = completeEnrollment(waiting, 'family-1');
  assert.equal(done.status, 'completed');
  assert.equal(done.familyId, 'family-1');
});

test('similar-time unrelated events stay side by side; stable IDs may dedupe', () => {
  const plan = planHistoryMerge({
    decision: 'same_child',
    localEventIds: ['e1', 'e2', 'e3'],
    remoteEventIds: ['e2', 'e9'],
    similarTimePairs: [{ localId: 'e1', remoteId: 'e9' }],
  });
  assert.deepEqual(plan.sharedEventIds, ['e2']);
  assert.deepEqual(plan.keepBothSimilarTimePairs, [{ localId: 'e1', remoteId: 'e9' }]);
});

test('revoked caregiver keeps unsent changes isolated from the server', () => {
  const isolated = isolateUnsentChangesAfterRevoke({
    unsentOperationIds: ['op-1', 'op-2'],
  });
  assert.equal(isolated.maySubmitToServer, false);
  assert.deepEqual(isolated.isolatedOperationIds, ['op-1', 'op-2']);
});

test('actor binding refuses rewriting another member authorship', () => {
  const ok = bindLocalActorToVerifiedAccount({
    localActorId: asActorId('actor-1'),
    authenticatedAppUserId: 'user-a',
    claimedAuthorAppUserId: null,
  });
  assert.equal(ok.ok, true);
  const denied = bindLocalActorToVerifiedAccount({
    localActorId: asActorId('actor-1'),
    authenticatedAppUserId: 'user-a',
    claimedAuthorAppUserId: 'user-b',
  });
  assert.equal(denied.ok, false);
});
