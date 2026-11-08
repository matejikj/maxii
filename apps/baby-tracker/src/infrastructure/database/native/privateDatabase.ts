import type { FaultInjection } from '../../../domain';
import { AppError } from '../../../domain/errors';
import type { Instant } from '../../../domain/ports/clock';
import {
  EncryptedDatabaseError,
  assertSqlCipherAvailable,
  sqlCipherKeyPragma,
} from './cipherGuard';
import type { CheckpointStore } from './checkpoint';
import { createMemoryCheckpointStore } from './checkpoint';
import type { DatabasePresence } from './databasePresence';
import {
  DatabaseKeyStoreError,
  type DatabaseKeyStore,
} from './databaseKeyStoreTypes';
import { applyPendingMigrations, assertMigrationChecksums } from './migrations';
import type { SqlConnection, SqlDatabaseOpener } from './sqlConnection';
import { createChangeFeed, type ChangeFeed } from './changeFeed';
import { createWriteQueue, type WriteQueue } from './writeQueue';
import { PRIVATE_DATABASE_NAME } from './databaseNames';

export type PrivateDatabase = {
  readonly databaseName: string;
  readonly connection: SqlConnection;
  readonly writeQueue: WriteQueue;
  readonly changeFeed: ChangeFeed;
  close(): Promise<void>;
};

export type OpenPrivateDatabaseOptions = {
  databaseName?: string;
  keyStore?: DatabaseKeyStore;
  presence?: DatabasePresence;
  opener?: SqlDatabaseOpener;
  checkpointStore?: CheckpointStore;
  faults?: FaultInjection;
  now?: Instant;
  /** Injected cipher probe for tests. */
  assertCipher?: () => Promise<string>;
};

/**
 * Opens the personal encrypted diary, applies migrations, and refuses plaintext
 * fallbacks. A missing key over an already-present DB is a hard failure.
 */
export async function openPrivateDatabase(
  options: OpenPrivateDatabaseOptions = {},
): Promise<PrivateDatabase> {
  const databaseName = options.databaseName ?? PRIVATE_DATABASE_NAME;
  const keyStore =
    options.keyStore ??
    (await import('./databaseKeyStore')).createSecureStoreDatabaseKeyStore();
  const presence =
    options.presence ??
    (await (await import('./databasePresence')).createSecureStoreDatabasePresence());
  const checkpointStore = options.checkpointStore ?? createMemoryCheckpointStore();
  const now = options.now ?? { epochMs: Date.now() };
  const faults = options.faults;
  const opener = options.opener ?? (await import('./expoSqlOpener')).createExpoSqlOpener();

  if (faults?.shouldFail('keystore_read')) {
    throw new DatabaseKeyStoreError('READ_FAILED', 'Injected keystore read fault.');
  }
  if (faults?.shouldFail('storage_corrupt')) {
    throw new EncryptedDatabaseError('INTEGRITY_FAILED', 'Injected corrupt database fault.');
  }

  const assertCipher =
    options.assertCipher ??
    (async () => {
      if (options.opener == null) {
        const SQLite = await import('expo-sqlite');
        return assertSqlCipherAvailable(() => SQLite.openDatabaseSync(':memory:'));
      }
      const probe = await opener.open(':memory-cipher-probe:');
      try {
        const row = await probe.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
        if (row?.cipher_version == null || row.cipher_version.length === 0) {
          throw new EncryptedDatabaseError(
            'CIPHER_UNAVAILABLE',
            'SQLCipher is not present in this binary. Rebuild with expo-sqlite useSQLCipher enabled; refusing plaintext private storage.',
          );
        }
        return row.cipher_version;
      } finally {
        await probe.closeAsync();
        await opener.delete(':memory-cipher-probe:').catch(() => undefined);
      }
    });

  await assertCipher();

  const alreadyPresent =
    (await presence.isPresent(databaseName)) || (await opener.exists(databaseName));

  let key: Uint8Array;
  try {
    if (alreadyPresent) {
      const existing = await keyStore.readDatabaseKey();
      if (existing == null) {
        throw new EncryptedDatabaseError(
          'KEY_REQUIRED',
          'Private database exists but the vault key is missing; refusing silent key reset.',
        );
      }
      key = existing;
    } else {
      key = await keyStore.getOrCreateDatabaseKey();
    }
  } catch (error) {
    if (error instanceof EncryptedDatabaseError || error instanceof DatabaseKeyStoreError) {
      throw error;
    }
    throw new DatabaseKeyStoreError('READ_FAILED', 'Unable to resolve the database key.');
  }

  if (faults?.shouldFail('storage_full')) {
    key.fill(0);
    throw new AppError('STORAGE', 'Device storage is full', {
      details: { reason: 'storage_full' },
      retryable: true,
    });
  }
  if (faults?.shouldFail('storage_busy')) {
    key.fill(0);
    throw new AppError('STORAGE', 'Database is busy or locked', {
      details: { reason: 'storage_busy' },
      retryable: true,
    });
  }

  let connection: SqlConnection;
  try {
    connection = await opener.open(databaseName);
    await connection.execAsync(sqlCipherKeyPragma(key));
    await connection.execAsync('PRAGMA foreign_keys = ON');
    await connection.execAsync('PRAGMA journal_mode = WAL');
  } catch (error) {
    key.fill(0);
    if (error instanceof EncryptedDatabaseError) throw error;
    throw new EncryptedDatabaseError(
      'OPEN_FAILED',
      'Encrypted database rejected the key or failed during secure open.',
    );
  } finally {
    key.fill(0);
  }

  try {
    await applyPendingMigrations(connection, {
      now,
      checkpointStore,
      databaseName,
      requireCheckpoint: true,
    });
    await assertMigrationChecksums(connection);
    await presence.markPresent(databaseName);
  } catch (error) {
    await connection.closeAsync().catch(() => undefined);
    throw error;
  }

  return {
    databaseName,
    connection,
    writeQueue: createWriteQueue(),
    changeFeed: createChangeFeed(),
    async close() {
      await connection.closeAsync();
    },
  };
}
