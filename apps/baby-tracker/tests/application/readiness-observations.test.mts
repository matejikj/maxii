import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asChildId } from '../../src/domain/index.ts';
import {
  clearReadinessObservation,
  loadReadinessByKey,
  setReadinessObservation,
} from '../../src/application/readinessObservations.ts';
import { createMemoryCheckpointStore } from '../../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../../src/infrastructure/database/native/privateDatabase.ts';

test('readiness observations persist yes/no and clear back to unknown', async () => {
  const opener = createMemoryEncryptedSqlOpener();
  const db = await openPrivateDatabase({
    databaseName: 'readiness-meta',
    opener,
    keyStore: createMemoryDatabaseKeyStore(),
    presence: createMemoryDatabasePresence(),
    checkpointStore: createMemoryCheckpointStore(),
    now: { epochMs: Date.UTC(2025, 2, 1, 12, 0, 0) },
  });
  const unitOfWork = createNativeUnitOfWorkFactory(db, {
    nowMs: () => Date.UTC(2025, 2, 1, 12, 0, 0),
  });
  const childId = asChildId('child_readiness');

  try {
    assert.deepEqual(await loadReadinessByKey(unitOfWork, childId), {});

    const confirmed = await setReadinessObservation(unitOfWork, {
      childId,
      key: 'grasp',
      state: 'yes',
    });
    assert.equal(confirmed.grasp, 'yes');

    const denied = await setReadinessObservation(unitOfWork, {
      childId,
      key: 'floorSit',
      state: 'no',
    });
    assert.equal(denied.grasp, 'yes');
    assert.equal(denied.floorSit, 'no');

    const cleared = await clearReadinessObservation(unitOfWork, {
      childId,
      key: 'grasp',
    });
    assert.equal(cleared.grasp, undefined);
    assert.equal(cleared.floorSit, 'no');
    assert.deepEqual(await loadReadinessByKey(unitOfWork, childId), { floorSit: 'no' });
  } finally {
    db.close();
  }
});
