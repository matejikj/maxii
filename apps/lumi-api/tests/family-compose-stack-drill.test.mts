import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCAL_COMPOSE_STACK_DRILL_DEFAULTS,
  runFamilyComposeStackDrill,
} from '../src/ops/familyComposeStackDrill.ts';

test('compose stack drill script and defaults are present', () => {
  const deploy = join(process.cwd(), 'deploy');
  assert.equal(existsSync(join(deploy, 'family-compose-stack-drill.sh')), true);
  assert.equal(existsSync(join(deploy, 'operations-owners.json')), true);
  assert.equal(
    LOCAL_COMPOSE_STACK_DRILL_DEFAULTS.databaseUrl.includes('5433'),
    true,
  );
});

test('live Compose stack drill when postgres is healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_COMPOSE_DRILL === '1';
  const healthy = await postgresHealthy();
  if (!force && !healthy) {
    t.skip('Compose postgres not reachable; run npm run ops:compose-drill');
    return;
  }
  const result = await runFamilyComposeStackDrill({
    ...LOCAL_COMPOSE_STACK_DRILL_DEFAULTS,
    deployDir: join(process.cwd(), 'deploy'),
  });
  assert.equal(result.liveReady, false);
  assert.equal(
    result.ok,
    true,
    result.cases.map((row) => `${row.name}:${row.detail}`).join('; '),
  );
});

async function postgresHealthy(): Promise<boolean> {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: LOCAL_COMPOSE_STACK_DRILL_DEFAULTS.adminDatabaseUrl,
      connectionTimeoutMillis: 1500,
    });
    await client.connect();
    await client.query('select 1');
    await client.end();
    return true;
  } catch {
    return false;
  }
}
