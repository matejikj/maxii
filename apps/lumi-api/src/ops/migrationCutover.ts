/**
 * ADR 0006 cutover planning. Distinguishes a local drill from a real activation
 * so operators cannot treat DNS rollback as a safe undo after new writes.
 */

export type CutoverMode = 'drill' | 'activation';

export type CutoverPhase =
  'preflight' | 'checkpoint' | 'single_writer' | 'cutover' | 'verify' | 'rollback_decision';

export type CutoverStep = {
  readonly phase: CutoverPhase;
  readonly id: string;
  readonly summary: string;
  readonly allowedInDrill: boolean;
  readonly mutatesProduction: boolean;
};

export const MANAGED_MIGRATION_STEPS: readonly CutoverStep[] = [
  {
    phase: 'preflight',
    id: 'adapters_ready',
    summary:
      'Verify DB/API/identity/backup adapters against a disposable target — no production flip.',
    allowedInDrill: true,
    mutatesProduction: false,
  },
  {
    phase: 'preflight',
    id: 'account_map',
    summary: 'Prepare verified account map; never auto-claim families by e-mail alone.',
    allowedInDrill: true,
    mutatesProduction: false,
  },
  {
    phase: 'checkpoint',
    id: 'off_server_backup',
    summary: 'Take a verified off-server archive and record erasure-registry generation.',
    allowedInDrill: true,
    mutatesProduction: false,
  },
  {
    phase: 'single_writer',
    id: 'freeze_old_writers',
    summary: 'Pause old writers so only one active writer touches domain data.',
    allowedInDrill: true,
    mutatesProduction: true,
  },
  {
    phase: 'cutover',
    id: 'switch_writer',
    summary: 'Point API/worker at the new writer; keep the public API domain stable.',
    allowedInDrill: false,
    mutatesProduction: true,
  },
  {
    phase: 'verify',
    id: 'sync_and_auth',
    summary: 'Confirm memberships, sync cursors, and login on the new path.',
    allowedInDrill: true,
    mutatesProduction: false,
  },
  {
    phase: 'rollback_decision',
    id: 'dns_rollback_gate',
    summary: 'DNS rollback to the old DB is forbidden after the first confirmed new write.',
    allowedInDrill: true,
    mutatesProduction: false,
  },
];

export type CutoverPlan = {
  readonly mode: CutoverMode;
  readonly steps: readonly CutoverStep[];
  readonly firstConfirmedWriteAtMs: number | null;
  readonly dnsRollbackToOldDbAllowed: boolean;
  readonly reason: string;
};

export function planManagedMigrationCutover(input: {
  readonly mode: CutoverMode;
  readonly firstConfirmedWriteAtMs?: number | null;
  readonly nowMs?: number;
}): CutoverPlan {
  const firstWrite = input.firstConfirmedWriteAtMs ?? null;
  const steps =
    input.mode === 'drill'
      ? MANAGED_MIGRATION_STEPS.filter((step) => step.allowedInDrill)
      : MANAGED_MIGRATION_STEPS;

  if (input.mode === 'drill') {
    return {
      mode: 'drill',
      steps,
      firstConfirmedWriteAtMs: null,
      dnsRollbackToOldDbAllowed: true,
      reason:
        'Drill must not mutate production; DNS rollback practice uses disposable targets only.',
    };
  }

  const dnsRollbackToOldDbAllowed = firstWrite == null;
  return {
    mode: 'activation',
    steps,
    firstConfirmedWriteAtMs: firstWrite,
    dnsRollbackToOldDbAllowed,
    reason: dnsRollbackToOldDbAllowed
      ? 'No confirmed write on the new path yet — rollback to the prior writer may still be considered.'
      : 'Confirmed writes exist on the new path; rolling DNS back onto a stale DB would drop data.',
  };
}

export type GrowthDecision =
  'stay_on_vps' | 'resize_vps_first' | 'evaluate_managed_profile' | 'blocked_missing_measurements';

export type GrowthSignal = {
  readonly sustainedRamPressure: boolean;
  readonly sustainedDiskPressure: boolean;
  readonly dbConnectionSaturation: boolean;
  readonly p95LatencyMs: number | null;
  readonly queueBacklog: number | null;
  readonly measuredRpoHours: number | null;
  readonly measuredRtoHours: number | null;
  readonly rpoTargetHours: number;
  readonly rtoTargetHours: number;
};

/**
 * Measurable triggers only — never auto-create cloud accounts or flip data.
 */
export function evaluateGrowthDecision(signal: GrowthSignal): {
  readonly decision: GrowthDecision;
  readonly rationale: string;
  readonly autoProvisionForbidden: true;
} {
  const hasLatency = signal.p95LatencyMs != null;
  const hasQueue = signal.queueBacklog != null;
  const hasRecovery = signal.measuredRpoHours != null && signal.measuredRtoHours != null;
  if (!hasLatency && !hasQueue && !hasRecovery && !signal.sustainedRamPressure) {
    return {
      decision: 'blocked_missing_measurements',
      rationale: 'Collect RAM/disk/latency/backlog and a restore drill before changing hosting.',
      autoProvisionForbidden: true,
    };
  }

  const recoveryMiss =
    (signal.measuredRpoHours != null && signal.measuredRpoHours > signal.rpoTargetHours) ||
    (signal.measuredRtoHours != null && signal.measuredRtoHours > signal.rtoTargetHours);

  if (
    signal.sustainedRamPressure ||
    signal.sustainedDiskPressure ||
    signal.dbConnectionSaturation ||
    (signal.p95LatencyMs != null && signal.p95LatencyMs > 800) ||
    (signal.queueBacklog != null && signal.queueBacklog > 100)
  ) {
    return {
      decision: 'resize_vps_first',
      rationale:
        'Pressure is present — size or optimize the current VPS before paid managed cutover.',
      autoProvisionForbidden: true,
    };
  }

  if (recoveryMiss) {
    return {
      decision: 'evaluate_managed_profile',
      rationale:
        'Working RPO/RTO targets were missed after VPS tuning — cost a managed profile; do not auto-flip.',
      autoProvisionForbidden: true,
    };
  }

  return {
    decision: 'stay_on_vps',
    rationale: 'Measured load and recovery fit the cheap single-VPS beta.',
    autoProvisionForbidden: true,
  };
}
