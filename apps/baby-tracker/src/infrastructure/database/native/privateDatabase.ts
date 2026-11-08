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

  // Prefer a true in-memory cipher probe on device. Node contract tests cannot
  // load expo-sqlite, so fall back to the injected opener with a safe file name.
  const assertCipher =
    options.assertCipher ??
    (async () => {
      try {
        const SQLite = await import('expo-sqlite');
        return assertSqlCipherAvailable(() => SQLite.openDatabaseSync(':memory:'));
      } catch (error) {
        if (!options.opener) {
          throw error;
        }
        const probeName = '__lumi_cipher_probe__';
        const probe = await options.opener.open(probeName);
        try {
          const row = await probe.getFirstAsync<{ cipher_version: string }>(
            'PRAGMA cipher_version',
          );
          if (row?.cipher_version == null || row.cipher_version.length === 0) {
            throw new EncryptedDatabaseError(
              'CIPHER_UNAVAILABLE',
              'SQLCipher is not present in this binary. Rebuild with expo-sqlite useSQLCipher enabled; refusing plaintext private storage.',
            );
          }
          return row.cipher_version;
        } finally {
          await probe.closeAsync();
          await options.opener.delete(probeName).catch(() => undefined);
        }
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
  const sessionKey = new Uint8Array(key);
  key.fill(0);
  const applySessionKey = async (target: SqlConnection): Promise<void> => {
    await target.execAsync(sqlCipherKeyPragma(sessionKey));
    await target.execAsync('PRAGMA foreign_keys = ON');
    await target.execAsync('PRAGMA journal_mode = WAL');
  };
  try {
    connection = await opener.open(databaseName);
    await applySessionKey(connection);
  } catch (error) {
    sessionKey.fill(0);
    if (error instanceof EncryptedDatabaseError) throw error;
    throw new EncryptedDatabaseError(
      'OPEN_FAILED',
      'Encrypted database rejected the key or failed during secure open.',
    );
  }

  try {
    await applyPendingMigrations(connection, {
      now,
      checkpointStore,
      databaseName,
      requireCheckpoint: true,
      afterCheckpoint: async () => {
        // serializeAsync can leave SQLCipher connections unreadable until re-keyed.
        await applySessionKey(connection);
      },
    });
    await assertMigrationChecksums(connection);
    await presence.markPresent(databaseName);
  } catch (error) {
    await connection.closeAsync().catch(() => undefined);
    throw error;
  } finally {
    sessionKey.fill(0);
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
