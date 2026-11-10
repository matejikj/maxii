import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CRITICAL_SOFTWARE_REHEARSAL_KINDS,
  runFamilyOpsIncidentRehearsal,
} from '../src/ops/familyOpsIncidentRehearsal.ts';

const deployDir = join(process.cwd(), 'deploy');

test('incident rehearsal script and critical kinds are present', () => {
  assert.equal(existsSync(join(deployDir, 'family-ops-incident-rehearsal.sh')), true);
  assert.ok(CRITICAL_SOFTWARE_REHEARSAL_KINDS.includes('vps_total_outage'));
  assert.ok(CRITICAL_SOFTWARE_REHEARSAL_KINDS.includes('disk_full'));
  assert.ok(CRITICAL_SOFTWARE_REHEARSAL_KINDS.includes('identity_loss'));
});

test('software rehearsal keeps local tracker and never forges live drill evidence', async () => {
  const ownersBefore = readFileSync(join(deployDir, 'operations-owners.json'), 'utf8');
  const result = await runFamilyOpsIncidentRehearsal({
    deployDir,
    adminDatabaseUrl: null,
    nowMs: 1_700_000_000_000,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.softwareReady, true);
  assert.equal(result.liveReady, false);
  assert.equal(result.liveDrillEvidenceMutated, false);
  assert.equal(result.localTrackerRemainsAvailable, true);
  assert.equal(result.remoteKillSwitchForbidden, true);
  assert.ok(result.cases.some((row) => row.name === 'rehearse_vps_total_outage' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'failed_backup_alert_fires' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'off_host_probe_still_required' && row.ok));
  assert.ok(result.cases.some((row) => row.name === 'measured_rpo_rto_not_claimed' && row.ok));
  assert.equal(readFileSync(join(deployDir, 'operations-owners.json'), 'utf8'), ownersBefore);
});

test('optional Compose Postgres reachability does not claim live restore', async (t) => {
  const force = process.env.LUMI_FORCE_OPS_REHEARSAL_COMPOSE === '1';
  const adminUrl =
    process.env.LUMI_DATABASE_ADMIN_URL ??
    'postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app';
  let reachable = false;
  try {
    const pg = await import('pg');
    const client = new pg.default.Client({
      connectionString: adminUrl,
      connectionTimeoutMillis: 1_200,
    });
    await client.connect();
    await client.end();
    reachable = true;
  } catch {
    reachable = false;
  }
  if (!force && !reachable) {
    t.skip('Compose Postgres not up; run npm run ops:incident-rehearsal');
    return;
  }
  const result = await runFamilyOpsIncidentRehearsal({
    deployDir,
    adminDatabaseUrl: adminUrl,
  });
  assert.equal(result.ok, true, result.cases.map((row) => `${row.name}:${row.detail}`).join('; '));
  assert.equal(result.liveReady, false);
  assert.ok(result.cases.some((row) => row.name === 'compose_postgres_reachable' && row.ok));
});
