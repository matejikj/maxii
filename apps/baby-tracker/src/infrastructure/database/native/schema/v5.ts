import { createHash } from './checksum';

/**
 * Local photo attachment metadata. Immutable sealed JPEG bytes live in the
 * private blob store; this table only keeps recoverable references.
 */
export const SCHEMA_VERSION_5 = 5;

export const SCHEMA_V5_STATEMENTS = [
  `CREATE TABLE photo_attachments (
    attachment_id TEXT PRIMARY KEY NOT NULL,
    child_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    host_event_type TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    caption TEXT,
    recorded_by TEXT,
    created_at_ms INTEGER NOT NULL,
    deleted_at_ms INTEGER,
    retain_until_ms INTEGER,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  `CREATE INDEX photo_attachments_event_order
    ON photo_attachments(event_id, order_index, attachment_id)`,
  `CREATE INDEX photo_attachments_child_created
    ON photo_attachments(child_id, created_at_ms DESC)`,
  `CREATE TABLE photo_attachment_jobs (
    job_id TEXT PRIMARY KEY NOT NULL,
    attachment_id TEXT NOT NULL,
    child_id TEXT NOT NULL,
    event_id TEXT,
    state TEXT NOT NULL,
    error_code TEXT,
    source_mime TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    payload_json TEXT NOT NULL
  )`,
  `CREATE INDEX photo_attachment_jobs_event ON photo_attachment_jobs(event_id, updated_at_ms)`,
] as const;

export const SCHEMA_V5_CHECKSUM = createHash(SCHEMA_V5_STATEMENTS.join('\n'));
