import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addChildProfile,
  archiveChildProfile,
  buildReassignCareChildCommand,
  captureScopedDiaryArchive,
  createCommandDispatcher,
  ensurePersonalChildProfile,
  rebuildSearchAfterReassign,
  switchActiveChild,
  wipeSingleChildDiaryScope,
} from '../src/application/index.ts';
import {
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  assertSingleChildMigrationPreserved,
  createDiaperEvent,
  zonedInstant,
} from '../src/domain/index.ts';
import { createCryptoIdGenerator } from '../src/infrastructure/ids/cryptoIdGenerator.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';

const now = { epochMs: 1_700_000_100_000 };
const clock = { now: () => ({ epochMs: now.epochMs }) };
const ids = createCryptoIdGenerator();
const zone = asTimeZoneId('Europe/Prague');

async function openDiary(name: string) {
  const db = await openPrivateDatabase({
    databaseName: name,
    opener: createMemoryEncryptedSqlOpener(),
    keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(),
    checkpointStore: createMemoryCheckpointStore(),
    now,
  });
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => now.epochMs });
  return { db, unitOfWork };
}

test('adding a sibling preserves the original child id and care rows', async () => {
  const { db, unitOfWork } = await openDiary('multi-child-preserve.db');
  const first = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: zone,
  });
  const event = createDiaperEvent({
    eventId: asEntityId(ids.createId('event')),
    childId: first.childId,
    revisionId: asRevisionId(ids.createId('rev')),
    occurredAt: zonedInstant(now, zone),
    contents: 'wet',
    createdAt: zonedInstant(now, zone),
  });
  await unitOfWork.run((uow) => uow.care.save(event));

  const second = await addChildProfile(unitOfWork, {
    ids,
    displayName: 'Sourozenec',
    summaryTimeZone: zone,
    activate: true,
  });
  assert.notEqual(second.childId, first.childId);

  const after = await unitOfWork.run(async (uow) => ({
    profiles: await uow.profiles.list(),
    care: await uow.care.listRecent(first.childId, 10),
  }));
  assertSingleChildMigrationPreserved({
    beforeChildId: first.childId,
    afterProfiles: after.profiles,
    afterCareChildIds: after.care.map((row) => row.childId),
  });
  assert.equal(after.care.length, 1);
  assert.equal(after.care[0]?.eventId, event.eventId);
  await db.close();
});

test('context switch does not rewrite an existing care childId', async () => {
  const { db, unitOfWork } = await openDiary('multi-child-switch.db');
  const first = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: zone,
  });
  const second = await addChildProfile(unitOfWork, {
    ids,
    displayName: 'Bořek',
    summaryTimeZone: zone,
    activate: false,
  });
  const event = createDiaperEvent({
    eventId: asEntityId(ids.createId('event')),
    childId: first.childId,
    revisionId: asRevisionId(ids.createId('rev')),
    occurredAt: zonedInstant(now, zone),
    contents: 'both',
    createdAt: zonedInstant(now, zone),
  });
  await unitOfWork.run((uow) => uow.care.save(event));
  await switchActiveChild(unitOfWork, second.childId);
  const still = await unitOfWork.run((uow) => uow.care.getById(event.eventId));
  assert.equal(still?.childId, first.childId);
  await db.close();
});

