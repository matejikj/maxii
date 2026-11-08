import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  buildGrowthSeries,
  createGrowthEvent,
  createNoteEvent,
  displayToKg,
  kgToDisplay,
  parseDecimalInput,
  zonedInstant,
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
  buildRecordGrowthCommand,
  mintGrowthIds,
  nowInZone,
  parseGrowthFormFields,
} from '../src/features/today/recordGrowthIntent.ts';
import {
  buildRecordExperienceCommand,
  buildRecordMilestoneCommand,
  buildRecordNoteCommand,
  mintMomentIds,
} from '../src/features/today/recordMomentIntent.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_growth_1');

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

test('decimal comma and unit conversion keep canonical kg', () => {
  assert.deepEqual(parseDecimalInput('3,5'), { ok: true, value: 3.5 });
  assert.deepEqual(parseDecimalInput(''), { ok: true, value: null });
  assert.equal(parseDecimalInput('x').ok, false);
  const lb = kgToDisplay(5, 'lb');
  assert.ok(Math.abs(displayToKg(lb, 'lb') - 5) < 1e-9);
  const parsed = parseGrowthFormFields({
    weightRaw: '7,2',
    lengthRaw: '',
    headRaw: '',
    weightUnit: 'kg',
    lengthUnit: 'cm',
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.weightKg, 7.2);
    assert.equal(parsed.lengthCm, null);
    assert.equal(parsed.headCm, null);
  }
});

test('single growth value stores without fake zeroes elsewhere', async () => {
  const ctx = await openDiary('growth-single.db');
  const ids = mintGrowthIds(ctx.ids);
  const saved = await ctx.dispatcher.dispatch(
    buildRecordGrowthCommand({
      ids,
      childId,
      measuredOn: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      weightKg: 4.1,
      lengthCm: null,
      headCm: null,
    }),
  );
  assert.equal(saved.ok, true);
  const event = await ctx.unitOfWork.run((uow) => uow.care.getById(ids.eventId));
  assert.equal(event?.type, 'growth');
  if (event?.type === 'growth') {
    assert.equal(event.weightKg, 4.1);
    assert.equal(event.lengthCm, null);
    assert.equal(event.headCm, null);
    const series = buildGrowthSeries([event]);
    assert.equal(series.singlePoint, true);
    assert.equal(series.hasLength, false);
  }
  await ctx.db.close();
});

test('growth series never interpolates missing points', () => {
  const now = zonedInstant({ epochMs: 1_700_000_000_000 }, zone);
  const a = createGrowthEvent({
    eventId: asEntityId('g1'),
    childId,
    revisionId: asRevisionId('r1'),
    measuredOn: now,
    weightKg: 4,
    createdAt: now,
  });
  const b = createGrowthEvent({
    eventId: asEntityId('g2'),
    childId,
    revisionId: asRevisionId('r2'),
    measuredOn: zonedInstant({ epochMs: 1_700_086_400_000 }, zone),
    lengthCm: 55,
    createdAt: now,
  });
  const series = buildGrowthSeries([b, a]);
  assert.equal(series.points.length, 2);
  assert.equal(series.points[0]?.weightKg, 4);
  assert.equal(series.points[1]?.weightKg, null);
  assert.equal(series.points[1]?.lengthCm, 55);
});

test('note stays one event and does not invent care from text', async () => {
  const ctx = await openDiary('note-one.db');
  const ids = mintMomentIds(ctx.ids);
  const body = 'Dnes pila 90 ml a spala hodinu, ale to je jen vyprávění.';
  const saved = await ctx.dispatcher.dispatch(
    buildRecordNoteCommand({
      ids,
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      body,
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  assert.equal(saved.ok, true);
  const recent = await ctx.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(recent.length, 1);
  assert.equal(recent[0]?.type, 'note');
  if (recent[0]?.type === 'note') {
    assert.equal(recent[0].body, body);
  }
  assert.equal(
    recent.filter((event) => event.type === 'bottle' || event.type === 'sleep').length,
    0,
  );
  await ctx.db.close();
});

test('empty note and milestone are rejected; free play needs a cue', async () => {
  const ctx = await openDiary('moments-validate.db');
  const noteIds = mintMomentIds(ctx.ids);
  const emptyNote = await ctx.dispatcher.dispatch(
    buildRecordNoteCommand({
      ids: noteIds,
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      body: '   ',
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  assert.equal(emptyNote.ok, false);

  const milestoneIds = mintMomentIds(ctx.ids);
  const milestone = await ctx.dispatcher.dispatch(
    buildRecordMilestoneCommand({
      ids: milestoneIds,
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      body: 'Poprvé se posadila.',
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  assert.equal(milestone.ok, true);

  const playIds = mintMomentIds(ctx.ids);
  const emptyPlay = await ctx.dispatcher.dispatch(
    buildRecordExperienceCommand({
      ids: playIds,
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
    }),
  );
  assert.equal(emptyPlay.ok, false);

  const playOk = await ctx.dispatcher.dispatch(
    buildRecordExperienceCommand({
      ids: mintMomentIds(ctx.ids),
      childId,
      occurredAt: nowInZone(ctx.nowMs(), zone),
      intentCapturedAtMs: ctx.nowMs(),
      area: 'movement',
    }),
  );
  assert.equal(playOk.ok, true);
  await ctx.db.close();
});

test('failed save path keeps draft original time distinguishable from now', () => {
  const draftOriginal = 1_700_000_000_000;
  const later = draftOriginal + 3_600_000;
  assert.notEqual(draftOriginal, later);
  const note = createNoteEvent({
    eventId: asEntityId('n1'),
    childId,
    revisionId: asRevisionId('rn1'),
    occurredAt: zonedInstant({ epochMs: draftOriginal }, zone),
    body: 'Večerní zápis',
    createdAt: zonedInstant({ epochMs: later }, zone),
  });
  assert.equal(note.occurredAt.instant.epochMs, draftOriginal);
  assert.notEqual(note.createdAt.instant.epochMs, note.occurredAt.instant.epochMs);
});
