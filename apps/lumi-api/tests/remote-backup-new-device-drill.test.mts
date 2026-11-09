import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { FamilyId } from '@lumi/contracts';
import { runRemoteBackupNewDeviceDrill } from '../src/backup/remoteBackupNewDeviceDrill.ts';

const CANARY = `DIARY-BACKUP-CANARY-${Date.now()}`;

test('remote backup new-device drill restores into staging without claiming live host RPO', async () => {
  const report = await runRemoteBackupNewDeviceDrill({
    familyId: randomUUID() as FamilyId,
    foreignFamilyId: randomUUID() as FamilyId,
    diaryCanary: CANARY,
  });

  assert.equal(report.format, 'lumi.remote-backup-new-device-drill.v1');
  assert.equal(report.liveHostRestoreClaimed, false);
  assert.equal(report.measuredRpoRtoClaimed, false);
  assert.equal(report.archiveStored, true);
  assert.equal(report.previewDoesNotActivate, true);
  assert.equal(report.newInstallStartsEmpty, true);
  assert.equal(report.stagingReceivesArchiveCanary, true);
  assert.equal(report.liveUntouchedUntilConfirm, true);
  assert.equal(report.erasurePreventsResurrection, true);
  assert.equal(report.failedUploadLeavesLiveIntact, true);
  assert.equal(report.crossFamilyArchiveDenied, true);
  assert.equal(report.allSoftwareChecksPassed, true);
  assert.ok(report.backupId);
  assert.ok(report.findings.includes('live_host_restore_not_claimed'));
});

test('backup restore report never claims measured live-host RPO/RTO', async () => {
  const report = await runRemoteBackupNewDeviceDrill({
    familyId: randomUUID() as FamilyId,
    foreignFamilyId: randomUUID() as FamilyId,
    diaryCanary: CANARY,
  });
  assert.equal(report.liveHostRestoreClaimed, false);
  assert.equal(report.measuredRpoRtoClaimed, false);
  assert.equal(
    JSON.stringify(report).includes('"liveHostRestoreClaimed":true'),
    false,
  );
  assert.equal(
    JSON.stringify(report).includes('"measuredRpoRtoClaimed":true'),
    false,
  );
});