test('conscious reassign moves care under a new child and keeps event id', async () => {
  const { db, unitOfWork } = await openDiary('multi-child-reassign.db');
  const first = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: zone,
  });
  const second = await addChildProfile(unitOfWork, {
    ids,
    displayName: 'Bořek',
    summaryTimeZone: zone,
    activate: false,
  });
  const event = createDiaperEvent({
    eventId: asEntityId(ids.createId('event')),
    childId: first.childId,
    revisionId: asRevisionId(ids.createId('rev')),
    occurredAt: zonedInstant(now, zone),
    contents: 'wet',
    createdAt: zonedInstant(now, zone),
    recordedBy: null,
  });
  await unitOfWork.run((uow) => uow.care.save(event));
  const profiles = await unitOfWork.run((uow) => uow.profiles.list());
  const commands = createCommandDispatcher({ unitOfWork, clock });
  const command = buildReassignCareChildCommand({
    event,
    targetChildId: second.childId,
    profiles,
    operationId: ids.createId('op'),
    revisionId: ids.createId('rev'),
    intentCapturedAtMs: now.epochMs,
  });
  const result = await commands.dispatch(command);
  assert.equal(result.ok, true);
  await rebuildSearchAfterReassign(unitOfWork, first.childId, second.childId);
  const moved = await unitOfWork.run((uow) => uow.care.getById(event.eventId));
  assert.equal(moved?.childId, second.childId);
  assert.equal(moved?.eventId, event.eventId);
  const firstPage = await unitOfWork.run((uow) => uow.care.listRecent(first.childId, 10));
  const secondPage = await unitOfWork.run((uow) => uow.care.listRecent(second.childId, 10));
  assert.equal(firstPage.length, 0);
  assert.equal(secondPage.length, 1);
  await db.close();
});

test('scoped export and wipe keep the sibling diary intact', async () => {
  const { db, unitOfWork } = await openDiary('multi-child-scope.db');
  const first = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: zone,
  });
  const second = await addChildProfile(unitOfWork, {
    ids,
    displayName: 'Bořek',
    summaryTimeZone: zone,
    activate: true,
  });
  await unitOfWork.run(async (uow) => {
    await uow.care.save(
      createDiaperEvent({
        eventId: asEntityId(ids.createId('event')),
        childId: first.childId,
        revisionId: asRevisionId(ids.createId('rev')),
        occurredAt: zonedInstant(now, zone),
        contents: 'wet',
        createdAt: zonedInstant(now, zone),
      }),
    );
    await uow.care.save(
      createDiaperEvent({
        eventId: asEntityId(ids.createId('event')),
        childId: second.childId,
        revisionId: asRevisionId(ids.createId('rev')),
        occurredAt: zonedInstant(now, zone),
        contents: 'dirty',
        createdAt: zonedInstant(now, zone),
      }),
    );
  });

  const scoped = await captureScopedDiaryArchive({
    unitOfWork,
    nowMs: now.epochMs,
    scope: { kind: 'one_child', childId: first.childId },
  });
  assert.equal(scoped.profiles.length, 1);
  assert.equal(scoped.careEvents.length, 1);
  assert.equal(scoped.careEvents[0]?.childId, first.childId);

  const wiped = await wipeSingleChildDiaryScope({
    unitOfWork,
    childId: first.childId,
    nowMs: now.epochMs + 1,
  });
  assert.equal(wiped.removedCareEvents, 1);
  const remaining = await unitOfWork.run(async (uow) => ({
    profiles: await uow.profiles.list(),
    firstCare: await uow.care.listRecent(first.childId, 10),
    secondCare: await uow.care.listRecent(second.childId, 10),
  }));
  assert.equal(
    remaining.profiles.some((row) => row.childId === first.childId),
    false,
  );
  assert.equal(remaining.firstCare.length, 0);
  assert.equal(remaining.secondCare.length, 1);

  await archiveChildProfile(unitOfWork, {
    childId: second.childId,
    archivedAtMs: now.epochMs + 2,
  }).then(
    () => {
      throw new Error('expected archive of last active child to fail');
    },
    (error: unknown) => {
      assert.ok(error instanceof Error);
    },
  );
  await db.close();
});

test('personal bootstrap still refuses inventing a second Miminko on restart', async () => {
  const { db, unitOfWork } = await openDiary('multi-child-boot.db');
  const first = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: zone,
  });
  const again = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: zone,
  });
  assert.equal(again.childId, first.childId);
  const listed = await unitOfWork.run((uow) => uow.profiles.list());
  assert.equal(listed.length, 1);
  await db.close();
});
