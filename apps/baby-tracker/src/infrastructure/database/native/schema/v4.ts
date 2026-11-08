import { createHash } from './checksum';

/**
 * Local searchable documents for care notes and activity titles. Rebuildable
 * from care_events without deleting real diary rows.
 */
export const SCHEMA_VERSION_4 = 4;

export const SCHEMA_V4_STATEMENTS = [
  `CREATE TABLE search_documents (
    entity_id TEXT PRIMARY KEY NOT NULL,
    child_id TEXT NOT NULL,
    sort_at_ms INTEGER NOT NULL,
    doc_type TEXT NOT NULL,
    text_normalized TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  `CREATE INDEX search_documents_child_sort ON search_documents(child_id, sort_at_ms DESC, entity_id DESC)`,
  `CREATE INDEX search_documents_child_text ON search_documents(child_id, text_normalized)`,
] as const;

export const SCHEMA_V4_CHECKSUM = createHash(SCHEMA_V4_STATEMENTS.join('\n'));
