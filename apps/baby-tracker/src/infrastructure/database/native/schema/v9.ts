import { createHash } from './checksum';

/**
 * Durable owner-scoped child-private sync cursor/outbox. Personal builds may
 * keep unsent private rows here without ever opening a network transport.
 */
export const SCHEMA_VERSION_9 = 9;

export const SCHEMA_V9_STATEMENTS = [
  `CREATE TABLE child_private_sync_state (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    owner_app_user_id TEXT,
    cursor TEXT,
    epoch INTEGER,
    last_successful_sync_at_ms INTEGER,
    resync_required INTEGER NOT NULL DEFAULT 0,
    outbox_json TEXT NOT NULL,
    inbox_json TEXT NOT NULL
  )`,
] as const;

export const SCHEMA_V9_CHECKSUM = createHash(SCHEMA_V9_STATEMENTS.join('\n'));
