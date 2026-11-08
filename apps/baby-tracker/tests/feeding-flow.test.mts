import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asTimeZoneId,
  nursingActiveDurationMs,
  summarizeBottles,
  summarizeFood,
  summarizeNursing,
} from '../src/domain/index.ts';
import { createCommandDispatcher } from '../src/application/index.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import { createCryptoIdGenerator } from '../src/infrastructure/ids/cryptoIdGenerator.ts';
import {
  buildEndNursingCommand,
  buildPauseNursingCommand,
  buildRecordBottleCommand,
  buildRecordFoodCommand,
  buildResumeNursingCommand,
  buildStartNursingCommand,
  buildSwitchNursingSideCommand,
  mintFeedingIds,
  nowInZone,
  parseMeasuredAmount,
} from '../src/features/today/recordFeedingIntent.ts';
import {
  loadLastFeedingKind,
  saveLastFeedingKind,
} from '../src/features/today/feedingTypeMemory.ts';
import {
  buildStartSleepCommand,
  mintSleepIds,
  nowInZone as sleepNow,
} from '../src/features/today/recordSleepIntent.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_feed_1');

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

test('parseMeasuredAmount keeps empty unknown and accepts Czech comma', () => {
  assert.deepEqual(parseMeasuredAmount('', 'ml'), { ok: true, amount: null });
  assert.deepEqual(parseMeasuredAmount('0', 'ml'), {
    ok: true,
    amount: { value: 0, unit: 'ml' },
  });
  assert.deepEqual(parseMeasuredAmount('12,5', 'ml'), {
    ok: true,
    amount: { value: 12.5, unit: 'ml' },
  });
  assert.equal(parseMeasuredAmount('abc', 'ml').ok, false);
});

