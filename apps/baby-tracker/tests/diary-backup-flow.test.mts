import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  createNoteEvent,
  zonedInstant,
} from '../src/domain/index.ts';
import {
  activatePortableImport,
  createCommandDispatcher,
  ensureDailyLogicalCheckpoint,
  exportPrivateCareCsv,
  exportSealedPortableDiary,
  listLocalRecoveryPoints,
  restoreLocalRecoveryPoint,
  rollbackPreImportRestore,
  stagePortableImport,
} from '../src/application/index.ts';
import { DEFAULT_ARGON2ID_PARAMS } from '../src/infrastructure/crypto/portableBackup.ts';
import { createMemoryLogicalCheckpointVault } from '../src/infrastructure/database/logicalCheckpointVault.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import {
  createWebUnitOfWorkFactory,
  ensureChildProfileRow,
  openWebDatabase,
} from '../src/infrastructure/database/web/index.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_backup_1');
const lightArgon = { ...DEFAULT_ARGON2ID_PARAMS, t: 1, m: 32 };

async function openNative(name: string) {
  let clock = 1_700_000_000_000;
  const db = await openPrivateDatabase({
    databaseName: name,
    opener: createMemoryEncryptedSqlOpener(),
    keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(),
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
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
  });
  return {
    unitOfWork,
    vault,
    dispatcher,
    advance(ms: number) {
      clock += ms;
    },
    get clock() {
      return clock;
    },
  };
}

async function openWeb(stamp: string) {
  let clock = 1_700_000_000_000;
  const handle = await openWebDatabase({
    databaseName: `web-backup-${stamp}`,
    lockDatabaseName: `web-backup-locks-${stamp}`,
    now: { epochMs: clock },
  });
  await ensureChildProfileRow(handle.db, {
    childId,
    displayName: 'Max',
    summaryTimeZone: 'Europe/Prague',
    payloadJson: JSON.stringify({
      childId,
      displayName: 'Max',
      birthDate: null,
      settings: { summaryTimeZone: 'Europe/Prague' },
    }),
  });
  const unitOfWork = createWebUnitOfWorkFactory(handle, { nowMs: () => clock });
  const vault = createMemoryLogicalCheckpointVault();
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
  });
  return {
    unitOfWork,
    vault,
    dispatcher,
    advance(ms: number) {
      clock += ms;
    },
    get clock() {
      return clock;
    },
    handle,
  };
}

function noteCommand(suffix: string, occurredAtMs: number, body: string) {
  return {
    type: 'recordNote' as const,
    operationId: asOperationId(`op_note_${suffix}`),
    intentCapturedAt: { epochMs: 1_700_000_000_000 },
    eventId: asEntityId(`note_${suffix}`),
    revisionId: asRevisionId(`rev_note_${suffix}`),
    childId,
    occurredAt: zonedInstant({ epochMs: occurredAtMs }, zone),
    body,
  };
}

test('native portable export restores on web without duplicating on repeat', async () => {
  const native = await openNative(`backup-native-${Date.now()}`);
  await native.dispatcher.dispatch(noteCommand('a', native.clock, 'first note'));
  native.advance(60_000);
  await native.dispatcher.dispatch(noteCommand('b', native.clock, 'second note'));

  const sealed = await exportSealedPortableDiary({
    unitOfWork: native.unitOfWork,
    password: 'recovery-phrase',
    nowMs: native.clock,
    argonParams: lightArgon,
  });

  const web = await openWeb(`n2w-${Date.now()}`);
  // Local tip must be newer than the sealed archive so the compare preview is visible.
  await web.dispatcher.dispatch(
    noteCommand('local_only', sealed.exportedAtMs + 3_600_000, 'will be replaced'),
  );

  const staged = await stagePortableImport({
    unitOfWork: web.unitOfWork,
    serializedEnvelope: sealed.serialized,
    password: 'recovery-phrase',
  });
  assert.equal(staged.compare.incoming.careEventCount, 2);
  assert.ok(staged.compare.newerLocalCareEvents >= 1);
  assert.equal(staged.compare.merges, false);

  const activated = await activatePortableImport({
    unitOfWork: web.unitOfWork,
    vault: web.vault,
    archive: staged.archive,
    nowMs: web.clock,
  });
  assert.equal(activated.restoredCareEventCount, 2);

  const after = await web.unitOfWork.run((uow) => uow.care.listRecent(childId, 20));
  assert.equal(after.length, 2);
  assert.deepEqual(after.map((row) => row.eventId).sort(), ['note_a', 'note_b']);

  // Repeat import of the same archive must replace, not duplicate.
  const stagedAgain = await stagePortableImport({
    unitOfWork: web.unitOfWork,
    serializedEnvelope: sealed.serialized,
    password: 'recovery-phrase',
  });
  await activatePortableImport({
    unitOfWork: web.unitOfWork,
    vault: web.vault,
    archive: stagedAgain.archive,
    nowMs: web.clock + 1,
  });
  const again = await web.unitOfWork.run((uow) => uow.care.listRecent(childId, 20));
  assert.equal(again.length, 2);

  await web.handle.close();
});

