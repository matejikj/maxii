import type { ChildPrivateSyncStateStore } from '../../../domain/sync/childPrivateSyncStateStore';
import {
  parseChildPrivateSyncState,
  serializeChildPrivateSyncState,
} from '../childPrivateSyncStateCodec';
import type { LumiWebDatabase, WebChildPrivateSyncStateRow } from './lumiWebDatabase';

const SINGLETON_ID = 1;

/**
 * IndexedDB-backed store for the owner-scoped child-private sync snapshot.
 * Personal web builds keep unsent private rows without a remote API.
 */
export function createDexieChildPrivateSyncStateStore(
  db: LumiWebDatabase,
): ChildPrivateSyncStateStore {
  return {
    async load() {
      const row = await db.childPrivateSyncState.get(SINGLETON_ID);
      if (!row) return parseChildPrivateSyncState(null);
      return parseChildPrivateSyncState({
        ownerAppUserId: row.ownerAppUserId,
        cursor: row.cursor,
        epoch: row.epoch,
        lastSuccessfulSyncAtMs: row.lastSuccessfulSyncAtMs,
        resyncRequired: row.resyncRequired === 1,
        outboxJson: row.outboxJson,
        inboxJson: row.inboxJson,
      });
    },
    async save(state) {
      const serialized = serializeChildPrivateSyncState(state);
      const row: WebChildPrivateSyncStateRow = {
        id: SINGLETON_ID,
        ownerAppUserId: serialized.ownerAppUserId,
        cursor: serialized.cursor,
        epoch: serialized.epoch,
        lastSuccessfulSyncAtMs: serialized.lastSuccessfulSyncAtMs,
        resyncRequired: serialized.resyncRequired ? 1 : 0,
        outboxJson: serialized.outboxJson,
        inboxJson: serialized.inboxJson,
      };
      await db.childPrivateSyncState.put(row);
    },
  };
}
