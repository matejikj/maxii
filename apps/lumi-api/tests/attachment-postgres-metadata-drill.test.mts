import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS,
  runAttachmentPostgresMetadataDrill,
} from '../src/attachments/attachmentPostgresMetadataDrill.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('attachment postgres metadata migration and drill script exist', () => {
  assert.equal(existsSync(join(packageRoot, 'migrations/006_family_attachments.sql')), true);
  assert.equal(
    existsSync(join(packageRoot, 'deploy/attachment-postgres-metadata-drill.sh')),
    true,
  );
});

test('live attachment metadata RLS against Compose Postgres when healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_ATTACHMENT_PG_META_DRILL === '1';
  const healthy = await postgresHealthy(
    LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS.adminDatabaseUrl,
  );
  if (!force && !healthy) {
    t.skip('Postgres not reachable; run npm run attachment:pg-meta-drill');
    return;
  }
  // Ensure migration is present before asserting (admin path).
  await applyAttachmentMigrationIfMissing();
  const result = await runAttachmentPostgresMetadataDrill({
    ...LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS,
  });
  assert.equal(
    result.ok,
    true,
    result.cases.map((row) => `${row.name}:${row.detail}`).join('; '),
  );
  assert.equal(result.personalColdUnaffected, true);
  assert.ok(result.cases.some((row) => row.name === 'foreign_member_read_denied' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'tombstone_removes_objects' && row.ok));
});

async function postgresHealthy(url: string): Promise<boolean> {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: url,
      connectionTimeoutMillis: 1_500,
    });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

async function applyAttachmentMigrationIfMissing(): Promise<void> {
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS.adminDatabaseUrl,
  });
  await client.connect();
  try {
    const exists = await client.query(
      `select to_regclass('public.family_attachment') is not null as present`,
    );
    if (exists.rows[0]?.present === true) return;
    const sql = readFileSync(
      join(packageRoot, 'migrations/006_family_attachments.sql'),
      'utf8',
    );
    await client.query(sql);
  } finally {
    await client.end();
  }
}
