import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  asChildId,
  asTimeZoneId,
  createDiaryArchive,
} from '../src/domain/index.ts';
import {
  createEncryptedFileCheckpointBackend,
  createMemoryCheckpointKeyVault,
  createMemoryCheckpointTextFileStore,
  createWebIndexedCheckpointBackend,
} from '../src/infrastructure/database/durableLogicalCheckpointVault.ts';
import {
  createLogicalCheckpointVault,
  createMemoryLogicalCheckpointVault,
} from '../src/infrastructure/database/logicalCheckpointVault.ts';
import {
  createExpoReminderScheduler,
} from '../src/infrastructure/notifications/expoReminderScheduler.ts';
import {
  createFaultedAppLockStore,
  createMemoryAppLockStore,
} from '../src/infrastructure/security/appLockStore.ts';
import {
  assertPortableBackupReadable,
  portableBackupFileName,
} from '../src/infrastructure/files/portableBackupLimits.ts';import {
  openLocalBlob,
  sealLocalBlob,
  serializeSealedLocalBlob,
  parseSealedLocalBlob,
} from '../src/infrastructure/crypto/localBlobSeal.ts';
import { randomBytes } from '@noble/hashes/utils.js';

function sampleArchive(nowMs: number) {
  return createDiaryArchive({
    createdAtMs: nowMs,
    schemaCompatibility: 4,
    profiles: [
      {
        childId: asChildId('child_platform_1'),
        displayName: 'Test',
        birthDate: '2025-01-01',
        settings: { summaryTimeZone: asTimeZoneId('Europe/Prague') },
      },
    ],
    careEvents: [],
    sessions: [],
    drafts: [],
    revisions: [],
    receipts: [],
    deletions: [],
    meta: [],
  });
}

test('encrypted file checkpoint vault survives a new backend instance', async () => {
  const files = createMemoryCheckpointTextFileStore();
  const sharedKey = randomBytes(32);
  const keysA = createMemoryCheckpointKeyVault(sharedKey);
  const vaultA = createLogicalCheckpointVault(
    createEncryptedFileCheckpointBackend(files, keysA),
  );
  const archive = sampleArchive(1_700_000_000_000);
  const created = await vaultA.create({
    kind: 'pre_import',
    archive,
    nowMs: 1_700_000_000_000,
  });
  assert.equal(files.files.size, 1);

  const keysB = createMemoryCheckpointKeyVault(sharedKey);
  const vaultB = createLogicalCheckpointVault(
    createEncryptedFileCheckpointBackend(files, keysB),
  );
  const listed = await vaultB.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.checkpointId, created.checkpointId);
  const restored = await vaultB.readArchive(created.checkpointId);
  assert.equal(restored.profiles[0]?.displayName, 'Test');
});

test('web indexed checkpoint vault is outside the live diary database name', async () => {
  const backend = createWebIndexedCheckpointBackend('lumi-test-logical-checkpoints');
  const vault = createLogicalCheckpointVault(backend);
  await vault.create({
    kind: 'daily',
    archive: sampleArchive(1_700_000_100_000),
    dayKey: '2025-01-01',
    nowMs: 1_700_000_100_000,
  });
  const again = createLogicalCheckpointVault(
    createWebIndexedCheckpointBackend('lumi-test-logical-checkpoints'),
  );
  assert.equal((await again.list()).length, 1);
  await again.clearAll();
  assert.equal((await again.list()).length, 0);
});

test('memory vault retention still keeps seven daily points', async () => {
  const vault = createMemoryLogicalCheckpointVault();
  for (let day = 0; day < 10; day += 1) {
    await vault.create({
      kind: 'daily',
      archive: sampleArchive(1_700_000_000_000 + day),
      dayKey: `2025-01-${String(day + 1).padStart(2, '0')}`,
      nowMs: 1_700_000_000_000 + day,
    });
  }
  assert.equal((await vault.list()).filter((row) => row.kind === 'daily').length, 7);
});

test('faulted app lock stays locked and never silently unlocks', async () => {
  const store = createFaultedAppLockStore('SecureStore probe failed');
  const status = await store.getStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.locked, true);
  assert.match(status.fault ?? '', /SecureStore/);
  assert.equal(await store.unlock('1234'), false);
  await assert.rejects(() => store.enableWithPin('1234'));
});

test('memory app lock reports protection metadata', async () => {
  const store = createMemoryAppLockStore('origin_storage');
  await store.enableWithPin('4242');
  const status = await store.getStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.protection, 'origin_storage');
  assert.equal(status.fault, null);
});

test('expo reminder scheduler schedules generic local notifications', async () => {
  const calls: Array<{ id: string; title: string }> = [];
  const fake = {
    SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly' },
    async getPermissionsAsync() {
      return { granted: true, status: 'granted', canAskAgain: true };
    },
    async requestPermissionsAsync() {
      return { granted: true, status: 'granted', canAskAgain: true };
    },
    async cancelScheduledNotificationAsync() {},
    async cancelAllScheduledNotificationsAsync() {},
    async scheduleNotificationAsync(request: {
      identifier: string;
      content: { title: string; body: string };
    }) {
      calls.push({ id: request.identifier, title: request.content.title });
      assert.doesNotMatch(request.content.body, /Max|poznámka|2025-01-01/i);
      return request.identifier;
    },
  };
  const scheduler = createExpoReminderScheduler(fake as never, 'ios');
  assert.equal(scheduler.getCapabilities().osLocalNotifications, true);
  await scheduler.syncSchedules({
    dailyTogetherEnabled: true,
    dailyTogetherHour: 18,
    dailyTogetherMinute: 0,
    weeklyGlanceEnabled: true,
    weeklyGlanceWeekday: 0,
    timeZone: 'Europe/Prague',
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((item) => item.title.length > 0));
});

test('local blob seal rejects tampering', () => {
  const key = randomBytes(32);
  const sealed = sealLocalBlob(new TextEncoder().encode('{"ok":true}'), key);
  const raw = serializeSealedLocalBlob(sealed);
  const parsed = parseSealedLocalBlob(raw);
  assert.equal(new TextDecoder().decode(openLocalBlob(parsed, key)), '{"ok":true}');
  parsed.ciphertextHex = `${parsed.ciphertextHex.slice(0, -2)}ff`;
  assert.throws(() => openLocalBlob(parsed, key));
});

test('portable backup file helpers reject empty and name files', () => {
  assert.throws(() => assertPortableBackupReadable(''));
  assert.match(portableBackupFileName(1_700_000_000_000), /^lumi-portable-backup-.+\.json$/);
});
