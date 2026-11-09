import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadApiConfig } from '../src/config/env.ts';
import { createFamilyApi } from '../src/http/createServer.ts';
import {
  classifyFamilyOpsPath,
  createFamilyOpsMetrics,
} from '../src/ops/familyMetrics.ts';
import { evaluateFamilyAlerts } from '../src/ops/familyAlerts.ts';
import {
  INCIDENT_PLAYBOOKS,
  simulateIncidentResponse,
} from '../src/ops/incidentPlaybooks.ts';
import {
  evaluateGrowthDecision,
  planManagedMigrationCutover,
} from '../src/ops/migrationCutover.ts';
import { parseOperationsOwners, isAssigned } from '../src/ops/owners.ts';
import { evaluateFamilyOpsReadiness } from '../src/ops/familyOpsReadiness.ts';

const here = dirname(fileURLToPath(import.meta.url));
const deploy = join(here, '../deploy');

test('family metrics classify paths and omit diary-like fields', () => {
  assert.equal(classifyFamilyOpsPath('/v1/families/abc/sync/pull'), 'sync');
  assert.equal(classifyFamilyOpsPath('/v1/families/abc/backup-status'), 'backup');
  assert.equal(classifyFamilyOpsPath('/v1/ops/metrics'), 'ops');
  const metrics = createFamilyOpsMetrics({ nowMs: () => 1_000 });
  metrics.recordRequest({
    pathClass: 'sync',
    method: 'POST',
    statusClass: '4xx',
    rejected: true,
    durationMs: 12,
    code: 'conflict',
  });
  metrics.recordSyncLagMs(90_000);
  metrics.recordBackupAttempt({ ok: false, atMs: 1_000 });
  metrics.setQueueBacklog(3);
  const snap = metrics.snapshot();
  assert.equal(snap.rejectedCount, 1);
  assert.equal(snap.queueBacklog, 3);
  assert.equal(snap.maxSyncLagMs, 90_000);
  assert.equal(snap.backup.lastAttemptOk, false);
  assert.equal(
    JSON.stringify(snap).includes('CANARY_NOTE'),
    false,
  );
});

test('alerts require off-host probe and fire on stale backup', () => {
  const metrics = createFamilyOpsMetrics();
  metrics.recordBackupAttempt({ ok: true, atMs: 1, completedAtMs: 1 });
  const stale = evaluateFamilyAlerts(metrics.snapshot(), {
    nowMs: 1 + 25 * 60 * 60 * 1000,
    offHostProbeConfigured: false,
  });
  assert.ok(stale.alerts.some((a) => a.id === 'backup_stale_or_missing'));
  assert.ok(stale.alerts.some((a) => a.id === 'external_host_probe_required'));
  assert.equal(stale.ok, false);
  assert.ok(stale.alerts.every((a) => a.runbook.length > 0));
});

test('incident simulations keep the local tracker and forbid remote wipe', () => {
  for (const kind of Object.keys(INCIDENT_PLAYBOOKS) as (keyof typeof INCIDENT_PLAYBOOKS)[]) {
    const result = simulateIncidentResponse(kind);
    assert.equal(result.localTrackerAvailable, true);
    assert.equal(result.wipeOrLockHistoryAttempted, false);
    assert.equal(result.playbook.localTrackerRemainsAvailable, true);
    assert.equal(result.playbook.remoteKillSwitchForbidden, true);
  }
});

test('managed cutover forbids DNS rollback after the first confirmed write', () => {
  const drill = planManagedMigrationCutover({ mode: 'drill' });
  assert.equal(drill.mode, 'drill');
  assert.equal(drill.dnsRollbackToOldDbAllowed, true);
  assert.ok(drill.steps.every((step) => step.allowedInDrill));

  const beforeWrite = planManagedMigrationCutover({
    mode: 'activation',
    firstConfirmedWriteAtMs: null,
  });
  assert.equal(beforeWrite.dnsRollbackToOldDbAllowed, true);

  const afterWrite = planManagedMigrationCutover({
    mode: 'activation',
    firstConfirmedWriteAtMs: 42,
  });
  assert.equal(afterWrite.dnsRollbackToOldDbAllowed, false);
});

