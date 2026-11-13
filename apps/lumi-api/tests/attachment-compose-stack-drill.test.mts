import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCAL_ATTACHMENT_COMPOSE_STACK_DRILL_DEFAULTS,
  runAttachmentComposeStackDrill,
} from '../src/attachments/attachmentComposeStackDrill.ts';
import { resolveAttachmentObjectStore } from '../src/attachments/resolveAttachmentObjectStore.ts';
import { loadApiConfig } from '../src/config/env.ts';

test('compose attachment stack keeps personal cold on memory', () => {
  const resolved = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    } as NodeJS.ProcessEnv),
  );
  assert.equal(resolved.provider, 'memory');
  assert.equal(LOCAL_ATTACHMENT_COMPOSE_STACK_DRILL_DEFAULTS.s3Endpoint, 'http://127.0.0.1:9090');
  assert.equal(LOCAL_ATTACHMENT_COMPOSE_STACK_DRILL_DEFAULTS.databaseUrl.includes('5433'), true);
});

test('deploy compose attachment stack drill script is present', () => {
  const deploy = join(process.cwd(), 'deploy');
  assert.equal(existsSync(join(deploy, 'attachment-compose-stack-drill.sh')), true);
  assert.equal(existsSync(join(deploy, 'family-compose-stack-drill.sh')), true);
  assert.equal(existsSync(join(deploy, 'attachment-http-s3-drill.sh')), true);
});

test('live compose attachment stack against Postgres+S3Mock when healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_ATTACHMENT_COMPOSE_DRILL === '1';
  const healthy = (await postgresHealthy()) && (await s3CompatibleHealthy());
  if (!force && !healthy) {
    t.skip('local Postgres/S3 not reachable; run npm run attachment:compose-drill');
    return;
  }
  const result = await runAttachmentComposeStackDrill({
    ...LOCAL_ATTACHMENT_COMPOSE_STACK_DRILL_DEFAULTS,
    deployDir: join(process.cwd(), 'deploy'),
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.liveReady, false);
  assert.equal(result.cloudflareR2Ready, false);
  assert.equal(result.softwareReady, true);
  assert.ok(result.cases.some((row) => row.name === 'http_s3.cross_family_idor_denied' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'compose.rls_tenant_isolation' && row.ok));
});

async function s3CompatibleHealthy(): Promise<boolean> {
  try {
    const response = await fetch(LOCAL_ATTACHMENT_COMPOSE_STACK_DRILL_DEFAULTS.s3Endpoint + '/', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function postgresHealthy(): Promise<boolean> {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: LOCAL_ATTACHMENT_COMPOSE_STACK_DRILL_DEFAULTS.adminDatabaseUrl,
      connectionTimeoutMillis: 1_500,
    });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}
