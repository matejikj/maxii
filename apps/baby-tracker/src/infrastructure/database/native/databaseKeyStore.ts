import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';
import { DatabaseKeyStoreError, type DatabaseKeyStore } from './databaseKeyStoreTypes';

export { DatabaseKeyStoreError } from './databaseKeyStoreTypes';
export type { DatabaseKeyStore } from './databaseKeyStoreTypes';

/**
 * The SQLCipher key is a random 32-byte secret held only in the platform vault
 * (iOS Keychain / Android Keystore-backed SecureStore). It must never live in
 * the JS bundle, analytics, or the database file itself.
 */
export const DATABASE_KEY_SECURE_STORE_ID = 'lumi.native.db-key.v1';

/**
 * AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY keeps night-time care usable after the
 * first unlock of a boot, while excluding the key from cloud keychain sync and
 * device-to-device transfer. Biometric gating is intentionally not required for
 * the sole non-recoverable DB key so a fingerprint change cannot brick history.
 */
export const DATABASE_KEY_ACCESSIBILITY = SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY;

const KEY_BYTES = 32;

function toHexKey(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

function fromHexKey(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new DatabaseKeyStoreError(
      'CORRUPT',
      'Stored database key has an unexpected shape; refusing silent reset.',
    );
  }
  return hexToBytes(hex);
}

/**
 * Creates a SecureStore-backed key vault. Callers must treat a missing vault as
 * a hard failure for private records, never as permission to invent a new key
 * that would orphan an existing ciphertext database.
 */
export function createSecureStoreDatabaseKeyStore(
  options: {
    /** When true, a missing key is an error instead of first-run creation. */
    requireExisting?: boolean;
  } = {},
): DatabaseKeyStore {
  return {
    async readDatabaseKey() {
      try {
        const available = await SecureStore.isAvailableAsync();
        if (!available) {
          throw new DatabaseKeyStoreError(
            'UNAVAILABLE',
            'Platform secure store is unavailable; private records stay locked.',
          );
        }
        const value = await SecureStore.getItemAsync(DATABASE_KEY_SECURE_STORE_ID);
        if (value == null) {
          return null;
        }
        return fromHexKey(value);
      } catch (error) {
        if (error instanceof DatabaseKeyStoreError) {
          throw error;
        }
        throw new DatabaseKeyStoreError(
          'READ_FAILED',
          'Unable to read the database key from the platform vault.',
        );
      }
    },

    async getOrCreateDatabaseKey() {
      const existing = await this.readDatabaseKey();
      if (existing != null) {
        return existing;
      }
      if (options.requireExisting) {
        throw new DatabaseKeyStoreError(
          'UNAVAILABLE',
          'Database key is missing and silent creation is disabled for this open.',
        );
      }
      const created = randomBytes(KEY_BYTES);
      try {
        await SecureStore.setItemAsync(DATABASE_KEY_SECURE_STORE_ID, toHexKey(created), {
          keychainAccessible: DATABASE_KEY_ACCESSIBILITY,
        });
      } catch {
        created.fill(0);
        throw new DatabaseKeyStoreError(
          'WRITE_FAILED',
          'Unable to persist the database key in the platform vault.',
        );
      }
      return created;
    },

    async clearDatabaseKey() {
      await SecureStore.deleteItemAsync(DATABASE_KEY_SECURE_STORE_ID);
    },
  };
}
