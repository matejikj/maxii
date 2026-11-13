import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_CHILD_PRIVATE_POSTGRES_SYNC_DRILL_DEFAULTS,
  runChildPrivatePostgresSyncDrill,
} from '../src/childPrivate/childPrivatePostgresSyncDrill.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('child-private sync migration and drill script exist', () => {
  assert.equal(existsSync(join(packageRoot, 'migrations/009_child_private_sync.sql')), true);
  assert.equal(existsSync(join(packageRoot, 'deploy/child-private-postgres-sync-drill.sh')), true);
});

test('live child-private durable sync ledger against Compose Postgres when healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_CHILD_PRIVATE_SYNC_DRILL === '1';
  const healthy = await postgresHealthy(
    LOCAL_CHILD_PRIVATE_POSTGRES_SYNC_DRILL_DEFAULTS.adminDatabaseUrl,
  );
  if (!force && !healthy) {
    t.skip('Postgres not reachable; run npm run child-private:sync-drill');
    return;
  }
  await applySyncMigrationIfMissing();
  const result = await runChildPrivatePostgresSyncDrill({
    ...LOCAL_CHILD_PRIVATE_POSTGRES_SYNC_DRILL_DEFAULTS,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.personalColdUnaffected, true);
  assert.equal(result.familyAdminIsPrivateSuperuser, false);
  assert.ok(result.cases.some((row) => row.name === 'family_admin_pull_empty' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'recipient_share_only' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'duplicate_push_idempotent' && row.ok));
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

async function applySyncMigrationIfMissing(): Promise<void> {
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: LOCAL_CHILD_PRIVATE_POSTGRES_SYNC_DRILL_DEFAULTS.adminDatabaseUrl,
  });
  await client.connect();
  try {
    const exists = await client.query(
      `select to_regclass('public.child_private_sync_operation') is not null as present`,
    );
    if (exists.rows[0]?.present === true) return;
    const sql = readFileSync(join(packageRoot, 'migrations/009_child_private_sync.sql'), 'utf8');
    await client.query(sql);
  } finally {
    await client.end();
  }
}
