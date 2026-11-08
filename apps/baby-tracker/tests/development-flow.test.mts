import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  createChildProfile,
  todayInZone,
  zonedInstant,
} from '../src/domain/index.ts';
import {
  addFavorite,
  buildParentRecommendationContext,
  candidatesFromRevisions,
  createCommandDispatcher,
  ensureDailyRecommendationSet,
  findTodaysExperienceForActivity,
  listFavorites,
  loadWeeklyDevelopmentGlance,
  removeFavorite,
} from '../src/application/index.ts';
import {
  LOCAL_LIBRARY_CONTENT_VERSION,
  LOCAL_LIBRARY_REVISIONS,
} from '../src/content/index.ts';
import { buildRecordExperienceCommand, mintMomentIds } from '../src/features/today/recordMomentIntent.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';

const childId = asChildId('child_dev_1');
/** 1 March 2025 — with DOB 2025-01-01 the child is about two months old. */
const clock = Date.UTC(2025, 2, 1, 12, 0, 0);

async function openNative(name: string) {
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
  const profile = createChildProfile({
    childId,
    displayName: 'Miminko',
    birthDate: { year: 2025, month: 1, day: 1 },
    summaryTimeZone: 'Europe/Prague',
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    profile.displayName,
    '2025-01-01',
    'Europe/Prague',
    JSON.stringify(profile),
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => clock });
  const dispatcher = createCommandDispatcher({
    unitOfWork,
    clock: { now: () => ({ epochMs: clock }) },
  });
  return { unitOfWork, dispatcher, profile, close: () => db.close() };
}

test('recording a catalog try creates one experience; same ids are not two games', async () => {
  const ctx = await openNative('dev-try');
  const zone = asTimeZoneId('Europe/Prague');
  const revision = LOCAL_LIBRARY_REVISIONS[1]!;
  const ids = mintMomentIds({
    createId: (prefix) => `${prefix}_same`,
  });
  const command = buildRecordExperienceCommand({
    ids,
    childId,
    occurredAt: zonedInstant({ epochMs: clock }, zone),
    intentCapturedAtMs: clock,
    title: revision.title,
    area: revision.primaryArea,
    activityId: revision.activityId,
    activityRevisionId: revision.revisionId,
  });
  const first = await ctx.dispatcher.dispatch(command);
  const second = await ctx.dispatcher.dispatch(command);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  const events = await ctx.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(events.filter((event) => event.type === 'experience').length, 1);

  const againIds = {
    operationId: asOperationId('op_again'),
    eventId: asEntityId('evt_again'),
    revisionId: asRevisionId('rev_again'),
  };
  const again = await ctx.dispatcher.dispatch(
    buildRecordExperienceCommand({
      ids: againIds,
      childId,
      occurredAt: zonedInstant({ epochMs: clock + 1 }, zone),
      intentCapturedAtMs: clock + 1,
      title: revision.title,
      area: revision.primaryArea,
      activityId: revision.activityId,
      activityRevisionId: revision.revisionId,
    }),
  );
  assert.equal(again.ok, true);
  const after = await ctx.unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(after.filter((event) => event.type === 'experience').length, 2);
  ctx.close();
});

test('favorites are bookmarks and do not bypass recommendation eligibility', async () => {
  const ctx = await openNative('dev-fav');
  await addFavorite(ctx.unitOfWork, {
    childId,
    activityId: 'act.texture-touch',
    nowMs: clock,
  });
  const listed = await listFavorites(ctx.unitOfWork, childId);
  assert.equal(listed.length, 1);
  const zone = asTimeZoneId('Europe/Prague');
  const localDay = todayInZone({ epochMs: clock }, zone);
  // Age ~2 months — texture activity starts at 3 months, so favorite must stay out.
  const context = buildParentRecommendationContext(ctx.profile, localDay, {
    favoriteActivityIds: ['act.texture-touch'],
    availableMaterials: ['látka'],
  });
  const set = await ensureDailyRecommendationSet(ctx.unitOfWork, {
    childId,
    localDay,
    context,
    catalog: {
      contentVersion: LOCAL_LIBRARY_CONTENT_VERSION,
      candidates: candidatesFromRevisions(LOCAL_LIBRARY_REVISIONS),
    },
    nowSeed: 'fav-seed',
  });
  assert.equal(
    set.set.offers.some((offer) => offer.activityId === 'act.texture-touch'),
    false,
  );
  await removeFavorite(ctx.unitOfWork, { childId, activityId: 'act.texture-touch' });
  assert.equal((await listFavorites(ctx.unitOfWork, childId)).length, 0);
  ctx.close();
});

test('weekly glance and today activity lookup stay offline over the diary', async () => {
  const ctx = await openNative('dev-glance');
  const zone = asTimeZoneId('Europe/Prague');
  const revision = LOCAL_LIBRARY_REVISIONS[0]!;
  await ctx.dispatcher.dispatch(
    buildRecordExperienceCommand({
      ids: {
        operationId: asOperationId('op_g1'),
        eventId: asEntityId('evt_g1'),
        revisionId: asRevisionId('rev_g1'),
      },
      childId,
      occurredAt: zonedInstant({ epochMs: clock }, zone),
      intentCapturedAtMs: clock,
      title: revision.title,
      area: revision.primaryArea,
      activityId: revision.activityId,
      activityRevisionId: revision.revisionId,
      reaction: 'liked',
    }),
  );
  const localDay = todayInZone({ epochMs: clock }, zone);
  const glance = await loadWeeklyDevelopmentGlance(ctx.unitOfWork, {
    childId,
    endDay: localDay,
    summaryTimeZone: zone,
  });
  assert.equal(glance.insufficientData, false);
  assert.ok(glance.statements.some((item) => item.evidenceEventIds.includes('evt_g1')));
  const today = await findTodaysExperienceForActivity(ctx.unitOfWork, {
    childId,
    activityId: revision.activityId,
    day: localDay,
    summaryTimeZone: zone,
  });
  assert.equal(today?.eventId, 'evt_g1');
  ctx.close();
});
