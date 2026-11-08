import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_RETENTION_DAYS,
  isCompleteRemoteBackup,
  pruneBackupIdsOlderThan,
  validateRemoteBackupManifest,
  type RemoteBackupManifest,
} from '../src/backup.ts';

function baseManifest(overrides: Partial<RemoteBackupManifest> = {}): RemoteBackupManifest {
  return {
    schemaVersion: 1,
    backupId: 'b1',
    createdAt: '2026-11-09T00:00:00.000Z',
    completedAt: '2026-11-09T00:05:00.000Z',
    scope: 'ops_host',
    familyId: null,
    topology: {
      appDb: true,
      identityDb: true,
      attachmentsIncluded: false,
      livePgDataCopied: false,
    },
    digestSha256: 'a'.repeat(64),
    provider: {
      kind: 'restic_r2',
      regionOrJurisdiction: 'eu',
      bucketRef: 'ops-backups',
      repositoryPath: 'restic/lumi',
    },
    archiveKey: {
      kind: 'restic_password',
      keyId: 'vault://restic-pass',
      recoverableOffHost: true,
    },
    objectStoreEncryption: {
      kind: 'none',
      keyArnOrId: null,
      replacesArchiveKey: false,
    },
    contentVersions: { migrationMax: 4 },
    ...overrides,
  };
}

test('manifest rejects live PGDATA copies and KMS replacing the archive key', () => {
  const live = validateRemoteBackupManifest(
    baseManifest({
      topology: {
        appDb: true,
        identityDb: true,
        attachmentsIncluded: false,
        livePgDataCopied: true as unknown as false,
      },
    }),
  );
  assert.equal(live.ok, false);

  const kmsReplace = validateRemoteBackupManifest(
    baseManifest({
      objectStoreEncryption: {
        kind: 'sse_kms',
        keyArnOrId: 'arn:kms',
        replacesArchiveKey: true as unknown as false,
      },
    }),
  );
  assert.equal(kmsReplace.ok, false);
});

test('incomplete upload is not a completed remote backup', () => {
  const incomplete = baseManifest({ completedAt: null });
  assert.equal(isCompleteRemoteBackup(incomplete), false);
  assert.equal(isCompleteRemoteBackup(baseManifest()), true);
});

test('retention prune removes copies older than thirty days', () => {
  const now = Date.parse('2026-11-09T00:00:00.000Z');
  const prune = pruneBackupIdsOlderThan({
    nowMs: now,
    retentionDays: BACKUP_RETENTION_DAYS,
    backupIdsByCompletedAt: [
      { backupId: 'keep', completedAt: '2026-10-20T00:00:00.000Z' },
      { backupId: 'drop', completedAt: '2026-09-01T00:00:00.000Z' },
    ],
  });
  assert.deepEqual(prune, ['drop']);
});
