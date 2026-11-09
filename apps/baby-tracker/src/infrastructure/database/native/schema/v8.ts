import { createHash } from './checksum';

/**
 * Parent suggestions live in the same private diary so wipe/replace clears
 * them with projects. Accept/dismiss outcomes stay local and are never shown
 * to the author as secret telemetry.
 */
export const SCHEMA_VERSION_8 = 8;

export const SCHEMA_V8_STATEMENTS = [
  `CREATE TABLE parent_suggestions (
    suggestion_id TEXT PRIMARY KEY NOT NULL,
    child_id TEXT NOT NULL,
    author_app_user_id TEXT,
    status TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  `CREATE INDEX parent_suggestions_child_updated
    ON parent_suggestions(child_id, updated_at_ms DESC)`,
  `CREATE INDEX parent_suggestions_author_updated
    ON parent_suggestions(author_app_user_id, updated_at_ms DESC)`,
] as const;

export const SCHEMA_V8_CHECKSUM = createHash(SCHEMA_V8_STATEMENTS.join('\n'));
