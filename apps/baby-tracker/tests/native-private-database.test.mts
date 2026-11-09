import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AppError,
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  createDiaryArchive,
  createDiaperEvent,
  createDraft,
  startSession,
  zonedInstant,
  asTimeZoneId,
} from '../src/domain/index.ts';
import { createControlledFaultInjection } from '../src/infrastructure/testing/controlledFaults.ts';
import { EncryptedDatabaseError } from '../src/infrastructure/database/native/cipherGuard.ts';
import { DatabaseKeyStoreError } from '../src/infrastructure/database/native/databaseKeyStoreTypes.ts';
import { createMemoryCheckpointStore } from '../src/infrastructure/database/native/checkpoint.ts';
import { createMemoryDatabasePresence } from '../src/infrastructure/database/native/databasePresence.ts';
import { createMemoryDatabaseKeyStore } from '../src/infrastructure/database/native/memoryKeyStore.ts';
import { createMemoryEncryptedSqlOpener } from '../src/infrastructure/database/native/memoryEncryptedSql.ts';
import { createNativeUnitOfWorkFactory } from '../src/infrastructure/database/native/nativeUnitOfWork.ts';
import { openPrivateDatabase } from '../src/infrastructure/database/native/privateDatabase.ts';
import { currentSchemaVersion } from '../src/infrastructure/database/native/migrations.ts';
import { SCHEMA_VERSION_5 } from '../src/infrastructure/database/native/schema/v5.ts';
import { DATABASE_KEY_LIFECYCLE } from '../src/infrastructure/database/native/keyLifecycle.ts';
import {
  assertExplicitPlaintextConversion,
  describePlaintextConversionPolicy,
} from '../src/infrastructure/database/native/plaintextConversion.ts';

const zone = asTimeZoneId('Europe/Prague');
const now = { epochMs: 1_700_000_000_000 };

async function openTestDb(name: string, overrides: Record<string, unknown> = {}) {
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const checkpointStore = createMemoryCheckpointStore();
  const db = await openPrivateDatabase({
    databaseName: name,
    opener,
    keyStore,
    presence,
    checkpointStore,
    now,
    assertCipher: async () => '4.5.0-test',
    ...overrides,
  });
  return { db, opener, keyStore, presence, checkpointStore };
}

test('private database migrates, commits care atomically, and notifies after success', async () => {
  const { db } = await openTestDb('care-commit.db');
  const childId = asChildId('child_1');
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Max',
    '2025-01-01',
    'Europe/Prague',
    '{}',
  );

  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => now.epochMs });
  const notifications: number[] = [];
  db.changeFeed.subscribe((note) => notifications.push(note.seq));

  const event = createDiaperEvent({
    eventId: asEntityId('diaper_1'),
    childId,
    revisionId: asRevisionId('rev_1'),
    occurredAt: zonedInstant(now, zone),
    contents: 'wet',
    createdAt: zonedInstant(now, zone),
  });

  await unitOfWork.run(async (uow) => {
    await uow.care.save(event);
    await uow.revisions.saveReceipt({
      operationId: asOperationId('op_1'),
      commandType: 'recordDiaper',
      intentCapturedAt: now,
      completedAt: now,
      entityIds: [event.eventId],
      revisionIds: [event.revisionId],
      resultCode: 'savedLocally',
    });
  });

  const loaded = await unitOfWork.run((uow) => uow.care.getById(event.eventId));
  assert.equal(loaded?.type, 'diaper');
  assert.equal(await currentSchemaVersion(db.connection), SCHEMA_VERSION_5);
  assert.equal(notifications.length, 1);
  await db.close();
});

