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

function presenceKey(databaseName: string): string {
  return `${DATABASE_PRESENCE_SECURE_STORE_ID}:${databaseName}`;
}

/** SecureStore-backed presence; loaded only from native composition paths. */
export async function createSecureStoreDatabasePresence(): Promise<DatabasePresence> {
  const SecureStore = await import('expo-secure-store');
  return {
    async isPresent(databaseName) {
      const value = await SecureStore.getItemAsync(presenceKey(databaseName));
      return value === '1';
    },
    async markPresent(databaseName) {
      await SecureStore.setItemAsync(presenceKey(databaseName), '1', {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    },
    async clear(databaseName) {
      await SecureStore.deleteItemAsync(presenceKey(databaseName));
    },
  };
}
