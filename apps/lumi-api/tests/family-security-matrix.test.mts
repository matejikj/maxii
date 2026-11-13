import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import { runFamilySecurityMatrix } from '../src/ops/familySecurityMatrix.ts';

const CANARY = `DIARY-CANARY-${Date.now()}-PRIVATE-NOTE`;

test('software family security matrix passes without claiming independent review', async () => {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  const api = await createFamilyApi(config);
  try {
    const report = await runFamilySecurityMatrix({
      app: api.app,
      tokens: api.tokens,
      sync: api.sync,
      diaryCanary: CANARY,
    });

    assert.equal(report.format, 'lumi.family-security-matrix.v1');
    assert.equal(report.independentHumanReviewClaimed, false);
    assert.equal(report.allSoftwareChecksPassed, true);
    assert.equal(report.checks.length, 8);
    assert.ok(report.findings.includes('independent_human_review_not_claimed'));
    assert.ok(report.findings.includes('software_security_matrix_passed'));
    for (const item of report.checks) {
      assert.equal(item.ok, true, `${item.id}: ${item.detail}`);
    }
  } finally {
    await api.app.close();
  }
});

test('security matrix report never marks independent human review as done', async () => {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OIDC_AUDIENCE: 'lumi-api',
  } as NodeJS.ProcessEnv);
  const api = await createFamilyApi(config);
  try {
    const report = await runFamilySecurityMatrix({
      app: api.app,
      tokens: api.tokens,
      sync: api.sync,
      diaryCanary: CANARY,
    });
    assert.equal(report.independentHumanReviewClaimed, false);
    assert.equal(JSON.stringify(report).includes('"independentHumanReviewClaimed":true'), false);
  } finally {
    await api.app.close();
  }
});
