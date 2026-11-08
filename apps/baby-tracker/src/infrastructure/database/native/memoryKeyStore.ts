import { randomBytes } from '@noble/hashes/utils.js';
import { DatabaseKeyStoreError, type DatabaseKeyStore } from './databaseKeyStoreTypes';

export function createMemoryDatabaseKeyStore(
  options: { requireExisting?: boolean; initialKey?: Uint8Array | null } = {},
): DatabaseKeyStore & { readonly store: { key: Uint8Array | null } } {
  const store = { key: options.initialKey ? new Uint8Array(options.initialKey) : null };
  return {
    store,
    async readDatabaseKey() {
      return store.key ? new Uint8Array(store.key) : null;
    },
    async getOrCreateDatabaseKey() {
      if (store.key != null) return new Uint8Array(store.key);
      if (options.requireExisting) {
        throw new DatabaseKeyStoreError(
          'UNAVAILABLE',
          'Database key is missing and silent creation is disabled for this open.',
        );
      }
      store.key = randomBytes(32);
      return new Uint8Array(store.key);
    },
    async clearDatabaseKey() {
      if (store.key) store.key.fill(0);
      store.key = null;
    },
  };
}