test('growth decisions never auto-provision cloud accounts', () => {
  const missing = evaluateGrowthDecision({
    sustainedRamPressure: false,
    sustainedDiskPressure: false,
    dbConnectionSaturation: false,
    p95LatencyMs: null,
    queueBacklog: null,
    measuredRpoHours: null,
    measuredRtoHours: null,
    rpoTargetHours: 24,
    rtoTargetHours: 8,
  });
  assert.equal(missing.decision, 'blocked_missing_measurements');
  assert.equal(missing.autoProvisionForbidden, true);

  const resize = evaluateGrowthDecision({
    sustainedRamPressure: true,
    sustainedDiskPressure: false,
    dbConnectionSaturation: false,
    p95LatencyMs: 100,
    queueBacklog: 1,
    measuredRpoHours: 12,
    measuredRtoHours: 4,
    rpoTargetHours: 24,
    rtoTargetHours: 8,
  });
  assert.equal(resize.decision, 'resize_vps_first');
  assert.equal(resize.autoProvisionForbidden, true);
});

test('owners document parses and readiness stays live-blocked while UNASSIGNED', () => {
  const raw = JSON.parse(readFileSync(join(deploy, 'operations-owners.json'), 'utf8'));
  const owners = parseOperationsOwners(raw);
  assert.equal(owners.e2eeClaim, false);
  assert.equal(isAssigned(owners.onCall.primaryName), false);

  const runbooks = [
    'deploy/family-ops-runbook.txt',
    'deploy/incident-runbooks.txt',
    'deploy/restore-runbook.txt',
    'deploy/migration-cutover-runbook.txt',
  ];
  const existing = new Set(
    [
      'family-ops-runbook.txt',
      'incident-runbooks.txt',
      'restore-runbook.txt',
      'migration-cutover-runbook.txt',
    ]
      .filter((name) => existsSync(join(deploy, name)))
      .map((name) => `deploy/${name}`),
  );
  const readiness = evaluateFamilyOpsReadiness({
    owners,
    requiredRunbookPaths: runbooks,
    existingRunbookPaths: existing,
    offHostProbeConfigured: false,
    metricsModuleLoaded: true,
    alertsModuleLoaded: true,
  });
  assert.equal(readiness.softwareReady, true);
  assert.equal(readiness.liveReady, false);
  assert.ok(readiness.blockers.some((b) => b.includes('on_call')));
  assert.ok(readiness.blockers.some((b) => b.includes('live_drill')));
});

test('ops metrics and alerts endpoints require the ops bearer token', async () => {
  const config = loadApiConfig({
    LUMI_TEST_HS256_SECRET: 'unit-test-hs256',
    LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    LUMI_OPS_BEARER_TOKEN: 'ops-secret',
    LUMI_OFF_HOST_PROBE_CONFIGURED: '1',
    LUMI_RATE_LIMIT_PER_WINDOW: '100',
  } as NodeJS.ProcessEnv);
  const { app, metrics } = await createFamilyApi(config);
  metrics.recordBackupAttempt({ ok: true, atMs: Date.now(), completedAtMs: Date.now() });

  const denied = await app.inject({ method: 'GET', url: '/v1/ops/metrics' });
  assert.equal(denied.statusCode, 401);

  const ok = await app.inject({
    method: 'GET',
    url: '/v1/ops/metrics',
    headers: { authorization: 'Bearer ops-secret' },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().format, 'lumi.family-ops-metrics.v1');

  const alerts = await app.inject({
    method: 'GET',
    url: '/v1/ops/alerts',
    headers: { authorization: 'Bearer ops-secret' },
  });
  assert.equal(alerts.statusCode, 200);
  assert.equal(alerts.json().format, 'lumi.family-ops-alerts.v1');
  assert.equal(
    JSON.stringify(alerts.json()).toLowerCase().includes('diary'),
    false,
  );
  await app.close();
});

test('deploy runbooks and ops-readiness script exist', () => {
  for (const name of [
    'family-ops-runbook.txt',
    'incident-runbooks.txt',
    'migration-cutover-runbook.txt',
    'alert-channels.example.json',
    'ops-readiness.sh',
    'family-release-gate.sh',
    'restore-runbook.txt',
  ]) {
    assert.equal(existsSync(join(deploy, name)), true, name);
  }
});
