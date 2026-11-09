import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateFamilyReleaseGate,
  type FamilyReleaseGateResult,
} from './familyReleaseGate.ts';
import { parseOperationsOwners } from './owners.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** Resolve the Compose deploy directory shipped with the family API package. */
export function defaultFamilyDeployRoot(): string {
  return join(here, '../../deploy');
}

/**
 * Load owners + on-disk artifacts and evaluate the family release gate.
 * Safe to run without a purchased VPS; live slots remain blockers.
 */
export function loadFamilyReleaseGateFromDeploy(
  deployRoot = defaultFamilyDeployRoot(),
  options: {
    readonly offHostProbeConfigured?: boolean;
    readonly personalTrackerStaysColdWithoutApi?: boolean;
  } = {},
): FamilyReleaseGateResult {
  const ownersPath = join(deployRoot, 'operations-owners.json');
  const raw = JSON.parse(readFileSync(ownersPath, 'utf8'));
  const owners = parseOperationsOwners(raw);
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
      .filter((name) => existsSync(join(deployRoot, name)))
      .map((name) => `deploy/${name}`),
  );
  const srcRoot = join(deployRoot, '..', 'src');
  return evaluateFamilyReleaseGate({
    owners,
    evidence: owners.familyReleaseEvidence,
    artifacts: {
      resticBackupScript: existsSync(join(deployRoot, 'backup-restic.sh')),
      restoreRunbook: existsSync(join(deployRoot, 'restore-runbook.txt')),
      erasureRegistryModule: existsSync(join(srcRoot, 'backup/erasureRegistry.ts')),
      syncRoutesModule: existsSync(join(srcRoot, 'http/syncRoutes.ts')),
      backupRoutesModule: existsSync(join(srcRoot, 'http/backupRoutes.ts')),
      familyReleaseGateScript: existsSync(join(deployRoot, 'family-release-gate.sh')),
    },
    requiredRunbookPaths: runbooks,
    existingRunbookPaths: existing,
    offHostProbeConfigured: options.offHostProbeConfigured === true,
    metricsModuleLoaded: true,
    alertsModuleLoaded: true,
    personalTrackerStaysColdWithoutApi:
      options.personalTrackerStaysColdWithoutApi !== false,
  });
}
