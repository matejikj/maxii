import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  DEFAULT_CHILD_DISPLAY_NAME,
  ensurePersonalChildProfile,
  mapBootstrapOpenError,
  markWelcomeCompleted,
  presentStartupPhase,
  readWelcomePending,
} from '../src/application/index.ts';
import {
  createInitialHistoryTabState,
  restoreHistoryContext,
  showTodayRecords,
} from '../src/app/navigation/historyTabState.ts';
import {
  createAppLinking,
  isOpaqueEntityId,
  safeEventDetailParams,
} from '../src/app/navigation/linking.ts';
import {
  personalModeBlocksOnMissingBackend,
  resolveRemoteServicesBoundary,
  shouldInitializeRemoteClients,
} from '../src/app/remoteServicesBoundary.ts';
import { AppError, asChildId, createChildProfile } from '../src/domain/index.ts';
import { createCryptoIdGenerator } from '../src/infrastructure/ids/cryptoIdGenerator.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import { DatabaseKeyStoreError } from '../src/infrastructure/database/native/databaseKeyStoreTypes.ts';
import {
  createWebUnitOfWorkFactory,
  openWebDatabase,
} from '../src/infrastructure/database/web/index.ts';

const now = { epochMs: 1_700_000_000_000 };
const clock = { now: () => now };
const ids = createCryptoIdGenerator();

async function openNative(name: string) {
  const db = await openPrivateDatabase({
    databaseName: name,
    opener: createMemoryEncryptedSqlOpener(),
    keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(),
    checkpointStore: createMemoryCheckpointStore(),
    now,
  });
  return {
    db,
    unitOfWork: createNativeUnitOfWorkFactory(db, { nowMs: () => now.epochMs }),
  };
}

test('native bootstrap creates one Miminko and refuses a second profile on restart', async () => {
  const first = await openNative('boot-once.db');
  const profileA = await ensurePersonalChildProfile(first.unitOfWork, {
    ids,
    clock,
    summaryTimeZone: 'Europe/Prague',
  });
  assert.equal(profileA.displayName, DEFAULT_CHILD_DISPLAY_NAME);
  assert.equal(profileA.birthDate, null);
  assert.equal(await readWelcomePending(first.unitOfWork), true);

  const profileB = await ensurePersonalChildProfile(first.unitOfWork, {
    ids,
    clock,
    summaryTimeZone: 'Europe/Prague',
  });
  assert.equal(profileB.childId, profileA.childId);
  const listed = await first.unitOfWork.run((uow) => uow.profiles.list());
  assert.equal(listed.length, 1);

  await markWelcomeCompleted(first.unitOfWork);
  assert.equal(await readWelcomePending(first.unitOfWork), false);
  await first.db.close();
});

test('web bootstrap mirrors single-profile personal mode', async () => {
  const stamp = Date.now();
  const handle = await openWebDatabase({
    databaseName: `boot-web-${stamp}`,
    lockDatabaseName: `boot-web-locks-${stamp}`,
    now,
  });
  const unitOfWork = createWebUnitOfWorkFactory(handle, { nowMs: () => now.epochMs });
  const first = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: 'UTC',
  });
  const second = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: 'UTC',
  });
  assert.equal(first.childId, second.childId);
  assert.equal((await unitOfWork.run((uow) => uow.profiles.list())).length, 1);
  await handle.close();
});

test('key and corrupt failures never invent an empty ready profile', () => {
  const keyFail = mapBootstrapOpenError(
    new DatabaseKeyStoreError('READ_FAILED', 'missing key'),
  );
  assert.equal(keyFail.phase, 'key_unavailable');
  assert.equal(keyFail.profile, null);
  assert.equal(presentStartupPhase(keyFail.phase).allowsCareEntry, false);

  const corrupt = mapBootstrapOpenError(
    new AppError('STORAGE', 'corrupt', { details: { reason: 'storage_corrupt' } }),
  );
  assert.equal(corrupt.phase, 'recovery_required');
  assert.equal(corrupt.profile, null);
});

test('history show-today clears filters while ordinary return keeps them', () => {
  const dirty = {
    ...createInitialHistoryTabState(),
    filter: 'care' as const,
    focusDate: '2024-01-01',
    scrollOffsetY: 120,
  };
  const today = showTodayRecords('2024-06-01');
  assert.equal(today.filter, 'all');
  assert.equal(today.focusDate, '2024-06-01');
  assert.equal(today.scrollOffsetY, 0);
  assert.deepEqual(restoreHistoryContext(dirty), dirty);
});

test('linking keeps opaque ids and rejects note/name query payloads', () => {
  assert.equal(isOpaqueEntityId('event_0123456789abcdef'), true);
  assert.equal(isOpaqueEntityId('Kuba'), false);
  assert.equal(safeEventDetailParams({ eventId: 'note-about-baby' }), null);
  assert.ok(safeEventDetailParams({ eventId: 'evt_0123456789abcdef' }));
  const linking = createAppLinking();
  assert.equal(linking.filter?.('lumi://history/event/abc?note=secret'), false);
  assert.equal(linking.filter?.('lumi://today'), true);
});

test('personal remote boundary stays cold without API or auth config', () => {
  const boundary = resolveRemoteServicesBoundary({});
  assert.equal(boundary.apiBaseUrl, null);
  assert.equal(boundary.authConfigured, false);
  assert.equal(shouldInitializeRemoteClients(boundary), false);
  assert.equal(personalModeBlocksOnMissingBackend(boundary), false);
});

test('optional profile update keeps the same child id', async () => {
  const { db, unitOfWork } = await openNative('boot-profile.db');
  const created = await ensurePersonalChildProfile(unitOfWork, {
    ids,
    clock,
    summaryTimeZone: 'Europe/Prague',
  });
  const renamed = createChildProfile({
    childId: created.childId,
    displayName: 'Mája',
    birthDate: null,
    summaryTimeZone: 'Europe/Prague',
  });
  await unitOfWork.run((uow) => uow.profiles.save(renamed));
  const listed = await unitOfWork.run((uow) => uow.profiles.list());
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.displayName, 'Mája');
  assert.equal(listed[0]?.childId, asChildId(created.childId));
  await db.close();
});
