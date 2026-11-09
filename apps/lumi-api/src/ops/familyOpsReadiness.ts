import { isAssigned, type OperationsOwnersDocument } from './owners.ts';
import { INCIDENT_PLAYBOOKS } from './incidentPlaybooks.ts';
import { MANAGED_MIGRATION_STEPS } from './migrationCutover.ts';

export type FamilyOpsReadiness = {
  /** Runbooks, metrics, alerts, and ownership schema are in place. */
  readonly softwareReady: boolean;
  /** Named on-call + measured live drills — required before family release. */
  readonly liveReady: boolean;
  readonly blockers: readonly string[];
  readonly notes: readonly string[];
};

export function evaluateFamilyOpsReadiness(input: {
  readonly owners: OperationsOwnersDocument;
  readonly requiredRunbookPaths: readonly string[];
  readonly existingRunbookPaths: ReadonlySet<string>;
  readonly offHostProbeConfigured: boolean;
  readonly metricsModuleLoaded: boolean;
  readonly alertsModuleLoaded: boolean;
}): FamilyOpsReadiness {
  const blockers: string[] = [];
  const notes: string[] = [];

  if (input.owners.e2eeClaim) {
    blockers.push('e2ee_claim_must_remain_false');
  }
  if (!input.metricsModuleLoaded || !input.alertsModuleLoaded) {
    blockers.push('family_ops_metrics_or_alerts_missing');
  }
  for (const path of input.requiredRunbookPaths) {
    if (!input.existingRunbookPaths.has(path)) {
      blockers.push(`missing_runbook:${path}`);
    }
  }
  if (Object.keys(INCIDENT_PLAYBOOKS).length < 8) {
    blockers.push('incident_playbooks_incomplete');
  }
  if (MANAGED_MIGRATION_STEPS.length < 5) {
    blockers.push('migration_cutover_incomplete');
  }

  const softwareReady = blockers.length === 0;
  if (!softwareReady) {
    return { softwareReady: false, liveReady: false, blockers, notes };
  }

  notes.push('Personal tracker stays cold without this API process.');

  if (!isAssigned(input.owners.onCall.primaryName)) {
    blockers.push('on_call_primary_unassigned');
  }
  if (!isAssigned(input.owners.onCall.primaryContact)) {
    blockers.push('on_call_contact_unassigned');
  }
  if (!isAssigned(input.owners.onCall.availability)) {
    blockers.push('on_call_availability_unassigned');
  }
  if (!isAssigned(input.owners.onCall.independentRecoveryHolder)) {
    blockers.push('independent_recovery_holder_unassigned');
  }
  if (!isAssigned(input.owners.onCall.alertChannelOutsideVps)) {
    blockers.push('off_host_alert_channel_unassigned');
  }
  if (!input.offHostProbeConfigured) {
    blockers.push('off_host_uptime_probe_not_configured');
  }

  const drills = input.owners.liveDrillEvidence;
  for (const key of [
    'vpsOutageAlarm',
    'luksUnlockAfterReboot',
    'fullDisk',
    'failedBackup',
    'identityLoss',
  ] as const) {
    if (!drills[key]) blockers.push(`live_drill_missing:${key}`);
  }
  if (drills.measuredRpoHours == null || drills.measuredRtoHours == null) {
    blockers.push('live_drill_missing:measured_rpo_rto');
  } else {
    if (drills.measuredRpoHours > input.owners.workingTargets.rpoHours) {
      blockers.push('measured_rpo_exceeds_working_target');
    }
    if (drills.measuredRtoHours > input.owners.workingTargets.rtoHours) {
      blockers.push('measured_rto_exceeds_working_target');
    }
  }

  return {
    softwareReady: true,
    liveReady: blockers.length === 0,
    blockers,
    notes,
  };
}
