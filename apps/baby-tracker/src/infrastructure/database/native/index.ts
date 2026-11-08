export { DatabaseKeyStoreError } from './databaseKeyStoreTypes';
export type { DatabaseKeyStore } from './databaseKeyStoreTypes';
export { PRIVATE_DATABASE_NAME } from './databaseNames';
/** Lazy SecureStore vault — avoids loading Expo into Node contract tests. */
export async function loadSecureStoreDatabaseKeyStore() {
  return import('./databaseKeyStore');
}
export {
  EncryptedDatabaseError,
  assertSqlCipherAvailable,
  sqlCipherKeyPragma,
} from './cipherGuard';
export { openPrivateDatabase } from './privateDatabase';
export type { OpenPrivateDatabaseOptions, PrivateDatabase } from './privateDatabase';
export { createNativeUnitOfWorkFactory } from './nativeUnitOfWork';
export { createMemoryEncryptedSqlOpener } from './memoryEncryptedSql';
export { createMemoryDatabaseKeyStore } from './memoryKeyStore';
export {
  createMemoryDatabasePresence,
  DATABASE_PRESENCE_SECURE_STORE_ID,
} from './databasePresence';
export type { DatabasePresence } from './databasePresence';
export async function loadEncryptedDatabaseProbe() {
  return import('./encryptedDatabase');
}
export async function loadSecureStoreDatabasePresence() {
  return import('./databasePresence');
}
export { createMemoryCheckpointStore } from './checkpoint';
export type { CheckpointStore, CheckpointRecord } from './checkpoint';
export { applyPendingMigrations, currentSchemaVersion, MIGRATIONS } from './migrations';
export { SCHEMA_VERSION_1, SCHEMA_V1_CHECKSUM } from './schema/v1';
export { SCHEMA_VERSION_2, SCHEMA_V2_CHECKSUM } from './schema/v2';
export { DATABASE_KEY_LIFECYCLE } from './keyLifecycle';
export {
  assertExplicitPlaintextConversion,
  describePlaintextConversionPolicy,
} from './plaintextConversion';
export type { PlaintextConversionRequest } from './plaintextConversion';
export type { SqlConnection, SqlDatabaseOpener } from './sqlConnection';
export { createChangeFeed } from './changeFeed';
export type { ChangeFeed, ChangeNotification, ChangeTopic } from './changeFeed';
export { createWriteQueue } from './writeQueue';

/** Lazy so Node storage tests never load the Expo native SQLite binding. */
export async function loadExpoSqlOpener() {
  return import('./expoSqlOpener');
}