test('wrong password and invalid envelope leave live diary unchanged', async () => {
  const native = await openNative(`backup-reject-${Date.now()}`);
  await native.dispatcher.dispatch(noteCommand('keep', native.clock, 'keep me'));
  const sealed = await exportSealedPortableDiary({
    unitOfWork: native.unitOfWork,
    password: 'correct',
    nowMs: native.clock,
    argonParams: lightArgon,
  });

  await assert.rejects(
    () =>
      stagePortableImport({
        unitOfWork: native.unitOfWork,
        serializedEnvelope: sealed.serialized,
        password: 'wrong',
      }),
    (error: unknown) =>
      error instanceof Error && /Wrong recovery password|CRYPTO/i.test(String(error)),
  );
  await assert.rejects(() =>
    stagePortableImport({
      unitOfWork: native.unitOfWork,
      serializedEnvelope: '{not-json',
      password: 'correct',
    }),
  );

  const live = await native.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(live.length, 1);
  assert.equal(live[0]?.eventId, 'note_keep');
});

test('pre-import checkpoint enables rollback after successful replace', async () => {
  const native = await openNative(`backup-rollback-${Date.now()}`);
  await native.dispatcher.dispatch(noteCommand('before', native.clock, 'before import'));
  const sealed = await exportSealedPortableDiary({
    unitOfWork: native.unitOfWork,
    password: 'pw',
    nowMs: native.clock,
    argonParams: lightArgon,
  });

  native.advance(120_000);
  await native.dispatcher.dispatch(noteCommand('after_local', native.clock, 'newer local'));

  const other = createNoteEvent({
    eventId: asEntityId('note_from_file'),
    revisionId: asRevisionId('rev_from_file'),
    childId,
    occurredAt: zonedInstant({ epochMs: native.clock - 30_000 }, zone),
    createdAt: zonedInstant({ epochMs: native.clock - 30_000 }, zone),
    body: 'from archive',
  });
  void other;

  const staged = await stagePortableImport({
    unitOfWork: native.unitOfWork,
    serializedEnvelope: sealed.serialized,
    password: 'pw',
  });
  const activated = await activatePortableImport({
    unitOfWork: native.unitOfWork,
    vault: native.vault,
    archive: staged.archive,
    nowMs: native.clock,
  });

  let live = await native.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(live.length, 1);
  assert.equal(live[0]?.eventId, 'note_before');

  const rolled = await rollbackPreImportRestore({
    unitOfWork: native.unitOfWork,
    vault: native.vault,
    rollbackCheckpointId: activated.rollbackCheckpointId,
  });
  assert.equal(rolled, 2);
  live = await native.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(live.length, 2);
  assert.ok(live.some((row) => row.eventId === 'note_after_local'));
});

test('daily checkpoint rotation keeps seven days and restore works', async () => {
  const native = await openNative(`backup-daily-${Date.now()}`);
  await native.dispatcher.dispatch(noteCommand('day0', native.clock, 'day zero'));

  for (let day = 0; day < 9; day += 1) {
    const dayMs = native.clock + day * 24 * 60 * 60 * 1000;
    await ensureDailyLogicalCheckpoint({
      unitOfWork: native.unitOfWork,
      vault: native.vault,
      nowMs: dayMs,
      timeZone: 'Europe/Prague',
    });
  }
  const points = await listLocalRecoveryPoints(native.vault);
  const daily = points.filter((row) => row.kind === 'daily');
  assert.equal(daily.length, 7);

  native.advance(5_000);
  await native.dispatcher.dispatch(noteCommand('later', native.clock, 'after checkpoints'));
  const oldest = daily[daily.length - 1]!;
  await restoreLocalRecoveryPoint({
    unitOfWork: native.unitOfWork,
    vault: native.vault,
    checkpointId: oldest.checkpointId,
  });
  const live = await native.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.ok(live.every((row) => row.eventId !== 'note_later'));
});

test('CSV export is marked private and not treated as recovery', async () => {
  const native = await openNative(`backup-csv-${Date.now()}`);
  await native.dispatcher.dispatch(noteCommand('csv', native.clock, '=1+1'));
  const exported = await exportPrivateCareCsv({
    unitOfWork: native.unitOfWork,
    nowMs: native.clock,
  });
  assert.match(exported.csv, /Not a full recovery backup/);
  assert.match(exported.csv, /'=1\+1/);
});

test('web sealed diary restores onto native', async () => {
  const web = await openWeb(`w2n-${Date.now()}`);
  await web.dispatcher.dispatch(noteCommand('web1', web.clock, 'from web'));
  const sealed = await exportSealedPortableDiary({
    unitOfWork: web.unitOfWork,
    password: 'cross',
    nowMs: web.clock,
    argonParams: lightArgon,
  });
  await web.handle.close();

  const native = await openNative(`backup-w2n-${Date.now()}`);
  await native.dispatcher.dispatch(noteCommand('native_old', native.clock, 'replace me'));
  const staged = await stagePortableImport({
    unitOfWork: native.unitOfWork,
    serializedEnvelope: sealed.serialized,
    password: 'cross',
  });
  await activatePortableImport({
    unitOfWork: native.unitOfWork,
    vault: native.vault,
    archive: staged.archive,
    nowMs: native.clock,
  });
  const live = await native.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(live.length, 1);
  assert.equal(live[0]?.eventId, 'note_web1');
});