test('commit fault rolls back care and receipt together', async () => {
  const { db } = await openTestDb('care-rollback.db');
  const childId = asChildId('child_1');
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Max',
    null,
    'Europe/Prague',
    '{}',
  );
  const faults = createControlledFaultInjection(new Set(['storage_commit']));
  const unitOfWork = createNativeUnitOfWorkFactory(db, { faults, nowMs: () => now.epochMs });
  const event = createDiaperEvent({
    eventId: asEntityId('diaper_2'),
    childId,
    revisionId: asRevisionId('rev_2'),
    occurredAt: zonedInstant(now, zone),
    contents: 'dirty',
    createdAt: zonedInstant(now, zone),
  });

  await assert.rejects(
    () =>
      unitOfWork.run(async (uow) => {
        await uow.care.save(event);
        await uow.revisions.saveReceipt({
          operationId: asOperationId('op_2'),
          commandType: 'recordDiaper',
          intentCapturedAt: now,
          completedAt: now,
          entityIds: [event.eventId],
          revisionIds: [event.revisionId],
          resultCode: 'savedLocally',
        });
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'storage_commit',
  );

  const loaded = await createNativeUnitOfWorkFactory(db).run((uow) => uow.care.getById(event.eventId));
  const receipt = await createNativeUnitOfWorkFactory(db).run((uow) =>
    uow.revisions.findReceipt(asOperationId('op_2')),
  );
  assert.equal(loaded, null);
  assert.equal(receipt, null);
  await db.close();
});

test('ciphertext stays unreadable without the key and lost keys do not reset', async () => {
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const checkpointStore = createMemoryCheckpointStore();
  const first = await openPrivateDatabase({
    databaseName: 'sealed.db',
    opener,
    keyStore,
    presence,
    checkpointStore,
    now,
    assertCipher: async () => '4.5.0-test',
  });
  await first.close();

  const locked = await opener.open('sealed.db');
  await assert.rejects(() => locked.getFirstAsync('SELECT version FROM schema_migrations'));
  await locked.closeAsync();

  await keyStore.clearDatabaseKey();
  await assert.rejects(
    () =>
      openPrivateDatabase({
        databaseName: 'sealed.db',
        opener,
        keyStore,
        presence,
        checkpointStore,
        now,
        assertCipher: async () => '4.5.0-test',
      }),
    (error: unknown) =>
      error instanceof EncryptedDatabaseError && error.code === 'KEY_REQUIRED',
  );
});

test('missing cipher and busy/full faults fail closed', async () => {
  await assert.rejects(
    () =>
      openPrivateDatabase({
        databaseName: 'plain.db',
        opener: createMemoryEncryptedSqlOpener({ cipherAvailable: false }),
        keyStore: createMemoryDatabaseKeyStore(),
        presence: createMemoryDatabasePresence(),
        checkpointStore: createMemoryCheckpointStore(),
        now,
        assertCipher: async () => {
          throw new EncryptedDatabaseError(
            'CIPHER_UNAVAILABLE',
            'SQLCipher is not present in this binary.',
          );
        },
      }),
    (error: unknown) =>
      error instanceof EncryptedDatabaseError && error.code === 'CIPHER_UNAVAILABLE',
  );

  await assert.rejects(
    () =>
      openPrivateDatabase({
        databaseName: 'full.db',
        opener: createMemoryEncryptedSqlOpener(),
        keyStore: createMemoryDatabaseKeyStore(),
        presence: createMemoryDatabasePresence(),
        checkpointStore: createMemoryCheckpointStore(),
        now,
        assertCipher: async () => '4.5.0-test',
        faults: createControlledFaultInjection(new Set(['storage_full'])),
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'storage_full',
  );

  await assert.rejects(
    () =>
      openPrivateDatabase({
        databaseName: 'busy.db',
        opener: createMemoryEncryptedSqlOpener(),
        keyStore: createMemoryDatabaseKeyStore(),
        presence: createMemoryDatabasePresence(),
        checkpointStore: createMemoryCheckpointStore(),
        now,
        assertCipher: async () => '4.5.0-test',
        faults: createControlledFaultInjection(new Set(['storage_busy'])),
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'storage_busy',
  );

  await assert.rejects(
    () =>
      openPrivateDatabase({
        databaseName: 'keyfault.db',
        opener: createMemoryEncryptedSqlOpener(),
        keyStore: createMemoryDatabaseKeyStore(),
        presence: createMemoryDatabasePresence(),
        checkpointStore: createMemoryCheckpointStore(),
        now,
        assertCipher: async () => '4.5.0-test',
        faults: createControlledFaultInjection(new Set(['keystore_read'])),
      }),
    (error: unknown) => error instanceof DatabaseKeyStoreError,
  );
});

test('failed migration keeps checkpoint and does not advance schema', async () => {
  const opener = createMemoryEncryptedSqlOpener();
  const keyStore = createMemoryDatabaseKeyStore();
  const presence = createMemoryDatabasePresence();
  const checkpointStore = createMemoryCheckpointStore();
  const db = await openPrivateDatabase({
    databaseName: 'migrate.db',
    opener,
    keyStore,
    presence,
    checkpointStore,
    now,
    assertCipher: async () => '4.5.0-test',
  });
  assert.equal(await currentSchemaVersion(db.connection), SCHEMA_VERSION_5);
  assert.equal(checkpointStore.records.size, 1);

  await assert.rejects(() =>
    db.connection.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO schema_migrations (version, checksum, applied_at_ms) VALUES (?, ?, ?)`,
        99,
        'bad',
        now.epochMs,
      );
      throw new Error('boom');
    }),
  );
  assert.equal(await currentSchemaVersion(db.connection), SCHEMA_VERSION_5);
  const checkpoint = await checkpointStore.restore([...checkpointStore.records.keys()][0]!);
  assert.ok(checkpoint.payload.byteLength > 0);
  await db.close();
});

test('sessions drafts and plaintext conversion policy stay explicit', async () => {
  const { db } = await openTestDb('session-draft.db');
  const childId = asChildId('child_1');
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Max',
    null,
    'Europe/Prague',
    '{}',
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db);
  await unitOfWork.run(async (uow) => {
    await uow.sessions.save(
      startSession({
        sessionId: asEntityId('sleep_1'),
        childId,
        kind: 'sleep',
        startedAt: zonedInstant(now, zone),
      }),
    );
    await uow.drafts.save(
      createDraft({
        draftId: asEntityId('draft_1'),
        childId,
        formType: 'bottle',
        originalEventTime: now,
        updatedAt: now,
        payload: { amount: null },
      }),
    );
  });
  const active = await unitOfWork.run((uow) => uow.sessions.getActive(childId, 'sleep'));
  assert.equal(active?.status, 'running');

  assert.throws(() =>
    assertExplicitPlaintextConversion({
      sourceDatabaseName: 'a.db',
      targetDatabaseName: 'a.db',
      acknowledgeDestructiveConversion: true,
    }),
  );
  assert.match(describePlaintextConversionPolicy(), /plugin flag alone/);
  assert.ok(DATABASE_KEY_LIFECYCLE.some((row) => row.situation === 'db_present_key_missing'));
  await db.close();
});

test('native UnitOfWork persists photo attachment metadata in SQLCipher tables', async () => {
  const { db } = await openTestDb('photo-attachments.db');
  const childId = asChildId('child_photo_1');
  const eventId = asEntityId('note_photo_1');
  await db.connection.runAsync(
    `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json) VALUES (?, ?, ?, ?, ?)`,
    childId,
    'Max',
    null,
    'Europe/Prague',
    '{}',
  );
  const unitOfWork = createNativeUnitOfWorkFactory(db, { nowMs: () => now.epochMs });
  const { asAttachmentId, asRenditionId, asAttachmentJobId } = await import(
    '../src/domain/attachments/types.ts'
  );
  const attachment = {
    attachmentId: asAttachmentId('att_1'),
    childId,
    eventId,
    hostEventType: 'note' as const,
    orderIndex: 0,
    caption: 'ráno',
    recordedBy: null,
    createdAtMs: now.epochMs,
    deletedAtMs: null,
    retainUntilMs: null,
    renditions: [
      {
        renditionId: asRenditionId('rend_1'),
        attachmentId: asAttachmentId('att_1'),
        role: 'display' as const,
        mime: 'image/jpeg' as const,
        width: 800,
        height: 600,
        byteLength: 1200,
        sha256: 'abc',
        normalizationVersion: 'lumi.photo-normalize.v1',
        blobKey: 'att/att_1/display.jpe.sealed',
        availability: 'durable' as const,
      },
    ],
  };
  await unitOfWork.run(async (uow) => {
    await uow.attachments.save(attachment);
    await uow.attachments.saveJob({
      jobId: asAttachmentJobId('job_1'),
      attachmentId: attachment.attachmentId,
      childId,
      eventId,
      state: 'linked',
      errorCode: null,
      sourceMime: 'image/jpeg',
      createdAtMs: now.epochMs,
      updatedAtMs: now.epochMs,
    });
  });

  const listed = await unitOfWork.run((uow) => uow.attachments.listForEvent(eventId));
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.caption, 'ráno');
  const job = await unitOfWork.run((uow) => uow.attachments.getJob(asAttachmentJobId('job_1')));
  assert.equal(job?.state, 'linked');

  await unitOfWork.run((uow) =>
    uow.attachments.softDelete({
      attachmentId: attachment.attachmentId,
      deletedAtMs: now.epochMs + 1,
      retainUntilMs: now.epochMs + 7 * 86_400_000,
    }),
  );
  const afterDelete = await unitOfWork.run((uow) => uow.attachments.listForEvent(eventId));
  assert.equal(afterDelete.length, 0);

  await unitOfWork.run(async (uow) => {
    await uow.diary.replace(
      createDiaryArchive({
        createdAtMs: now.epochMs,
        schemaCompatibility: SCHEMA_VERSION_5,
        profiles: [],
        careEvents: [],
        sessions: [],
        drafts: [],
        revisions: [],
        receipts: [],
        deletions: [],
        meta: [],
      }),
    );
  });
  const jobs = await db.connection.getAllAsync<{ job_id: string }>(
    'SELECT job_id FROM photo_attachment_jobs',
  );
  assert.equal(jobs.length, 0);
  await db.close();
});
