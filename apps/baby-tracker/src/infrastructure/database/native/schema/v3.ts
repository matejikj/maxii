import { createHash } from './checksum';

/**
 * App-level meta for personal bootstrap flags. Values are small allowlisted
 * strings — never care notes, DOB dumps, or navigation caches with PII.
 */
export const SCHEMA_VERSION_3 = 3;

export const SCHEMA_V3_STATEMENTS = [
  `CREATE TABLE app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
] as const;

export const SCHEMA_V3_CHECKSUM = createHash(SCHEMA_V3_STATEMENTS.join('\n'));
