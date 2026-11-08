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
  createCareOverviewCache,
  createCommandDispatcher,
  createReadModelInvalidator,
  loadDailyCareOverview,
} from '../src/application/index.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import { presentCareOverview } from '../src/features/care/presentCareOverview.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_overview_flow');

async function openNative(name: string) {
  const clock = Date.UTC(2023, 10, 14, 15, 0);
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
    '{}',
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const readModels = createReadModelInvalidator();
  const overviewCache = createCareOverviewCache();
  readModels.subscribe((topics) => {
    if (topics.includes('care') || topics.includes('revisions')) overviewCache.invalidate();
  });
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
    onCommitted: (topics) => readModels.notifyCommitted(topics),
  });
  return {
    db,
    unitOfWork,
    dispatcher,
    overviewCache,
    clock,
  };
}

test('care edit immediately changes the same overview projection', async () => {
  const ctx = await openNative('overview-edit.db');
  const occurredAt = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 12, 0) }, zone);
  const created = await ctx.dispatcher.dispatch({
    type: 'recordBottle',
    operationId: asOperationId('op_bottle_1'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('bottle_overview'),
    revisionId: asRevisionId('rev_bottle_1'),
    childId,
    occurredAt,
    contents: 'formula',
    amount: { value: 90, unit: 'ml' },
  });
  assert.equal(created.ok, true);

  const before = await ctx.unitOfWork.run((uow) =>
    loadDailyCareOverview(uow, {
      childId,
      day: { year: 2023, month: 11, day: 14 },
      summaryTimeZone: zone,
      nowEpochMs: ctx.clock,
      cache: ctx.overviewCache,
    }),
  );
  assert.equal(before.bottles.stats.recordedMl, 90);

  const live = await ctx.unitOfWork.run((uow) => uow.care.getById(asEntityId('bottle_overview')));
  assert.ok(live && live.type === 'bottle');
  const edited = await ctx.dispatcher.dispatch({
    type: 'recordBottle',
    operationId: asOperationId('op_bottle_edit'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: live.eventId,
    revisionId: asRevisionId('rev_bottle_2'),
    childId,
    occurredAt: live.occurredAt,
    contents: live.contents,
    amount: { value: 150, unit: 'ml' },
    expectedRevisionId: live.revisionId,
  });
  assert.equal(edited.ok, true);

  const after = await ctx.unitOfWork.run((uow) =>
    loadDailyCareOverview(uow, {
      childId,
      day: { year: 2023, month: 11, day: 14 },
      summaryTimeZone: zone,
      nowEpochMs: ctx.clock,
      cache: ctx.overviewCache,
    }),
  );
  assert.equal(after.bottles.stats.recordedMl, 150);
  assert.match(presentCareOverview(after).bottles, /150 ml/);
  await ctx.db.close();
});

test('overview cache rebuilds after invalidate without changing care rows', async () => {
  const ctx = await openNative('overview-cache.db');
  const occurredAt = zonedInstant({ epochMs: Date.UTC(2023, 10, 14, 12, 0) }, zone);
  await ctx.dispatcher.dispatch({
    type: 'recordDiaper',
    operationId: asOperationId('op_diaper_1'),
    intentCapturedAt: { epochMs: ctx.clock },
    eventId: asEntityId('diaper_overview'),
    revisionId: asRevisionId('rev_diaper_1'),
    childId,
    occurredAt,
    contents: 'wet',
  });
  const first = await ctx.unitOfWork.run((uow) =>
    loadDailyCareOverview(uow, {
      childId,
      day: { year: 2023, month: 11, day: 14 },
      summaryTimeZone: zone,
      nowEpochMs: ctx.clock,
      cache: ctx.overviewCache,
    }),
  );
  assert.equal(first.diapers.stats.diapers, 1);
  ctx.overviewCache.invalidate();
  const second = await ctx.unitOfWork.run((uow) =>
    loadDailyCareOverview(uow, {
      childId,
      day: { year: 2023, month: 11, day: 14 },
      summaryTimeZone: zone,
      nowEpochMs: ctx.clock,
      cache: ctx.overviewCache,
    }),
  );
  assert.equal(second.diapers.stats.diapers, 1);
  const stillThere = await ctx.unitOfWork.run((uow) =>
    uow.care.getById(asEntityId('diaper_overview')),
  );
  assert.ok(stillThere);
  await ctx.db.close();
});
