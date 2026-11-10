import type { ChildPrivateSyncStateStore } from '../domain/sync/childPrivateSyncStateStore';
import { createMemoryChildPrivateSyncStateStore } from '../domain/sync/childPrivateSyncStateStore';
import { createSqlChildPrivateSyncStateStore } from '../infrastructure/database/native/sqlChildPrivateSyncStateStore';
import type { SqlConnection } from '../infrastructure/database/native/sqlConnection';
import { createDexieChildPrivateSyncStateStore } from '../infrastructure/database/web/dexieChildPrivateSyncStateStore';
import type { LumiWebDatabase } from '../infrastructure/database/web/lumiWebDatabase';

/**
 * Bind the durable child-private sync snapshot to the opened personal diary.
 * Falls back to memory only for tests that do not open a platform database.
 */
export function createChildPrivateSyncStoreFromRuntime(input: {
  readonly webDb?: LumiWebDatabase | undefined;
  readonly nativeConnection?: SqlConnection | undefined;
}): ChildPrivateSyncStateStore {
  if (input.webDb) {
    return createDexieChildPrivateSyncStateStore(input.webDb);
  }
  if (input.nativeConnection) {
    return createSqlChildPrivateSyncStateStore(input.nativeConnection);
  }
  return createMemoryChildPrivateSyncStateStore();
}
