import { createHash } from './checksum';

/**
 * First private schema. Identifiers and payloads stay opaque; JSON columns hold
 * validated domain snapshots so later indexes can grow without rewriting meaning.
 */
export const SCHEMA_VERSION_1 = 1;

export const SCHEMA_V1_STATEMENTS = [
  `CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    checksum TEXT NOT NULL,
    applied_at_ms INTEGER NOT NULL
  )`,
  `CREATE TABLE child_profiles (
    child_id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    birth_date TEXT,
    summary_time_zone TEXT NOT NULL,
    payload_json TEXT NOT NULL
  )`,
  `CREATE TABLE care_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    child_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    revision_id TEXT NOT NULL,
    sort_at_ms INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  `CREATE INDEX care_events_child_sort ON care_events(child_id, sort_at_ms)`,
  `CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY NOT NULL,
    child_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  // One locally started active session per kind; remote multi-head conflicts are
  // handled later and must not use a global unique that rejects foreign rows.
  `CREATE UNIQUE INDEX sessions_one_local_active
    ON sessions(child_id, kind)
    WHERE status IN ('running', 'paused')`,
  `CREATE TABLE drafts (
    draft_id TEXT PRIMARY KEY NOT NULL,
    child_id TEXT NOT NULL,
    form_type TEXT NOT NULL,
    original_event_time_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    FOREIGN KEY (child_id) REFERENCES child_profiles(child_id)
  )`,
  `CREATE TABLE revisions (
    revision_id TEXT PRIMARY KEY NOT NULL,
    entity_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    parent_revision_ids_json TEXT NOT NULL,
    command_type TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    device_id TEXT,
    actor_id TEXT,
    state_json TEXT NOT NULL
  )`,
  `CREATE TABLE operation_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL,
    command_type TEXT NOT NULL,
    intent_captured_at_ms INTEGER NOT NULL,
    completed_at_ms INTEGER NOT NULL,
    entity_ids_json TEXT NOT NULL,
    revision_ids_json TEXT NOT NULL,
    result_code TEXT NOT NULL
  )`,
  `CREATE TABLE deletion_markers (
    deletion_id TEXT PRIMARY KEY NOT NULL,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    deleted_at_ms INTEGER NOT NULL,
    revision_id TEXT NOT NULL,
    retain_until_ms INTEGER NOT NULL
  )`,
  `CREATE TABLE change_notifications (
    seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    published_at_ms INTEGER NOT NULL,
    topics_json TEXT NOT NULL
  )`,
] as const;

export const SCHEMA_V1_CHECKSUM = createHash(SCHEMA_V1_STATEMENTS.join('\n'));
