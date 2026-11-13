import { evaluateFamilyOpsReadiness, type FamilyOpsReadiness } from './familyOpsReadiness.ts';
import { isAssigned, type OperationsOwnersDocument } from './owners.ts';

/**
 * Family release candidate gate. Software prerequisites can pass while live
 * drills and evidence slots stay open — a green CI checklist alone never means
 * two offline phones or a measured restore succeeded.
 */

export type FamilyReleaseEvidence = {
  readonly twoPhoneOfflineSync: string | null;
  readonly longDisconnectedReplica: string | null;
  readonly conflictMatrix: string | null;
  readonly independentSecurityReview: string | null;
  readonly remoteBackupNewDeviceRestore: string | null;
  readonly parentTransferLabels: string | null;
  readonly operatorLegalPack: string | null;
  readonly vpsHostMeasurements: string | null;
  readonly managedMigrationLocalDrill: string | null;
  /** Personal release / cold-remote regression proof (commit or evidence path). */
  readonly personalColdRegression: string | null;
};

export type FamilyReleaseGateFinding = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type FamilyReleaseGateResult = {
  /** Runbooks, metrics, backup/erasure modules, and owners schema. */
  readonly softwarePrerequisitesOk: boolean;
  /** Named on-call + measured live drills from family ops readiness. */
  readonly liveOpsReady: boolean;
  /** Every release evidence slot filled with a non-placeholder reference. */
  readonly evidencePackComplete: boolean;
  /**
   * True only when software, live ops, and evidence are all complete.
   * Publishing while this is false is an unauthorized release step.
   */
  readonly releaseCandidateOk: boolean;
  readonly findings: readonly FamilyReleaseGateFinding[];
  readonly blockers: readonly string[];
  readonly notes: readonly string[];
  readonly opsReadiness: FamilyOpsReadiness;
};

export type FamilyReleaseArtifactPaths = {
  readonly resticBackupScript: boolean;
  readonly restoreRunbook: boolean;
  readonly erasureRegistryModule: boolean;
  readonly syncRoutesModule: boolean;
  readonly backupRoutesModule: boolean;
  readonly familyReleaseGateScript: boolean;
};

const EVIDENCE_KEYS = [
  'twoPhoneOfflineSync',
  'longDisconnectedReplica',
  'conflictMatrix',
  'independentSecurityReview',
  'remoteBackupNewDeviceRestore',
  'parentTransferLabels',
  'operatorLegalPack',
  'vpsHostMeasurements',
  'managedMigrationLocalDrill',
  'personalColdRegression',
] as const satisfies ReadonlyArray<keyof FamilyReleaseEvidence>;

function finding(id: string, ok: boolean, detail: string): FamilyReleaseGateFinding {
  return { id, ok, detail };
}

function evidenceFilled(value: string | null): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== 'UNASSIGNED' && trimmed !== 'TODO';
}

export function emptyFamilyReleaseEvidence(): FamilyReleaseEvidence {
  return {
    twoPhoneOfflineSync: null,
    longDisconnectedReplica: null,
    conflictMatrix: null,
    independentSecurityReview: null,
    remoteBackupNewDeviceRestore: null,
    parentTransferLabels: null,
    operatorLegalPack: null,
    vpsHostMeasurements: null,
    managedMigrationLocalDrill: null,
    personalColdRegression: null,
  };
}

/**
 * Evaluate whether a family release candidate may be presented to caregivers.
 * Missing phones, reviews, or live drills stay explicit blockers — never a
 * soft warning that could be waved away by a successful unit suite.
 */
