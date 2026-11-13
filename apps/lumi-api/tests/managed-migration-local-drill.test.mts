import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { runManagedMigrationLocalDrill } from '../src/ops/managedMigrationLocalDrill.ts';

test('local managed migration drill preserves receipts, conflicts, and erasure registry', async () => {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  const api = await createFamilyApi(config);
  try {
    const report = await runManagedMigrationLocalDrill({
      app: api.app,
      tokens: api.tokens,
      sync: api.sync,
      erasureRegistry: api.erasureRegistry,
    });

    assert.equal(report.format, 'lumi.managed-migration-local-drill.v1');
    assert.equal(report.mode, 'drill');
    assert.equal(report.cloudMigrationClaimed, false);
    assert.equal(report.receiptsPreserved, true);
    assert.equal(report.conflictHeadsPreserved, true);
    assert.equal(report.staleCursorRequiresResync, true);
    assert.equal(report.staleWriterRejected, true);
    assert.equal(report.erasureRegistrySurvived, true);
    assert.equal(report.dnsRollbackPracticeOnly, true);
    assert.equal(report.allChecksPassed, true);
    assert.ok(report.findings.includes('cloud_migration_not_claimed'));
    assert.equal(report.cutoverPlan.mode, 'drill');
    assert.ok(report.cutoverPlan.steps.every((step) => step.allowedInDrill));
  } finally {
    await api.app.close();
  }
});

test('migration drill report never claims a completed cloud cutover', async () => {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  const api = await createFamilyApi(config);
  try {
    const report = await runManagedMigrationLocalDrill({
      app: api.app,
      tokens: api.tokens,
      sync: api.sync,
      erasureRegistry: api.erasureRegistry,
    });
    assert.equal(report.cloudMigrationClaimed, false);
    assert.equal(JSON.stringify(report).includes('"cloudMigrationClaimed":true'), false);
  } finally {
    await api.app.close();
  }
});