test('nursing pause and side switch persist segments across restart-shaped reload', async () => {
  const ctx = await openDiary('nursing-segments.db');
  const startIds = mintFeedingIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildStartNursingCommand({
      ids: startIds,
      childId,
      startedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: 1,
    }),
  );
  ctx.advance(60_000);
  await ctx.dispatcher.dispatch(
    buildPauseNursingCommand({
      ids: mintFeedingIds(ctx.ids),
      childId,
      sessionId: startIds.sessionId,
      pausedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  ctx.advance(30_000);
  await ctx.dispatcher.dispatch(
    buildResumeNursingCommand({
      ids: mintFeedingIds(ctx.ids),
      childId,
      sessionId: startIds.sessionId,
      resumedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  ctx.advance(20_000);
  await ctx.dispatcher.dispatch(
    buildSwitchNursingSideCommand({
      ids: mintFeedingIds(ctx.ids),
      childId,
      sessionId: startIds.sessionId,
      switchedAt: nowInZone(ctx.nowMs(), zone),
      side: 'right',
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  const afterSwitch = await ctx.unitOfWork.run((uow) =>
    uow.sessions.getActive(childId, 'nursing'),
  );
  assert.ok(afterSwitch);
  assert.equal(afterSwitch?.status, 'running');
  assert.equal(afterSwitch?.side, 'right');
  assert.equal(afterSwitch?.activeSegments.length, 2);

  // Reload-shaped read of the same UoW factory (same durable rows).
  const reloaded = await ctx.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'nursing'));
  assert.deepEqual(reloaded?.activeSegments, afterSwitch?.activeSegments);

  ctx.advance(40_000);
  const endIds = mintFeedingIds(ctx.ids);
  const ended = await ctx.dispatcher.dispatch(
    buildEndNursingCommand({
      operationId: endIds.operationId,
      revisionId: endIds.revisionId,
      sessionId: startIds.sessionId,
      eventId: endIds.eventId,
      careRevisionId: endIds.careRevisionId,
      childId,
      intendedEndedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  assert.equal(ended.ok, true);
  const event = await ctx.unitOfWork.run((uow) => uow.care.getById(endIds.eventId));
  assert.equal(event?.type, 'nursing');
  if (event?.type === 'nursing' && event.activeSegments) {
    assert.equal(nursingActiveDurationMs(event.activeSegments), 120_000);
    assert.equal(summarizeNursing([event]).recordedActiveMs, 120_000);
  }
  await ctx.db.close();
});

test('nursing can run beside sleep and start without a side', async () => {
  const ctx = await openDiary('nursing-beside-sleep.db');
  const sleepIds = mintSleepIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildStartSleepCommand({
      ids: sleepIds,
      childId,
      startedAt: sleepNow(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: null,
    }),
  );
  const nursingIds = mintFeedingIds(ctx.ids);
  const started = await ctx.dispatcher.dispatch(
    buildStartNursingCommand({
      ids: nursingIds,
      childId,
      startedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: null,
    }),
  );
  assert.equal(started.ok, true);
  const sleep = await ctx.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep'));
  const nursing = await ctx.unitOfWork.run((uow) => uow.sessions.getActive(childId, 'nursing'));
  assert.ok(sleep);
  assert.ok(nursing);
  assert.equal(nursing?.side, 'unspecified');
  await ctx.db.close();
});

test('bottle without amount stays incomplete in summaries', async () => {
  const ctx = await openDiary('bottle-unknown.db');
  const ids = mintFeedingIds(ctx.ids);
  const saved = await ctx.dispatcher.dispatch(
    buildRecordBottleCommand({
      ids,
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      contents: 'formula',
      intentCapturedAtMs: ctx.nowMs(),
      amount: null,
    }),
  );
  assert.equal(saved.ok, true);
  const event = await ctx.unitOfWork.run((uow) => uow.care.getById(ids.eventId));
  assert.equal(event?.type, 'bottle');
  if (event?.type === 'bottle') {
    assert.equal(event.amount, null);
    const summary = summarizeBottles([event]);
    assert.equal(summary.feedingsMissingAmount, 1);
    assert.equal(summary.recordedMl, 0);
  }
  await ctx.db.close();
});

test('food and bottle summaries never merge into one intake total', async () => {
  const ctx = await openDiary('feeding-separate.db');
  const bottleIds = mintFeedingIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildRecordBottleCommand({
      ids: bottleIds,
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      contents: 'formula',
      intentCapturedAtMs: ctx.nowMs(),
      amount: { value: 90, unit: 'ml' },
    }),
  );
  const foodIds = mintFeedingIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildRecordFoodCommand({
      ids: foodIds,
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      description: 'kaše',
      intentCapturedAtMs: ctx.nowMs(),
      amount: { value: 40, unit: 'g' },
    }),
  );
  const bottle = await ctx.unitOfWork.run((uow) => uow.care.getById(bottleIds.eventId));
  const food = await ctx.unitOfWork.run((uow) => uow.care.getById(foodIds.eventId));
  assert.ok(bottle?.type === 'bottle');
  assert.ok(food?.type === 'food');
  if (bottle?.type === 'bottle' && food?.type === 'food') {
    assert.equal(summarizeBottles([bottle]).recordedMl, 90);
    assert.equal(summarizeFood([food]).eventsWithAmount, 1);
    assert.notEqual(summarizeBottles([bottle]).recordedMl, food.amount?.value);
  }
  await ctx.db.close();
});

test('end nursing freezes intended end on idempotent retry', async () => {
  const ctx = await openDiary('nursing-end-retry.db');
  const startIds = mintFeedingIds(ctx.ids);
  await ctx.dispatcher.dispatch(
    buildStartNursingCommand({
      ids: startIds,
      childId,
      startedAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      monotonicStartMs: null,
    }),
  );
  ctx.advance(90_000);
  const endIds = mintFeedingIds(ctx.ids);
  const intended = ctx.nowMs();
  const command = buildEndNursingCommand({
    operationId: endIds.operationId,
    revisionId: endIds.revisionId,
    sessionId: startIds.sessionId,
    eventId: endIds.eventId,
    careRevisionId: endIds.careRevisionId,
    childId,
    intendedEndedAt: nowInZone(intended, zone),
    intentCapturedAtMs: intended,
  });
  const first = await ctx.dispatcher.dispatch(command);
  assert.equal(first.ok, true);
  assert.ok(first.ok && first.undo?.kind === 'undoEndNursing');
  ctx.advance(120_000);
  const retried = await ctx.dispatcher.dispatch(command);
  assert.equal(retried.ok, true);
  const event = await ctx.unitOfWork.run((uow) => uow.care.getById(endIds.eventId));
  assert.equal(event?.type, 'nursing');
  if (event?.type === 'nursing' && event.occurrence.kind === 'known') {
    assert.equal(event.occurrence.end.instant.epochMs, intended);
  }
  await ctx.db.close();
});

test('last feeding kind memory never stores amounts', async () => {
  const ctx = await openDiary('feeding-kind.db');
  assert.equal(await loadLastFeedingKind(ctx.unitOfWork), 'nursing');
  await saveLastFeedingKind(ctx.unitOfWork, 'bottle');
  assert.equal(await loadLastFeedingKind(ctx.unitOfWork), 'bottle');
  await ctx.db.close();
});