export function evaluateFamilyReleaseGate(input: {
  readonly owners: OperationsOwnersDocument;
  readonly evidence: FamilyReleaseEvidence;
  readonly artifacts: FamilyReleaseArtifactPaths;
  readonly requiredRunbookPaths: readonly string[];
  readonly existingRunbookPaths: ReadonlySet<string>;
  readonly offHostProbeConfigured: boolean;
  readonly metricsModuleLoaded: boolean;
  readonly alertsModuleLoaded: boolean;
  /** When true, local care must remain writable if the API process is down. */
  readonly personalTrackerStaysColdWithoutApi: boolean;
}): FamilyReleaseGateResult {
  const findings: FamilyReleaseGateFinding[] = [];
  const blockers: string[] = [];
  const notes: string[] = [
    'A family API outage must not disable local care writes on installed personal builds.',
    'TLS and disk encryption are not end-to-end encryption of diary content.',
    'Managed-hosting cutover drills are not a completed cloud migration.',
  ];

  findings.push(
    finding(
      'policy.e2ee_claim_false',
      input.owners.e2eeClaim === false,
      input.owners.e2eeClaim === false
        ? 'e2eeClaim stays false'
        : 'e2eeClaim must remain false for this hosting profile',
    ),
  );
  if (input.owners.e2eeClaim !== false) blockers.push('e2ee_claim_must_remain_false');

  findings.push(
    finding(
      'policy.erasure_before_server_confirm',
      input.owners.backup.erasureRegistryMustPrecedeServerConfirm,
      'Erasure registry must precede server-side delete confirmation',
    ),
  );
  if (!input.owners.backup.erasureRegistryMustPrecedeServerConfirm) {
    blockers.push('erasure_registry_gate_disabled');
  }

  findings.push(
    finding(
      'policy.live_pg_copy_forbidden',
      input.owners.backup.livePgDataCopyForbidden,
      'Live PostgreSQL data directory copy is forbidden as a backup method',
    ),
  );
  if (!input.owners.backup.livePgDataCopyForbidden) {
    blockers.push('live_pg_data_copy_allowed');
  }

  findings.push(
    finding(
      'personal.cold_without_api',
      input.personalTrackerStaysColdWithoutApi,
      input.personalTrackerStaysColdWithoutApi
        ? 'Personal tracker stays usable without the family API process'
        : 'Personal tracker must not require a running family API',
    ),
  );
  if (!input.personalTrackerStaysColdWithoutApi) {
    blockers.push('personal_tracker_requires_api');
  }

  const artifactChecks: Array<[keyof FamilyReleaseArtifactPaths, string]> = [
    ['resticBackupScript', 'artifact.restic_backup_script'],
    ['restoreRunbook', 'artifact.restore_runbook'],
    ['erasureRegistryModule', 'artifact.erasure_registry_module'],
    ['syncRoutesModule', 'artifact.sync_routes_module'],
    ['backupRoutesModule', 'artifact.backup_routes_module'],
    ['familyReleaseGateScript', 'artifact.family_release_gate_script'],
  ];
  for (const [key, id] of artifactChecks) {
    const ok = input.artifacts[key];
    findings.push(finding(id, ok, ok ? `${key} present` : `${key} missing`));
    if (!ok) blockers.push(`missing_${key}`);
  }

  const opsReadiness = evaluateFamilyOpsReadiness({
    owners: input.owners,
    requiredRunbookPaths: input.requiredRunbookPaths,
    existingRunbookPaths: input.existingRunbookPaths,
    offHostProbeConfigured: input.offHostProbeConfigured,
    metricsModuleLoaded: input.metricsModuleLoaded,
    alertsModuleLoaded: input.alertsModuleLoaded,
  });
  findings.push(
    finding(
      'ops.software_ready',
      opsReadiness.softwareReady,
      opsReadiness.softwareReady
        ? 'Family ops software checklist ready'
        : `Family ops software blockers: ${opsReadiness.blockers.join(',')}`,
    ),
  );
  findings.push(
    finding(
      'ops.live_ready',
      opsReadiness.liveReady,
      opsReadiness.liveReady
        ? 'Named on-call and live drills recorded'
        : `Live ops blockers: ${opsReadiness.blockers.join(',')}`,
    ),
  );
  for (const blocker of opsReadiness.blockers) {
    if (!blockers.includes(blocker)) blockers.push(blocker);
  }

  let evidenceOk = true;
  for (const key of EVIDENCE_KEYS) {
    const filled = evidenceFilled(input.evidence[key]);
    findings.push(
      finding(
        `evidence.${key}`,
        filled,
        filled ? `${key} referenced` : `${key} evidence slot empty`,
      ),
    );
    if (!filled) {
      evidenceOk = false;
      blockers.push(`evidence_missing:${key}`);
    }
  }

  // Role ownership for the gate itself must be a real person before release.
  const gateOwnerAssigned =
    isAssigned(input.owners.roles.familyReleaseGate) &&
    input.owners.roles.familyReleaseGate !== 'task-32';
  findings.push(
    finding(
      'roles.family_release_owner',
      gateOwnerAssigned,
      gateOwnerAssigned
        ? `Family release owner: ${input.owners.roles.familyReleaseGate}`
        : 'familyReleaseGate role still points at a planning placeholder',
    ),
  );
  if (!gateOwnerAssigned) blockers.push('family_release_owner_unassigned');

  const softwarePrerequisitesOk =
    opsReadiness.softwareReady &&
    input.personalTrackerStaysColdWithoutApi &&
    input.owners.e2eeClaim === false &&
    input.artifacts.resticBackupScript &&
    input.artifacts.restoreRunbook &&
    input.artifacts.erasureRegistryModule &&
    input.artifacts.syncRoutesModule &&
    input.artifacts.backupRoutesModule &&
    input.artifacts.familyReleaseGateScript &&
    input.owners.backup.erasureRegistryMustPrecedeServerConfirm &&
    input.owners.backup.livePgDataCopyForbidden;

  const releaseCandidateOk =
    softwarePrerequisitesOk && opsReadiness.liveReady && evidenceOk && gateOwnerAssigned;

  if (!releaseCandidateOk) {
    notes.push(
      'Release candidate stays closed until live ops readiness and every evidence slot are complete.',
    );
  }

  return {
    softwarePrerequisitesOk,
    liveOpsReady: opsReadiness.liveReady,
    evidencePackComplete: evidenceOk,
    releaseCandidateOk,
    findings,
    blockers,
    notes: [...notes, ...opsReadiness.notes],
    opsReadiness,
  };
}
