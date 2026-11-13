import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asChildId, createChildProfile } from '../src/domain/index.ts';
import {
  buildParentRecommendationContext,
  candidatesFromRevisions,
  ensureDailyRecommendationSet,
  hideDailyRecommendationForCare,
  openDailyRecommendation,
  readDailyRecommendationSet,
  replaceDailyRecommendationSet,
} from '../src/application/index.ts';
import { sampleProductRevision } from '../src/content/fixtures/devFixtureSet.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';

const childId = asChildId('child_rec_1');
const localDay = { year: 2026, month: 3, day: 8 };

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
    now: { epochMs: 1_700_000_000_000 },
  });
  const profile = createChildProfile({
    childId,
    displayName: 'Miminko',
    birthDate: { year: 2026, month: 1, day: 1 },
    summaryTimeZone: 'Europe/Prague',
  });
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    profile.displayName,
    '2026-01-01',
    'Europe/Prague',
    JSON.stringify(profile),
  );
  return createNativeUnitOfWorkFactory(db, {
    nowMs: () => 1_700_000_000_000,
  });
}

function catalog() {
  const revisions = [
    sampleProductRevision(),
    sampleProductRevision({
      activityId: 'act.soft-rhyme',
      revisionId: 'act.soft-rhyme.r1',
      title: 'Tichá říkanka',
      primaryArea: 'speech',
      relatedAreas: ['creationRhythm'],
      topicIds: ['speech.songs'],
      materials: [],
      ageMonths: { fromInclusive: 0, toInclusive: 12 },
      suitability: [
        { kind: 'age_months', fromInclusive: 0, toInclusive: 12 },
        { kind: 'materials_none' },
      ],
    }),
    sampleProductRevision({
      activityId: 'act.reach',
      revisionId: 'act.reach.r1',
      title: 'Sahání',
      primaryArea: 'movement',
      relatedAreas: [],
      topicIds: ['move.reach'],
      materials: [],
      ageMonths: { fromInclusive: 0, toInclusive: 12 },
      suitability: [
        { kind: 'age_months', fromInclusive: 0, toInclusive: 12 },
        { kind: 'materials_none' },
      ],
    }),
  ];
  return {
    contentVersion: 'test-catalog-v1',
    candidates: candidatesFromRevisions(revisions),
  };
}

test('Today and Development read the same stored daily set', async () => {
  const unitOfWork = await openNative('rec-shared');
  const profile = createChildProfile({
    childId,
    displayName: 'Miminko',
    birthDate: { year: 2026, month: 1, day: 1 },
    summaryTimeZone: 'Europe/Prague',
  });
  const context = buildParentRecommendationContext(profile, localDay, {
    withoutMaterialsOnly: true,
  });
  const first = await ensureDailyRecommendationSet(unitOfWork, {
    childId,
    localDay,
    context,
    catalog: catalog(),
    nowSeed: 'seed-a',
  });
  const again = await ensureDailyRecommendationSet(unitOfWork, {
    childId,
    localDay,
    context,
    catalog: catalog(),
    nowSeed: 'seed-b',
  });
  assert.equal(first.set.recommendationSetId, again.set.recommendationSetId);
  assert.deepEqual(
    first.set.offers.map((offer) => offer.activityId),
    again.set.offers.map((offer) => offer.activityId),
  );
  const fromToday = await readDailyRecommendationSet(unitOfWork, { childId, localDay });
  const fromDevelopment = await readDailyRecommendationSet(unitOfWork, { childId, localDay });
  assert.equal(fromToday?.set.recommendationSetId, fromDevelopment?.set.recommendationSetId);
});

test('opening an offer does not invent experiences; care-only hides without reshuffle debt', async () => {
  const unitOfWork = await openNative('rec-open-hide');
  const profile = createChildProfile({
    childId,
    displayName: 'Miminko',
    birthDate: { year: 2026, month: 1, day: 1 },
    summaryTimeZone: 'Europe/Prague',
  });
  const context = buildParentRecommendationContext(profile, localDay, {
    withoutMaterialsOnly: true,
  });
  await ensureDailyRecommendationSet(unitOfWork, {
    childId,
    localDay,
    context,
    catalog: catalog(),
    nowSeed: 'seed-open',
  });
  const opened = await openDailyRecommendation(unitOfWork, { childId, localDay });
  assert.equal(opened?.set.status, 'opened');
  assert.ok((opened?.set.offers.length ?? 0) > 0);
  const careEvents = await unitOfWork.run((uow) => uow.care.listRecent(childId, 10));
  assert.equal(careEvents.length, 0);

  const hidden = await hideDailyRecommendationForCare(unitOfWork, { childId, localDay });
  assert.equal(hidden?.set.status, 'hidden');
  const stillThere = await readDailyRecommendationSet(unitOfWork, { childId, localDay });
  assert.equal(stillThere?.set.status, 'hidden');
  assert.equal(stillThere?.set.offers.length, opened?.set.offers.length);
});

test('explicit replace builds a new set id while keeping offline determinism', async () => {
  const unitOfWork = await openNative('rec-replace');
  const profile = createChildProfile({
    childId,
    displayName: 'Miminko',
    birthDate: { year: 2026, month: 1, day: 1 },
    summaryTimeZone: 'Europe/Prague',
  });
  const context = buildParentRecommendationContext(profile, localDay, {
    withoutMaterialsOnly: true,
    interestAreas: ['speech'],
  });
  const first = await ensureDailyRecommendationSet(unitOfWork, {
    childId,
    localDay,
    context,
    catalog: catalog(),
    nowSeed: 'seed-1',
  });
  const replaced = await replaceDailyRecommendationSet(unitOfWork, {
    childId,
    localDay,
    context,
    catalog: catalog(),
    nowSeed: 'seed-2',
  });
  assert.notEqual(first.set.recommendationSetId, replaced.set.recommendationSetId);
  assert.equal(replaced.set.rulesVersion, first.set.rulesVersion);
});

test('sleep running only changes presentation to later', async () => {
  const unitOfWork = await openNative('rec-sleep');
  const profile = createChildProfile({
    childId,
    displayName: 'Miminko',
    birthDate: { year: 2026, month: 1, day: 1 },
    summaryTimeZone: 'Europe/Prague',
  });
  const awake = buildParentRecommendationContext(profile, localDay, {
    withoutMaterialsOnly: true,
    sleepRunning: false,
  });
  const view = await ensureDailyRecommendationSet(unitOfWork, {
    childId,
    localDay,
    context: awake,
    catalog: catalog(),
    nowSeed: 'seed-sleep',
  });
  assert.equal(view.presentation, 'now');
  const sleeping = await readDailyRecommendationSet(unitOfWork, {
    childId,
    localDay,
    sleepRunning: true,
  });
  assert.equal(sleeping?.presentation, 'later');
  assert.deepEqual(
    sleeping?.set.offers.map((offer) => offer.activityId),
    view.set.offers.map((offer) => offer.activityId),
  );
});
