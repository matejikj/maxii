import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  zonedInstant,
} from '../src/domain/index.ts';
import {
  createCommandDispatcher,
  findCanaryResidues,
  loadPersonalPreferences,
  saveReminderPreferences,
  setCharacterMotionEnabled,
  setGuideSpecies,
  setAppMotif,
  META_APP_MOTIF,
  type AppMotif,
  shouldShowBackupHint,
  markBackupHintShown,
  wipePersonalData,
  buildDiagnosticsSnapshot,
} from '../src/application/index.ts';
import { createMemoryLogicalCheckpointVault } from '../src/infrastructure/database/logicalCheckpointVault.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import { createMemoryReminderScheduler } from '../src/infrastructure/notifications/reminderScheduler.ts';
import { createMemoryAppLockStore } from '../src/infrastructure/security/appLockStore.ts';
import { sanitizeLogFields } from '../src/infrastructure/telemetry/logger.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_settings_1');
const CANARY = 'CANARY_NOTE_BODY_9f3a';

async function openNative(name: string) {
  let clock = 1_700_000_000_000;
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const db = await openPrivateDatabase({
    databaseName: name,
    opener,
    keyStore,
    presence,
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: clock },
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Max',
    '2025-01-01',
    'Europe/Prague',
    JSON.stringify({
      childId,
      displayName: 'Max',
      birthDate: '2025-01-01',
      settings: { summaryTimeZone: 'Europe/Prague' },
    }),
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const vault = createMemoryLogicalCheckpointVault();
  const reminders = createMemoryReminderScheduler({ platform: 'ios', osLocalNotifications: true });
  const appLock = createMemoryAppLockStore();
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
  });
  return {
    unitOfWork,
    vault,
    reminders,
    appLock,
    keyStore,
    presence,
    opener,
    databaseName: name,
    dispatcher,
    close: () => db.close(),
    advance(ms: number) {
      clock += ms;
    },
    get clock() {
      return clock;
    },
  };
}

test('preferences default motion on, reminders off, and guide is Lumi rabbit', async () => {
  const native = await openNative(`settings-pref-${Date.now()}`);
  const prefs = await loadPersonalPreferences(native.unitOfWork, 'Europe/Prague');
  assert.equal(prefs.characterMotionEnabled, true);
  assert.equal(prefs.guideSpecies, 'rabbit');
  assert.equal(prefs.appMotif, 'forest');
  assert.equal(prefs.reminders.dailyTogetherEnabled, false);
  assert.equal(prefs.reminders.weeklyGlanceEnabled, false);

  await setCharacterMotionEnabled(native.unitOfWork, false);
  await setGuideSpecies(native.unitOfWork, 'fox');
  const next = await loadPersonalPreferences(native.unitOfWork, 'Europe/Prague');
  assert.equal(next.characterMotionEnabled, false);
  assert.equal(next.guideSpecies, 'fox');
  await native.close();
});

test('app motif persists across reopening without changing guide or motion preferences', async () => {
  const native = await openNative(`settings-motif-${Date.now()}`);
  await setGuideSpecies(native.unitOfWork, 'fox');
  await setCharacterMotionEnabled(native.unitOfWork, false);
  await setAppMotif(native.unitOfWork, 'garden');
  assert.equal(
    (await loadPersonalPreferences(native.unitOfWork, 'Europe/Prague')).appMotif,
    'garden',
  );
  await setAppMotif(native.unitOfWork, 'playground');
  await assert.rejects(() => setAppMotif(native.unitOfWork, 'ocean' as AppMotif), /Neznámý motiv/);
  await native.close();
  const reopened = await openPrivateDatabase({
    databaseName: native.databaseName,
    opener: native.opener,
    keyStore: native.keyStore,
    presence: native.presence,
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: native.clock },
  });
  const unitOfWork = createNativeUnitOfWorkFactory(reopened, { nowMs: () => native.clock });
  const prefs = await loadPersonalPreferences(unitOfWork, 'Europe/Prague');
  assert.equal(prefs.appMotif, 'playground');
  assert.equal(prefs.guideSpecies, 'fox');
  assert.equal(prefs.characterMotionEnabled, false);
  await unitOfWork.run((uow) => uow.meta.set(META_APP_MOTIF, 'future-world'));
  assert.equal((await loadPersonalPreferences(unitOfWork, 'Europe/Prague')).appMotif, 'forest');
  await reopened.close();
});

