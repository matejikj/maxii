import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  emptyFamilyReleaseEvidence,
  evaluateFamilyReleaseGate,
} from '../src/ops/familyReleaseGate.ts';
import { loadFamilyReleaseGateFromDeploy } from '../src/ops/loadFamilyReleaseGate.ts';
import { parseOperationsOwners } from '../src/ops/owners.ts';

const here = dirname(fileURLToPath(import.meta.url));
const deploy = join(here, '../deploy');

const runbooks = [
  'deploy/family-ops-runbook.txt',
  'deploy/incident-runbooks.txt',
  'deploy/restore-runbook.txt',
  'deploy/migration-cutover-runbook.txt',
];

function existingRunbooks(): Set<string> {
  return new Set(
    [
      'family-ops-runbook.txt',
      'incident-runbooks.txt',
      'restore-runbook.txt',
      'migration-cutover-runbook.txt',
    ]
      .filter((name) => existsSync(join(deploy, name)))
      .map((name) => `deploy/${name}`),
  );
}

function presentArtifacts() {
  return {
    resticBackupScript: true,
    restoreRunbook: true,
    erasureRegistryModule: true,
    syncRoutesModule: true,
    backupRoutesModule: true,
    familyReleaseGateScript: true,
  };
}

test('current deploy keeps family release candidate closed', () => {
  const result = loadFamilyReleaseGateFromDeploy(deploy);
  assert.equal(result.softwarePrerequisitesOk, true);
  assert.equal(result.liveOpsReady, false);
  assert.equal(result.evidencePackComplete, false);
  assert.equal(result.releaseCandidateOk, false);
  assert.ok(result.blockers.some((b) => b.startsWith('evidence_missing:')));
  assert.ok(result.blockers.some((b) => b.includes('on_call') || b.includes('live_drill')));
  assert.ok(
    result.notes.some((n) => n.toLowerCase().includes('local care')),
  );
  assert.equal(
    result.findings.every((f) => typeof f.id === 'string' && typeof f.ok === 'boolean'),
    true,
  );
});

test('family release gate opens only with live ops and full evidence pack', () => {
  const raw = JSON.parse(readFileSync(join(deploy, 'operations-owners.json'), 'utf8'));
  raw.onCall = {
    primaryName: 'Ada Ops',
    primaryContact: 'ops@example.test',
    availability: 'business-hours-eu',
    deputyName: 'Bea Backup',
    independentRecoveryHolder: 'Cara Keys',
    alertChannelOutsideVps: 'pager-eu',
  };
  raw.liveDrillEvidence = {
    vpsOutageAlarm: 'drill-2026-11-01',
    luksUnlockAfterReboot: 'drill-2026-11-01',
    fullDisk: 'drill-2026-11-02',
    failedBackup: 'drill-2026-11-02',
    identityLoss: 'drill-2026-11-03',
    measuredRpoHours: 12,
    measuredRtoHours: 4,
  };
  raw.roles.familyReleaseGate = 'Ada Ops';
  raw.familyReleaseEvidence = {
    twoPhoneOfflineSync: 'evidence/family/two-phone.md',
    longDisconnectedReplica: 'evidence/family/replica.md',
    conflictMatrix: 'evidence/family/conflicts.md',
    independentSecurityReview: 'evidence/family/sec-review.md',
    remoteBackupNewDeviceRestore: 'evidence/family/restore.md',
    parentTransferLabels: 'evidence/family/parent-labels.md',
    operatorLegalPack: 'evidence/family/legal.md',
    vpsHostMeasurements: 'evidence/family/vps.md',
    managedMigrationLocalDrill: 'evidence/family/migration-drill.md',
    personalColdRegression: 'evidence/personal/release-gate.md',
  };
  const owners = parseOperationsOwners(raw);
  const result = evaluateFamilyReleaseGate({
    owners,
    evidence: owners.familyReleaseEvidence,
    artifacts: presentArtifacts(),
    requiredRunbookPaths: runbooks,
    existingRunbookPaths: existingRunbooks(),
    offHostProbeConfigured: true,
    metricsModuleLoaded: true,
    alertsModuleLoaded: true,
    personalTrackerStaysColdWithoutApi: true,
  });
  assert.equal(result.softwarePrerequisitesOk, true);
  assert.equal(result.liveOpsReady, true);
  assert.equal(result.evidencePackComplete, true);
  assert.equal(result.releaseCandidateOk, true);
  assert.equal(result.blockers.length, 0);
});

test('missing security review alone keeps the candidate closed', () => {
  const raw = JSON.parse(readFileSync(join(deploy, 'operations-owners.json'), 'utf8'));
  raw.onCall = {
    primaryName: 'Ada Ops',
    primaryContact: 'ops@example.test',
    availability: 'business-hours-eu',
    deputyName: null,
    independentRecoveryHolder: 'Cara Keys',
    alertChannelOutsideVps: 'pager-eu',
  };
  raw.liveDrillEvidence = {
    vpsOutageAlarm: 'd1',
    luksUnlockAfterReboot: 'd1',
    fullDisk: 'd1',
    failedBackup: 'd1',
    identityLoss: 'd1',
    measuredRpoHours: 6,
    measuredRtoHours: 2,
  };
  raw.roles.familyReleaseGate = 'Ada Ops';
  const evidence = {
    ...emptyFamilyReleaseEvidence(),
    twoPhoneOfflineSync: 'ok',
    longDisconnectedReplica: 'ok',
    conflictMatrix: 'ok',
    independentSecurityReview: null,
    remoteBackupNewDeviceRestore: 'ok',
    parentTransferLabels: 'ok',
    operatorLegalPack: 'ok',
    vpsHostMeasurements: 'ok',
    managedMigrationLocalDrill: 'ok',
    personalColdRegression: 'ok',
  };
  const owners = parseOperationsOwners(raw);
  const result = evaluateFamilyReleaseGate({
    owners,
    evidence,
    artifacts: presentArtifacts(),
    requiredRunbookPaths: runbooks,
    existingRunbookPaths: existingRunbooks(),
    offHostProbeConfigured: true,
    metricsModuleLoaded: true,
    alertsModuleLoaded: true,
    personalTrackerStaysColdWithoutApi: true,
  });
  assert.equal(result.releaseCandidateOk, false);
  assert.ok(result.blockers.includes('evidence_missing:independentSecurityReview'));
});

test('personal API dependency blocks software prerequisites', () => {
  const raw = JSON.parse(readFileSync(join(deploy, 'operations-owners.json'), 'utf8'));
  const owners = parseOperationsOwners(raw);
  const result = evaluateFamilyReleaseGate({
    owners,
    evidence: emptyFamilyReleaseEvidence(),
    artifacts: presentArtifacts(),
    requiredRunbookPaths: runbooks,
    existingRunbookPaths: existingRunbooks(),
    offHostProbeConfigured: false,
    metricsModuleLoaded: true,
    alertsModuleLoaded: true,
    personalTrackerStaysColdWithoutApi: false,
  });
  assert.equal(result.softwarePrerequisitesOk, false);
  assert.ok(result.blockers.includes('personal_tracker_requires_api'));
});

test('family-release-gate.sh is present next to ops-readiness', () => {
  assert.equal(existsSync(join(deploy, 'family-release-gate.sh')), true);
  assert.equal(existsSync(join(deploy, 'ops-readiness.sh')), true);
});
