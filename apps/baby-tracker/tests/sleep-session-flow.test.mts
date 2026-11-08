import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  sleepOccurrenceWithoutDuration,
  zonedInstant,
} from '../src/domain/index.ts';
import { createCommandDispatcher } from '../src/application/index.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import {
  buildEndSleepCommand,
  buildStartSleepCommand,
  buildUndoEndSleepCommand,
  formatElapsedUnits,
  mintSleepIds,
  nowInZone,
  sleepClockUncertainty,
} from '../src/features/today/recordSleepIntent.ts';
import { createCryptoIdGenerator } from '../src/infrastructure/ids/cryptoIdGenerator.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_sleep_1');

async function openDiary(name: string) {
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
    'Miminko',
    null,
    'Europe/Prague',
    '{}',
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
  });
  const ids = createCryptoIdGenerator();
  return {
    db,
    unitOfWork,
    dispatcher,
    ids,
    nowMs: () => clock,
    advance(ms: number) {
      clock += ms;
    },
  };
}

test('start commits one sleep session and second start conflicts', async () => {
  const ctx = await openDiary('sleep-start.db');
  const minted = mintSleepIds(ctx.ids);
  const started = await ctx.dispatcher.dispatch(
    buildStartSleepCommand({
      ids: minted,
      childId,
      startedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: 12,
    }),
  );
  assert.equal(started.ok, true);
  const active = await ctx.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep'));
  assert.ok(active);
  assert.equal(active?.sessionId, minted.sessionId);

  const retry = await ctx.dispatcher.dispatch(
    buildStartSleepCommand({
      ids: minted,
      childId,
      startedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: 12,
    }),
  );
  assert.equal(retry.ok, true);

  const second = mintSleepIds(ctx.ids);
  const clash = await ctx.dispatcher.dispatch(
    buildStartSleepCommand({
      ids: second,
      childId,
      startedAt: nowInZone(ctx.nowMs() + 1, zone),
      intentCapturedAtMs: ctx.nowMs() + 1,
      monotonicStartMs: null,
    }),
  );
  assert.equal(clash.ok, false);
  assert.ok(!clash.ok && clash.error.details.reason === 'active_session_exists');
  await ctx.db.close();
});

test('end keeps intended end on retry and creates one care event', async () => {
  const ctx = await openDiary('sleep-end.db');
  const startIds = mintSleepIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildStartSleepCommand({
      ids: startIds,
      childId,
      startedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: null,
    }),
  );
  const endAt = ctx.nowMs() + 30 * 60_000;
  const endIds = mintSleepIds(ctx.ids);
  const endCommand = buildEndSleepCommand({
    operationId: endIds.operationId,
    revisionId: endIds.revisionId,
    sessionId: startIds.sessionId,
    eventId: endIds.eventId,
    careRevisionId: endIds.careRevisionId,
    childId,
    intendedEndedAt: nowInZone(endAt, zone),
    intentCapturedAtMs: endAt,
  });
  const first = await ctx.dispatcher.dispatch(endCommand);
  assert.equal(first.ok, true);
  assert.ok(first.ok && first.undo?.kind === 'undoEndSleep');

  ctx.advance(5 * 60_000);
  const retry = await ctx.dispatcher.dispatch(endCommand);
  assert.equal(retry.ok, true);

  const active = await ctx.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep'));
  assert.equal(active, null);
  const event = await ctx.unitOfWork.run((uow) => uow.care.getById(endIds.eventId));
  assert.equal(event?.type, 'sleep');
  if (event?.type === 'sleep' && event.occurrence.kind === 'known') {
    assert.equal(event.occurrence.end.instant.epochMs, endAt);
  }
  await ctx.db.close();
});