test('reminder permission is requested only when enabling and denied leaves core usable', async () => {
  const native = await openNative(`settings-remind-${Date.now()}`);
  native.reminders.state.permission = 'denied';
  const permission = await native.reminders.requestPermission();
  assert.equal(permission, 'denied');

  const saved = await saveReminderPreferences(native.unitOfWork, {
    dailyTogetherEnabled: true,
    dailyTogetherHour: 19,
    dailyTogetherMinute: 30,
    weeklyGlanceEnabled: false,
    weeklyGlanceWeekday: 0,
    timeZone: 'Europe/Prague',
  });
  await native.reminders.syncSchedules(saved);
  // Denied permission means no OS schedules, preferences still stored.
  assert.equal(native.reminders.state.schedules.length, 0);
  const prefs = await loadPersonalPreferences(native.unitOfWork, 'Europe/Prague');
  assert.equal(prefs.reminders.dailyTogetherEnabled, true);

  // Care still works without notifications.
  await native.dispatcher.dispatch({
    type: 'recordNote',
    operationId: asOperationId('op_note_denied'),
    intentCapturedAt: { epochMs: native.clock },
    eventId: asEntityId('note_denied'),
    revisionId: asRevisionId('rev_denied'),
    childId,
    occurredAt: zonedInstant({ epochMs: native.clock }, zone),
    body: 'note without notifications',
  });
  const recent = await native.unitOfWork.run((uow) => uow.care.listRecent(childId, 5));
  assert.equal(recent.length, 1);
  await native.close();
});

test('backup hint appears once after first care row and can be dismissed', async () => {
  const native = await openNative(`settings-hint-${Date.now()}`);
  assert.equal(await shouldShowBackupHint(native.unitOfWork), false);
  await native.dispatcher.dispatch({
    type: 'recordNote',
    operationId: asOperationId('op_note_hint'),
    intentCapturedAt: { epochMs: native.clock },
    eventId: asEntityId('note_hint'),
    revisionId: asRevisionId('rev_hint'),
    childId,
    occurredAt: zonedInstant({ epochMs: native.clock }, zone),
    body: 'first real row',
  });
  assert.equal(await shouldShowBackupHint(native.unitOfWork), true);
  await markBackupHintShown(native.unitOfWork);
  assert.equal(await shouldShowBackupHint(native.unitOfWork), false);
  await native.close();
});

test('app lock gates without rotating the database key', async () => {
  const native = await openNative(`settings-lock-${Date.now()}`);
  const beforeKey = await native.keyStore.readDatabaseKey();
  assert.ok(beforeKey);
  await native.appLock.enableWithPin('2468');
  await native.appLock.lockOnBackground();
  const status = await native.appLock.getStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.locked, true);
  assert.equal(await native.appLock.unlock('0000'), false);
  assert.equal(await native.appLock.unlock('2468'), true);
  const afterKey = await native.keyStore.readDatabaseKey();
  assert.deepEqual(afterKey, beforeKey);
  await native.close();
});

