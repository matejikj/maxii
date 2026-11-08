import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LAST_PORTABLE_BACKUP_BASENAME,
  androidAppFilesPortableBackupDir,
  describePortableBackupSidecarForTests,
  lastPortableBackupSidecarDevicePath,
} from '../../src/infrastructure/files/portableBackupAppPaths.ts';
import { assertPortableBackupReadable } from '../../src/infrastructure/files/portableBackupLimits.ts';

test('android portable backup sidecar paths stay under application filesDir', () => {
  const dir = androidAppFilesPortableBackupDir('com.matejikj');
  assert.equal(dir, '/data/data/com.matejikj/files/portable-backups/');
  assert.equal(
    lastPortableBackupSidecarDevicePath('com.matejikj'),
    `${dir}${LAST_PORTABLE_BACKUP_BASENAME}`,
  );
  const described = describePortableBackupSidecarForTests(1_700_000_000_000);
  assert.equal(described.lastBasename, 'lumi-last-portable-backup.json');
  assert.match(described.stampedBasename, /^lumi-portable-backup-.+\.json$/);
  assert.equal(described.devicePath, lastPortableBackupSidecarDevicePath());
});

test('sidecar payload still rejects empty sealed envelopes', () => {
  assert.throws(() => assertPortableBackupReadable(''));
  assert.doesNotThrow(() => assertPortableBackupReadable('{"format":"x"}'));
});
