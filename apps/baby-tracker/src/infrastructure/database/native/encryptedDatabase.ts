import * as SQLite from 'expo-sqlite';
import {
  createSecureStoreDatabaseKeyStore,
  type DatabaseKeyStore,
} from './databaseKeyStore';
import {
  EncryptedDatabaseError,
  assertSqlCipherAvailable,
  sqlCipherKeyPragma,
} from './cipherGuard';

export { EncryptedDatabaseError, assertSqlCipherAvailable, sqlCipherKeyPragma } from './cipherGuard';
export { PRIVATE_DATABASE_NAME } from './databaseNames';
import { PRIVATE_DATABASE_NAME } from './databaseNames';

/**
 * Probe helpers for development builds. Product opens go through openPrivateDatabase.
 */
export type CipherProbeResult = {
  cipherVersion: string;
  databaseName: string;
  wroteMarker: string;
  readMarker: string;
  reopenedWithoutKeyRejected: boolean;
  reopenedWithKeySucceeded: boolean;
};

export async function openEncryptedDatabase(options: {
  databaseName?: string;
  keyStore?: DatabaseKeyStore;
  /** Injected open for tests; production uses expo-sqlite. */
  openDatabase?: (name: string) => Promise<SQLite.SQLiteDatabase> | SQLite.SQLiteDatabase;
}): Promise<SQLite.SQLiteDatabase> {
  await assertSqlCipherAvailable(() => SQLite.openDatabaseSync(':memory:'));
  const keyStore = options.keyStore ?? createSecureStoreDatabaseKeyStore();
  const key = await keyStore.getOrCreateDatabaseKey();
  const name = options.databaseName ?? PRIVATE_DATABASE_NAME;
  const open = options.openDatabase ?? ((dbName: string) => SQLite.openDatabaseAsync(dbName));
  let db: SQLite.SQLiteDatabase;
  try {
    db = await open(name);
  } catch (error) {
    key.fill(0);
    throw new EncryptedDatabaseError(
      'OPEN_FAILED',
      `Unable to open encrypted database file (${String(error)}).`,
    );
  }
  try {
    await db.execAsync(sqlCipherKeyPragma(key));
    await db.execAsync('PRAGMA foreign_keys = ON');
    // Touch the schema so a wrong key fails immediately instead of later.
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS lumi_storage_probe (id INTEGER PRIMARY KEY NOT NULL, marker TEXT NOT NULL)',
    );
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    if (error instanceof EncryptedDatabaseError) {
      throw error;
    }
    throw new EncryptedDatabaseError(
      'OPEN_FAILED',
      'Encrypted database rejected the key or failed during secure open.',
    );
  } finally {
    key.fill(0);
  }
}

/**
 * End-to-end probe for a development build: prove cipher presence, durable write,
 * reopen with the same vault key, and rejection when the key is omitted.
 */
export async function runEncryptedDatabaseProbe(options: {
  keyStore?: DatabaseKeyStore;
  databaseName?: string;
  openDatabase?: (name: string) => Promise<SQLite.SQLiteDatabase> | SQLite.SQLiteDatabase;
  deleteDatabase?: (name: string) => Promise<void>;
} = {}): Promise<CipherProbeResult> {
  const databaseName = options.databaseName ?? `lumi-cipher-probe-${Date.now()}.db`;
  const keyStore = options.keyStore ?? createSecureStoreDatabaseKeyStore();
  const openDatabase =
    options.openDatabase ?? ((name: string) => SQLite.openDatabaseAsync(name));
  const deleteDatabase =
    options.deleteDatabase ?? ((name: string) => SQLite.deleteDatabaseAsync(name));

  await deleteDatabase(databaseName).catch(() => undefined);

  const cipherVersion = await assertSqlCipherAvailable(() => SQLite.openDatabaseSync(':memory:'));

  const marker = `probe-${Date.now()}`;
  const first = await openEncryptedDatabase({
    databaseName,
    keyStore,
    openDatabase,
  });
  try {
    await first.runAsync(
      'INSERT INTO lumi_storage_probe (id, marker) VALUES (?, ?)',
      1,
      marker,
    );
  } finally {
    await first.closeAsync();
  }

  // Reopen without applying the key: ciphertext must stay unreadable.
  let reopenedWithoutKeyRejected = false;
  const unkeyed = await openDatabase(databaseName);
  try {
    await unkeyed.getFirstAsync('SELECT marker FROM lumi_storage_probe WHERE id = 1');
  } catch {
    reopenedWithoutKeyRejected = true;
  } finally {
    await unkeyed.closeAsync().catch(() => undefined);
  }

  const second = await openEncryptedDatabase({
    databaseName,
    keyStore,
    openDatabase,
  });
  let readMarker = '';
  try {
    const row = await second.getFirstAsync<{ marker: string }>(
      'SELECT marker FROM lumi_storage_probe WHERE id = 1',
    );
    if (row?.marker !== marker) {
      throw new EncryptedDatabaseError(
        'INTEGRITY_FAILED',
        'Encrypted database reopen did not return the committed marker.',
      );
    }
    readMarker = row.marker;
  } finally {
    await second.closeAsync();
    await deleteDatabase(databaseName).catch(() => undefined);
  }

  if (!reopenedWithoutKeyRejected) {
    throw new EncryptedDatabaseError(
      'INTEGRITY_FAILED',
      'Database remained readable without a key; cipher protection is not proven.',
    );
  }

  return {
    cipherVersion,
    databaseName,
    wroteMarker: marker,
    readMarker,
    reopenedWithoutKeyRejected,
    reopenedWithKeySucceeded: readMarker === marker,
  };
}
