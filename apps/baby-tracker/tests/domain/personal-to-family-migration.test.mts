import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  asActorId,
  asChildId,
  asDeviceId,
  runPersonalToFamilyMigrationDrill,
} from '../../src/domain/index.ts';
import {
  personalModeBlocksOnMissingBackend,
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../../src/app/remoteServicesBoundary.ts';

test('personal→family software path enforces checkpoint, refuses auto-merge, and keeps diary on defer', async () => {
  const personalEvents = ['evt-diaper-1', 'evt-sleep-1', 'evt-note-1'];
  const report = await runPersonalToFamilyMigrationDrill({
    personal: {
      localChildId: asChildId('child-personal-1'),
      localActorId: asActorId('actor-personal-1'),
      localDeviceId: asDeviceId('device-personal-1'),
      localEventIds: personalEvents,
      checkpointId: 'cp-personal-pre-family',
      childDisplayName: 'Míša',
      childBirthDate: '2025-04-01',
    },
    createFamily: async (intent) => {
      assert.equal(intent.kind, 'create_family');
      assert.equal(intent.idempotencyKey, 'personal-founding-1');
      return { familyId: `family-founding-${randomUUID()}` };
    },
    acceptInvitation: async (intent) => {
      assert.equal(intent.kind, 'accept_invitation');
      assert.equal(intent.childLinkDecision, 'defer');
      // Joining must not wipe the personal event list the drill holds.
      assert.deepEqual(personalEvents, ['evt-diaper-1', 'evt-sleep-1', 'evt-note-1']);
      return { familyId: `family-invite-${randomUUID()}` };
    },
    personalWritableWithoutApi: true,
  });

  assert.equal(report.format, 'lumi.personal-to-family-migration.v1');
  assert.equal(report.physicalDeviceMigrationClaimed, false);
  assert.equal(report.checkpointRequiredEnforced, true);
  assert.equal(report.autoMergeRefused, true);
  assert.equal(report.networkRetryKeepsIdempotencyKey, true);
  assert.equal(report.foundingPathCompletes, true);
  assert.equal(report.invitationDeferKeepsSimilarTimePairs, true);
  assert.equal(report.personalEventsPreservedAfterDefer, true);
  assert.equal(report.personalRemainsWritableWithoutApi, true);
  assert.equal(report.allSoftwareChecksPassed, true);
  assert.ok(report.foundingFamilyId);
  assert.ok(report.deferredFamilyId);
  assert.ok(report.findings.includes('physical_device_migration_not_claimed'));
});

test('personal installs stay cold without API URL and do not block care writes', () => {
  const boundary = resolveRemoteServicesBoundary({});
  assert.equal(boundary.apiBaseUrl, null);
  assert.equal(shouldInitializeRemoteClients(boundary), false);
  assert.equal(personalModeBlocksOnMissingBackend(boundary), false);
});

test('migration report never claims a physical-device move', async () => {
  const report = await runPersonalToFamilyMigrationDrill({
    personal: {
      localChildId: asChildId('child-2'),
      localActorId: asActorId('actor-2'),
      localDeviceId: asDeviceId('device-2'),
      localEventIds: ['e1'],
      checkpointId: 'cp-2',
      childDisplayName: 'Ada',
      childBirthDate: null,
    },
    createFamily: async () => ({ familyId: 'family-a' }),
    acceptInvitation: async () => ({ familyId: 'family-b' }),
    personalWritableWithoutApi: true,
  });
  assert.equal(report.physicalDeviceMigrationClaimed, false);
  assert.equal(JSON.stringify(report).includes('"physicalDeviceMigrationClaimed":true'), false);
});