test('full wipe removes canary care data, checkpoints, reminders and keys', async () => {
  const name = `settings-wipe-${Date.now()}`;
  const native = await openNative(name);
  await native.dispatcher.dispatch({
    type: 'recordNote',
    operationId: asOperationId('op_note_canary'),
    intentCapturedAt: { epochMs: native.clock },
    eventId: asEntityId('note_canary'),
    revisionId: asRevisionId('rev_canary'),
    childId,
    occurredAt: zonedInstant({ epochMs: native.clock }, zone),
    body: CANARY,
  });
  await native.vault.create({
    kind: 'daily',
    dayKey: '2023-11-14',
    nowMs: native.clock,
    archive: await native.unitOfWork.run((uow) =>
      uow.diary.capture({ createdAtMs: native.clock, schemaCompatibility: 5 }),
    ),
  });
  native.reminders.state.permission = 'granted';
  await native.reminders.syncSchedules({
    dailyTogetherEnabled: true,
    dailyTogetherHour: 18,
    dailyTogetherMinute: 0,
    weeklyGlanceEnabled: true,
    weeklyGlanceWeekday: 1,
    timeZone: 'Europe/Prague',
  });
  await native.appLock.enableWithPin('1357');

  const beforeHits = await findCanaryResidues(native.unitOfWork, CANARY);
  assert.ok(beforeHits.some((hit) => hit.startsWith('care:')));

  await wipePersonalData({
    unitOfWork: native.unitOfWork,
    checkpoints: native.vault,
    reminders: native.reminders,
    appLock: native.appLock,
    nowMs: native.clock,
    closeRuntime: native.close,
    deleteDurableStore: async () => native.opener.delete(name),
    keyStore: native.keyStore,
    presence: native.presence,
    databaseName: name,
  });

  assert.equal((await native.vault.list()).length, 0);
  assert.equal(native.reminders.state.schedules.length, 0);
  assert.equal((await native.appLock.getStatus()).enabled, false);
  assert.equal(await native.keyStore.readDatabaseKey(), null);
  assert.equal(await native.presence.isPresent(name), false);

  // Fresh open after wipe must not find the canary diary.
  const reopened = await openPrivateDatabase({
    databaseName: `${name}-reopen`,
    opener: native.opener,
    keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(),
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: native.clock + 1 },
  });
  const unitOfWork = createNativeUnitOfWorkFactory(reopened, {
    nowMs: () => native.clock + 1,
  });
  const hits = await findCanaryResidues(unitOfWork, CANARY);
  assert.deepEqual(hits, []);
  await reopened.close();
});

test('diagnostics export redacts care payloads and reports technical counts', async () => {
  const native = await openNative(`settings-diag-${Date.now()}`);
  await native.dispatcher.dispatch({
    type: 'recordNote',
    operationId: asOperationId('op_note_diag'),
    intentCapturedAt: { epochMs: native.clock },
    eventId: asEntityId('note_diag'),
    revisionId: asRevisionId('rev_diag'),
    childId,
    occurredAt: zonedInstant({ epochMs: native.clock }, zone),
    body: CANARY,
  });
  const snapshot = await buildDiagnosticsSnapshot({
    unitOfWork: native.unitOfWork,
    checkpointCount: 2,
    appLockEnabled: false,
    nowMs: native.clock,
  });
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.careEventCount, 1);
  assert.ok(snapshot.releaseEvidence);
  assert.equal(snapshot.releaseEvidence?.signing.keysInRepository, false);
  assert.ok(snapshot.catalogVersion);
  assert.doesNotMatch(serialized, new RegExp(CANARY));
  assert.doesNotMatch(serialized, /2025-01-01/);
  const redacted = sanitizeLogFields({ code: 'x', noteBody: CANARY, birthDate: 'x' });
  assert.equal(redacted.noteBody, '[redacted]');
  await native.close();
});

test('web reminder capabilities never claim closed-browser push', async () => {
  const web = createMemoryReminderScheduler({ platform: 'web', osLocalNotifications: false });
  assert.equal(web.getCapabilities().closedBrowserPush, false);
  assert.equal(web.getCapabilities().osLocalNotifications, false);
  assert.equal(await web.requestPermission(), 'unsupported');
});
