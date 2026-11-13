import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_CHILD_PRIVATE_HTTP_POSTGRES_SYNC_DRILL_DEFAULTS,
  runChildPrivateHttpPostgresSyncDrill,
} from '../src/childPrivate/childPrivateHttpPostgresSyncDrill.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { loadApiConfig } from '../src/config/env.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('child-private HTTP postgres sync drill script exists', () => {
  assert.equal(
    existsSync(join(packageRoot, 'deploy/child-private-http-postgres-sync-drill.sh')),
    true,
  );
});

test('default createFamilyApi keeps child-private sync on memory', async () => {
  const api = await createFamilyApi(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'cp-default-memory',
      LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    } as NodeJS.ProcessEnv),
  );
  try {
    assert.equal(api.childPrivateSyncProvider, 'memory');
  } finally {
    await api.app.close();
  }
});

test('live HTTP child-private sync against Compose Postgres when healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_CHILD_PRIVATE_HTTP_SYNC_DRILL === '1';
  const healthy = await postgresHealthy(
    LOCAL_CHILD_PRIVATE_HTTP_POSTGRES_SYNC_DRILL_DEFAULTS.adminDatabaseUrl,
  );
  if (!force && !healthy) {
    t.skip('Postgres not reachable; run npm run child-private:http-sync-drill');
    return;
  }
  await applySyncMigrationIfMissing();
  const result = await runChildPrivateHttpPostgresSyncDrill({
    ...LOCAL_CHILD_PRIVATE_HTTP_POSTGRES_SYNC_DRILL_DEFAULTS,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.personalColdUnaffected, true);
  assert.equal(result.familyAdminIsPrivateSuperuser, false);
  assert.ok(result.cases.some((row) => row.name === 'http_admin_pull_empty' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'http_recipient_share_only' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'second_process_reads_durable' && row.ok));
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
    connectionString: LOCAL_CHILD_PRIVATE_HTTP_POSTGRES_SYNC_DRILL_DEFAULTS.adminDatabaseUrl,
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
