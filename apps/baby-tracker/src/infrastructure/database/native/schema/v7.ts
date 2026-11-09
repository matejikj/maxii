import { createHash } from './checksum';

/**
 * Portfolio selections and immutable share snapshots. Cleared with diary wipe
 * so private selections never survive a personal erase.
 */
export const SCHEMA_VERSION_7 = 7;

export const SCHEMA_V7_STATEMENTS = [
  `CREATE TABLE portfolio_items (
    portfolio_item_id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    child_id TEXT NOT NULL,
    owner_app_user_id TEXT,
    created_at_ms INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  `CREATE INDEX portfolio_items_child_created
    ON portfolio_items(child_id, created_at_ms DESC)`,
  `CREATE INDEX portfolio_items_project
    ON portfolio_items(project_id, created_at_ms DESC)`,
  `CREATE TABLE share_snapshots (
    share_id TEXT PRIMARY KEY NOT NULL,
    source_project_id TEXT NOT NULL,
    owner_app_user_id TEXT NOT NULL,
    revoked_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  )`,
  `CREATE INDEX share_snapshots_owner_created
    ON share_snapshots(owner_app_user_id, created_at_ms DESC)`,
  `CREATE INDEX share_snapshots_source
    ON share_snapshots(source_project_id, created_at_ms DESC)`,
] as const;

export const SCHEMA_V7_CHECKSUM = createHash(SCHEMA_V7_STATEMENTS.join('\n'));
