import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeCopiesAfterLogout,
  planIsolatedArchiveRestore,
  presentRemoteBackupStatus,
} from '../../src/domain/index.ts';

test('remote backup presentation stays null when family sync is off', () => {
  assert.equal(
    presentRemoteBackupStatus({
      enabled: false,
      lastCompletedAtLabel: null,
      lastAttemptStatus: 'idle',
      scope: 'none',
    }),
    null,
  );
});

test('completed remote backup never claims automatic phone protection from a local save', () => {
  const view = presentRemoteBackupStatus({
    enabled: true,
    lastCompletedAtLabel: '9. 11. 2026 12:00',
    lastAttemptStatus: 'completed',
    scope: 'family_archive',
  });
  assert.ok(view);
  assert.equal(view.claimsPhoneProtectedAutomatically, false);
  assert.equal(view.distinctFromLocalSave, true);
  assert.match(view.statusLine, /potvrzená vzdálená kopie/);
});

test('isolated archive restore refuses to rewrite live cursor or re-enqueue entities', () => {
  const plan = planIsolatedArchiveRestore({
    archiveId: 'arch-1',
    isFamilyAdmin: true,
    liveCursorToken: 'cursor-live',
    liveOutboxCount: 3,
  });
  assert.equal(plan.rewritesLiveCursor, false);
  assert.equal(plan.enqueuesArchiveEntitiesAsNew, false);
  assert.equal(plan.appliesTombstonesBeforeMerge, true);
  assert.equal(plan.requiresAdminConfirmation, true);
});

test('logout keeps unsent local work and admits remote copies outside app control', () => {
  const desc = describeCopiesAfterLogout({
    localUnsentCount: 2,
    remoteBackupControlledByApp: false,
  });
  assert.equal(desc.keepLocalUnsent, true);
  assert.equal(desc.localUnsentCount, 2);
  assert.equal(desc.remoteCopiesStillExistOutsideApp, true);
});
