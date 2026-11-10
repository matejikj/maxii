import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_COMPOSE_RESTORE_DRILL_DEFAULTS,
  runFamilyComposeRestoreDrill,
} from '../src/ops/familyComposeRestoreDrill.ts';
import {
  evaluateOffHostProbeConfig,
  loadOffHostProbeConfig,
} from '../src/ops/offHostProbe.ts';
import {
  DEFAULT_MONTHLY_COST_LEDGER,
  summarizeMonthlyCostLedger,
} from '../src/ops/monthlyCostLedger.ts';
import { evaluatePatchUpgradePolicy } from '../src/ops/patchUpgradePolicy.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const deployDir = join(packageRoot, 'deploy');

test('compose restore drill script and restore runbook exist', () => {
  assert.equal(existsSync(join(deployDir, 'family-compose-restore-drill.sh')), true);
  assert.equal(existsSync(join(deployDir, 'restore-runbook.txt')), true);
  assert.equal(existsSync(join(deployDir, 'alert-channels.example.json')), true);
});

test('off-host probe stays closed without live configuration', () => {
  const evaluation = evaluateOffHostProbeConfig(
    loadOffHostProbeConfig({} as NodeJS.ProcessEnv),
  );
  assert.equal(evaluation.okForLiveGate, false);
  assert.ok(evaluation.blockers.includes('off_host_uptime_probe_not_configured'));
});

test('monthly cost ledger keeps CX23 candidate without ordering the host', () => {
  const summary = summarizeMonthlyCostLedger(DEFAULT_MONTHLY_COST_LEDGER);
  assert.equal(summary.hostCandidate, 'Hetzner CX23');
  assert.equal(summary.readyToOrderHost, false);
  assert.ok(summary.totalEurMonthly >= 5.99);
});

test('patch upgrade policy artifacts are present', () => {
  const report = evaluatePatchUpgradePolicy(deployDir);
  assert.equal(report.ok, true, report.checks.map((c) => `${c.name}:${c.detail}`).join('; '));
});

test('live compose restore timing drill when Postgres is healthy (otherwise skip)', async (t) => {
  const force = process.env.LUMI_FORCE_COMPOSE_RESTORE_DRILL === '1';
  const healthy = await postgresHealthy();
  if (!force && !healthy) {
    t.skip('Postgres not reachable; run npm run ops:compose-restore-drill');
    return;
  }
  const result = await runFamilyComposeRestoreDrill({
    deployDir,
    adminDatabaseUrl: LOCAL_COMPOSE_RESTORE_DRILL_DEFAULTS.adminDatabaseUrl,
    composeFile: join(deployDir, 'docker-compose.yml'),
  });
  assert.equal(
    result.ok,
    true,
    result.cases.map((row) => `${row.name}:${row.detail}`).join('; '),
  );
  assert.equal(result.liveReady, false);
  assert.equal(result.liveDrillEvidenceMutated, false);
  assert.ok((result.softwareMeasuredRtoSeconds ?? 0) >= 1);
});

async function postgresHealthy(): Promise<boolean> {
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: LOCAL_COMPOSE_RESTORE_DRILL_DEFAULTS.adminDatabaseUrl,
      connectionTimeoutMillis: 1_500,
    });
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}
