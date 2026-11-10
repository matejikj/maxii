import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import {
  asOperationId,
  createEmptyChildPrivateSyncState,
  enqueueChildPrivateOutbox,
  pendingChildPrivateOutbox,
} from '../../src/domain/index.ts';
import { createMemoryCheckpointStore } from '../../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { openPrivateDatabase } from '../../src/infrastructure/database/native/privateDatabase.ts';
import { currentSchemaVersion } from '../../src/infrastructure/database/native/migrations.ts';
import { SCHEMA_VERSION_9 } from '../../src/infrastructure/database/native/schema/v9.ts';
import { createSqlChildPrivateSyncStateStore } from '../../src/infrastructure/database/native/sqlChildPrivateSyncStateStore.ts';
import { createDexieChildPrivateSyncStateStore } from '../../src/infrastructure/database/web/dexieChildPrivateSyncStateStore.ts';
import { openWebDatabase } from '../../src/infrastructure/database/web/openWebDatabase.ts';
import { enqueueChildPrivateProjectUpsert } from '../../src/application/enqueueChildPrivateSyncChange.ts';
import {
  asActorId,
  asChildId,
  asEntityId,
  asRevisionId,
  type Project,
} from '../../src/domain/index.ts';

const NOW = { epochMs: 1_700_000_100_000 };

function privateProject(): Project {
  return {
    projectId: asEntityId('project-persist-1'),
    revisionId: asRevisionId('rev-persist-1'),
    scope: 'childPrivate',
    childId: asChildId('child-1'),
    ownerAppUserId: asActorId('child-owner-1'),
    creatorAppUserId: asActorId('child-owner-1'),
    familyId: null,
    templateRevisionId: null,
    title: 'Most',
    intent: 'Stavím',
    status: 'active',
    steps: [],
    reflection: 'secret-local',
    variantNotes: null,
    sourceNotes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

test('native schema migrates to v9 and SQL store survives reopen', async () => {
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const checkpointStore = createMemoryCheckpointStore();
  const db = await openPrivateDatabase({
    databaseName: 'child-private-sync-v9.db',
    opener,
    keyStore,
    presence,
    checkpointStore,
    now: NOW,
    assertCipher: async () => '4.5.0-test',
  });
  assert.equal(await currentSchemaVersion(db.connection), SCHEMA_VERSION_9);

  const store = createSqlChildPrivateSyncStateStore(db.connection);
  let state = createEmptyChildPrivateSyncState();
  state = enqueueChildPrivateOutbox(state, {
    ownerAppUserId: 'child-owner-1',
    operationId: asOperationId('op-sql-1'),
    commandType: 'child_private.project.upsert',
    entityId: 'project-persist-1',
    revisionId: 'rev-persist-1',
    payload: { title: 'Most', reflection: 'secret-local' },
    enqueuedAt: NOW,
  });
  await store.save(state);

  const reloaded = await store.load();
  assert.equal(reloaded.ownerAppUserId, 'child-owner-1');
  assert.equal(pendingChildPrivateOutbox(reloaded).length, 1);
  assert.equal(
    pendingChildPrivateOutbox(reloaded)[0]?.payload.reflection,
    'secret-local',
  );
  await db.close();
});

test('Dexie store persists child-private outbox without a remote API', async () => {
  const handle = await openWebDatabase({
    databaseName: `web-cp-sync-${Date.now()}`,
    lockDatabaseName: `web-cp-sync-lock-${Date.now()}`,
    now: NOW,
  });
  const store = createDexieChildPrivateSyncStateStore(handle.db);
  const result = await enqueueChildPrivateProjectUpsert({
    store,
    project: privateProject(),
    operationId: asOperationId('op-web-1'),
    enqueuedAt: NOW,
  });
  assert.equal(result.ok, true);
  const reloaded = await store.load();
  assert.equal(pendingChildPrivateOutbox(reloaded).length, 1);
  assert.equal(
    pendingChildPrivateOutbox(reloaded)[0]?.commandType,
    'child_private.project.upsert',
  );
  await handle.close();
});
