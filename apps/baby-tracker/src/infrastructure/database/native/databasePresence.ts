export const DATABASE_PRESENCE_SECURE_STORE_ID = 'lumi.native.db-present.v1';

export type DatabasePresence = {
  isPresent(databaseName: string): Promise<boolean>;
  markPresent(databaseName: string): Promise<void>;
  clear(databaseName: string): Promise<void>;
};

export function createMemoryDatabasePresence(): DatabasePresence & {
  readonly flags: Set<string>;
} {
  const flags = new Set<string>();
  return {
    flags,
    async isPresent(databaseName) {
      return flags.has(databaseName);
    },
    async markPresent(databaseName) {
      flags.add(databaseName);
    },
    async clear(databaseName) {
      flags.delete(databaseName);
    },
  };
}

/**
 * SecureStore only allows [A-Za-z0-9._-]. Colons (and other punctuation) throw
 * on read/write and would brick first launch before a diary key is created.
 */
function presenceKey(databaseName: string): string {
  const safeName = databaseName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${DATABASE_PRESENCE_SECURE_STORE_ID}.${safeName}`;
}

/** SecureStore-backed presence; loaded only from native composition paths. */
export async function createSecureStoreDatabasePresence(): Promise<DatabasePresence> {
  const SecureStore = await import('expo-secure-store');
  return {
    async isPresent(databaseName) {
      try {
        const value = await SecureStore.getItemAsync(presenceKey(databaseName));
        return value === '1';
      } catch {
        // Invalid historical key shapes must not block first-run open.
        return false;
      }
    },
    async markPresent(databaseName) {
      await SecureStore.setItemAsync(presenceKey(databaseName), '1', {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    },
    async clear(databaseName) {
      try {
        await SecureStore.deleteItemAsync(presenceKey(databaseName));
      } catch {
        // Ignore delete failures for already-invalid key ids.
      }
    },
  };
}
