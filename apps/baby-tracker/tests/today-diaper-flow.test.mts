import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asTimeZoneId,
  endOfCalendarDayExclusive,
  startOfCalendarDay,
  todayInZone,
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
  buildRecordDiaperCommand,
  mintDiaperIds,
  nowOccurrence,
  parseWallDateTime,
} from '../src/features/today/recordDiaperIntent.ts';
import {
  loadQuickActionOrder,
  moveQuickActionEarlier,
  saveQuickActionOrder,
} from '../src/features/today/quickActions.ts';
import { createCryptoIdGenerator } from '../src/infrastructure/ids/cryptoIdGenerator.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_today_1');

async function openDiary(name: string) {
  let clock = 1_700_000_360_000;
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

test('direct wet diaper persists and survives reopen-style list queries', async () => {
  const ctx = await openDiary('today-diaper-direct.db');
  const intentMs = ctx.nowMs();
  const minted = mintDiaperIds(ctx.ids);
  const first = await ctx.dispatcher.dispatch(
    buildRecordDiaperCommand({
      ids: minted,
      childId,
      contents: 'wet',
      occurredAt: nowOccurrence(intentMs, zone),
      intentCapturedAtMs: intentMs,
    }),
  );
  assert.equal(first.ok, true);

  // Same intent retry must not create a second diaper.
  const retry = await ctx.dispatcher.dispatch(
    buildRecordDiaperCommand({
      ids: minted,
      childId,
      contents: 'wet',
      occurredAt: nowOccurrence(intentMs, zone),
      intentCapturedAtMs: intentMs,
    }),
  );
  assert.equal(retry.ok, true);

  const bothIds = mintDiaperIds(ctx.ids);
  const bothIntent = ctx.nowMs() + 1;
  ctx.advance(1);
  const both = await ctx.dispatcher.dispatch(
    buildRecordDiaperCommand({
      ids: bothIds,
      childId,
      contents: 'both',
      occurredAt: nowOccurrence(bothIntent, zone),
      intentCapturedAtMs: bothIntent,
    }),
  );
  assert.equal(both.ok, true);

  const recent = await ctx.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(recent.length, 2);
  assert.equal(recent[0]?.type, 'diaper');
  if (recent[0]?.type === 'diaper') assert.equal(recent[0].contents, 'both');

  const day = todayInZone({ epochMs: intentMs }, zone);
  const dayEvents = await ctx.unitOfWork.run((uow) =>
    uow.care.listInSortRange(
      childId,
      startOfCalendarDay(day, zone).epochMs,
      endOfCalendarDayExclusive(day, zone).epochMs,
    ),
  );
  assert.equal(dayEvents.length, 2);
  await ctx.db.close();
});

test('detailed wall time parse and quick-action preference persist', async () => {
  const ctx = await openDiary('today-diaper-prefs.db');
  const parsed = parseWallDateTime('2023-11-08 10:20', zone);
  assert.equal(parsed.ok, true);

  const order = await saveQuickActionOrder(
    ctx.unitOfWork,
    moveQuickActionEarlier(['feeding', 'sleep', 'diaper', 'experience'], 'diaper'),
  );
  assert.deepEqual(order, ['feeding', 'diaper', 'sleep', 'experience']);
  const reloaded = await loadQuickActionOrder(ctx.unitOfWork);
  assert.deepEqual(reloaded, order);

  if (!parsed.ok) throw new Error('parse failed');
  const minted = mintDiaperIds(ctx.ids);
  const saved = await ctx.dispatcher.dispatch(
    buildRecordDiaperCommand({
      ids: minted,
      childId,
      contents: 'dirty',
      occurredAt: parsed.occurredAt,
      intentCapturedAtMs: ctx.nowMs(),
      note: 'později',
    }),
  );
  assert.equal(saved.ok, true);
  const loaded = await ctx.unitOfWork.run((uow) => uow.care.getById(minted.eventId));
  assert.equal(loaded?.type, 'diaper');
  if (loaded?.type === 'diaper') {
    assert.equal(loaded.contents, 'dirty');
    assert.equal(loaded.note, 'později');
  }
  await ctx.db.close();
});

test('undo create removes the diaper from Today lists', async () => {
  const ctx = await openDiary('today-diaper-undo.db');
  const minted = mintDiaperIds(ctx.ids);
  const intentMs = ctx.nowMs();
  const created = await ctx.dispatcher.dispatch(
    buildRecordDiaperCommand({
      ids: minted,
      childId,
      contents: 'wet',
      occurredAt: zonedInstant({ epochMs: intentMs }, zone),
      intentCapturedAtMs: intentMs,
    }),
  );
  assert.equal(created.ok, true);
  const undo = await ctx.dispatcher.dispatch({
    type: 'undoCreateCare',
    operationId: mintDiaperIds(ctx.ids).operationId,
    intentCapturedAt: { epochMs: ctx.nowMs() },
    eventId: minted.eventId,
    expectedRevisionId: minted.revisionId,
    deletionId: mintDiaperIds(ctx.ids).eventId,
    revisionId: mintDiaperIds(ctx.ids).revisionId,
  });
  assert.equal(undo.ok, true);
  const recent = await ctx.unitOfWork.run((uow) => uow.care.listRecent(childId, 5));
  assert.equal(recent.length, 0);
  await ctx.db.close();
});
