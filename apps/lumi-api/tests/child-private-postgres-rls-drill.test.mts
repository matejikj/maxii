import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_CHILD_PRIVATE_POSTGRES_RLS_DRILL_DEFAULTS,
  runChildPrivatePostgresRlsDrill,
} from '../src/childPrivate/childPrivatePostgresRlsDrill.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('child-private workspace migration and drill script exist', () => {
  assert.equal(existsSync(join(packageRoot, 'migrations/008_child_private_workspace.sql')), true);
  assert.equal(existsSync(join(packageRoot, 'deploy/child-private-postgres-rls-drill.sh')), true);
});

test('live child-private RLS against Compose Postgres when healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_CHILD_PRIVATE_RLS_DRILL === '1';
  const healthy = await postgresHealthy(
    LOCAL_CHILD_PRIVATE_POSTGRES_RLS_DRILL_DEFAULTS.adminDatabaseUrl,
  );
  if (!force && !healthy) {
    t.skip('Postgres not reachable; run npm run child-private:rls-drill');
    return;
  }
  await applyChildPrivateMigrationIfMissing();
  const result = await runChildPrivatePostgresRlsDrill({
    ...LOCAL_CHILD_PRIVATE_POSTGRES_RLS_DRILL_DEFAULTS,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.personalColdUnaffected, true);
  assert.equal(result.familyAdminIsPrivateSuperuser, false);
  assert.ok(result.cases.some((row) => row.name === 'family_admin_project_denied' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'named_recipient_share_only' && row.ok));
  assert.ok(
    result.cases.some((row) => row.name === 'revoked_share_hidden_from_recipient' && row.ok),
  );
  assert.ok(result.cases.some((row) => row.name === 'spoofed_owner_insert_rejected' && row.ok));
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

async function applyChildPrivateMigrationIfMissing(): Promise<void> {
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: LOCAL_CHILD_PRIVATE_POSTGRES_RLS_DRILL_DEFAULTS.adminDatabaseUrl,
  });
  await client.connect();
  try {
    const exists = await client.query(
      `select to_regclass('public.child_private_project') is not null as present`,
    );
    if (exists.rows[0]?.present === true) return;
    const sql = readFileSync(
      join(packageRoot, 'migrations/008_child_private_workspace.sql'),
      'utf8',
    );
    await client.query(sql);
  } finally {
    await client.end();
  }
}
