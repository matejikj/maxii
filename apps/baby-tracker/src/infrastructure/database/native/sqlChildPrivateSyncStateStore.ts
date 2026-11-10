import type { ChildPrivateSyncStateStore } from '../../../domain/sync/childPrivateSyncStateStore';
import {
  parseChildPrivateSyncState,
  serializeChildPrivateSyncState,
} from '../childPrivateSyncStateCodec';
import type { SqlConnection } from './sqlConnection';

const SINGLETON_ID = 1;

type SyncStateSqlRow = {
  readonly owner_app_user_id: string | null;
  readonly cursor: string | null;
  readonly epoch: number | null;
  readonly last_successful_sync_at_ms: number | null;
  readonly resync_required: number;
  readonly outbox_json: string;
  readonly inbox_json: string;
};

/**
 * SQLCipher-backed store for the owner-scoped child-private sync snapshot.
 * Uses a singleton row so personal cold boots keep one private workspace.
 */
export function createSqlChildPrivateSyncStateStore(
  connection: SqlConnection,
): ChildPrivateSyncStateStore {
  return {
    async load() {
      const row = await connection.getFirstAsync<SyncStateSqlRow>(
        `SELECT owner_app_user_id, cursor, epoch, last_successful_sync_at_ms,
                resync_required, outbox_json, inbox_json
           FROM child_private_sync_state
          WHERE id = ?`,
        SINGLETON_ID,
      );
      if (!row) return parseChildPrivateSyncState(null);
      return parseChildPrivateSyncState({
        ownerAppUserId: row.owner_app_user_id,
        cursor: row.cursor,
        epoch: row.epoch,
        lastSuccessfulSyncAtMs: row.last_successful_sync_at_ms,
        resyncRequired: row.resync_required === 1,
        outboxJson: row.outbox_json,
        inboxJson: row.inbox_json,
      });
    },
    async save(state) {
      const serialized = serializeChildPrivateSyncState(state);
      // Delete-then-insert keeps the memory SQL double and expo-sqlite aligned.
      await connection.runAsync(
        'DELETE FROM child_private_sync_state WHERE id = ?',
        SINGLETON_ID,
      );
      await connection.runAsync(
        `INSERT INTO child_private_sync_state (
          id, owner_app_user_id, cursor, epoch, last_successful_sync_at_ms,
          resync_required, outbox_json, inbox_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        SINGLETON_ID,
        serialized.ownerAppUserId,
        serialized.cursor,
        serialized.epoch,
        serialized.lastSuccessfulSyncAtMs,
        serialized.resyncRequired ? 1 : 0,
        serialized.outboxJson,
        serialized.inboxJson,
      );
    },
  };
}
