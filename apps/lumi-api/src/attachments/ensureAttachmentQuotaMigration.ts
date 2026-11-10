import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATION_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../migrations/007_family_attachment_quota.sql',
);

/**
 * Drills may run against a Compose volume created before migration 007. The
 * migration is `create table if not exists`, so applying it with the admin URL
 * is idempotent and keeps unit-test boots from failing on an older volume.
 */
export async function ensureAttachmentQuotaMigration(adminDatabaseUrl: string): Promise<void> {
  const sql = await readFile(MIGRATION_PATH, 'utf8');
  const client = new pg.Client({
    connectionString: adminDatabaseUrl,
    connectionTimeoutMillis: 5_000,
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
