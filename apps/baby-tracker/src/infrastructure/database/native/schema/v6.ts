import { createHash } from './checksum';

/**
 * Caregiver-guided and (later) child-private project rows. Full project JSON
 * lives in payload_json; columns support child-scoped list and wipe.
 */
export const SCHEMA_VERSION_6 = 6;

export const SCHEMA_V6_STATEMENTS = [
  `CREATE TABLE projects (
    project_id TEXT PRIMARY KEY NOT NULL,
    child_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    status TEXT NOT NULL,
    owner_app_user_id TEXT,
    creator_app_user_id TEXT,
    family_id TEXT,
    template_revision_id TEXT,
    updated_at_ms INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  `CREATE INDEX projects_child_updated
    ON projects(child_id, updated_at_ms DESC)`,
  `CREATE INDEX projects_child_scope_status
    ON projects(child_id, scope, status)`,
] as const;

export const SCHEMA_V6_CHECKSUM = createHash(SCHEMA_V6_STATEMENTS.join('\n'));