test('undo end restores session unless another sleep already runs', async () => {
  const ctx = await openDiary('sleep-undo.db');
  const startIds = mintSleepIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildStartSleepCommand({
      ids: startIds,
      childId,
      startedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: 1,
    }),
  );
  const endAt = ctx.nowMs() + 10_000;
  const endIds = mintSleepIds(ctx.ids);
  const ended = await ctx.dispatcher.dispatch(
    buildEndSleepCommand({
      operationId: endIds.operationId,
      revisionId: endIds.revisionId,
      sessionId: startIds.sessionId,
      eventId: endIds.eventId,
      careRevisionId: endIds.careRevisionId,
      childId,
      intendedEndedAt: nowInZone(endAt, zone),
      intentCapturedAtMs: endAt,
    }),
  );
  assert.equal(ended.ok, true);

  const undoIds = mintSleepIds(ctx.ids);
  const undone = await ctx.dispatcher.dispatch(
    buildUndoEndSleepCommand({
      ids: undoIds,
      childId,
      sessionId: startIds.sessionId,
      eventId: endIds.eventId,
      expectedCareRevisionId: endIds.careRevisionId,
      restoreStartedAt: nowInZone(ctx.nowMs(), zone),
      monotonicStartMs: 1,
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  assert.equal(undone.ok, true);
  const restored = await ctx.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep'));
  assert.ok(restored);

  // End again, start a different sleep, then undo must refuse.
  const end2 = mintSleepIds(ctx.ids);
  const end2At = ctx.nowMs() + 20_000;
  await ctx.dispatcher.dispatch(
    buildEndSleepCommand({
      operationId: end2.operationId,
      revisionId: end2.revisionId,
      sessionId: startIds.sessionId,
      eventId: end2.eventId,
      careRevisionId: end2.careRevisionId,
      childId,
      intendedEndedAt: nowInZone(end2At, zone),
      intentCapturedAtMs: end2At,
    }),
  );
  const other = mintSleepIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildStartSleepCommand({
      ids: other,
      childId,
      startedAt: nowInZone(ctx.nowMs() + 30_000, zone),
      intentCapturedAtMs: ctx.nowMs() + 30_000,
      monotonicStartMs: null,
    }),
  );
  const blocked = await ctx.dispatcher.dispatch(
    buildUndoEndSleepCommand({
      ids: mintSleepIds(ctx.ids),
      childId,
      sessionId: startIds.sessionId,
      eventId: end2.eventId,
      expectedCareRevisionId: end2.careRevisionId,
      restoreStartedAt: nowInZone(ctx.nowMs(), zone),
      monotonicStartMs: null,
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  assert.equal(blocked.ok, false);
  assert.ok(!blocked.ok && blocked.error.details.reason === 'active_session_exists');
  await ctx.db.close();
});

test('sleep without duration is care, not an active session', async () => {
  const ctx = await openDiary('sleep-noduration.db');
  const observed = zonedInstant({ epochMs: ctx.nowMs() }, zone);
  const saved = await ctx.dispatcher.dispatch({
    type: 'recordSleep',
    operationId: asOperationId('op_nodur'),
    intentCapturedAt: { epochMs: ctx.nowMs() },
    eventId: asEntityId('evt_nodur'),
    revisionId: asRevisionId('rev_nodur'),
    childId,
    occurrence: sleepOccurrenceWithoutDuration(observed),
  });
  assert.equal(saved.ok, true);
  const active = await ctx.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep'));
  assert.equal(active, null);
  const event = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('evt_nodur')));
  assert.equal(event?.type, 'sleep');
  if (event?.type === 'sleep') {
    assert.equal(event.occurrence.kind, 'unknownDuration');
  }
  await ctx.db.close();
});

test('elapsed units and clock uncertainty helpers stay honest', () => {
  assert.equal(formatElapsedUnits(38 * 60_000), '38 min');
  assert.equal(formatElapsedUnits(72 * 60_000), '1 h 12 min');
  assert.equal(
    sleepClockUncertainty({ startedAtMs: 100, nowMs: 50, monotonicStartMs: 1 }),
    'clock_moved_back',
  );
  assert.equal(
    sleepClockUncertainty({ startedAtMs: 100, nowMs: 200, monotonicStartMs: null }),
    'monotonic_lost',
  );
});
