import { createHash } from './checksum';

/**
 * Soft-delete trash keeps a restorable payload through the retention window.
 * After purge the marker remains for replay while note text is cleared.
 */
export const SCHEMA_VERSION_2 = 2;

export const SCHEMA_V2_STATEMENTS = [
  `ALTER TABLE deletion_markers ADD COLUMN payload_json TEXT`,
  `ALTER TABLE deletion_markers ADD COLUMN payload_purged INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS deletion_markers_entity ON deletion_markers(entity_id)`,
  `CREATE INDEX IF NOT EXISTS deletion_markers_retain ON deletion_markers(retain_until_ms)`,
] as const;

export const SCHEMA_V2_CHECKSUM = createHash(SCHEMA_V2_STATEMENTS.join('\n'));
