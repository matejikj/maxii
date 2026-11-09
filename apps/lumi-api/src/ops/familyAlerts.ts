import type { FamilyOpsMetricsSnapshot } from './familyMetrics.ts';

/** Thresholds for a small single-VPS beta — working alerts, not an SLA. */
export type FamilyAlertThresholds = {
  readonly backupMaxAgeMs: number;
  readonly queueBacklogMax: number;
  readonly rejectRatioMax: number;
  readonly minRequestsForRejectRatio: number;
  readonly syncLagMaxMs: number;
  readonly serverErrorMin: number;
};

export const DEFAULT_FAMILY_ALERT_THRESHOLDS: FamilyAlertThresholds = {
  backupMaxAgeMs: 24 * 60 * 60 * 1000,
  queueBacklogMax: 50,
  rejectRatioMax: 0.35,
  minRequestsForRejectRatio: 20,
  syncLagMaxMs: 6 * 60 * 60 * 1000,
  serverErrorMin: 5,
};

export type FamilyAlertId =
  | 'backup_stale_or_missing'
  | 'backup_failed'
  | 'queue_backlog_high'
  | 'reject_ratio_high'
  | 'sync_lag_high'
  | 'server_errors'
  | 'external_host_probe_required';

export type FamilyAlert = {
  readonly id: FamilyAlertId;
  readonly severity: 'warning' | 'critical';
  readonly ownerRole: 'backupOwner' | 'composeOwner' | 'observabilityOwner' | 'identityOwner';
  /** Concrete runbook file operators open when this fires. */
  readonly runbook: string;
  readonly summary: string;
  /** Delivery must not depend solely on the failing VPS. */
  readonly requiresOffHostChannel: boolean;
};

export type FamilyAlertEvaluation = {
  readonly atMs: number;
  readonly alerts: readonly FamilyAlert[];
  readonly ok: boolean;
};

const RUNBOOK_FAMILY_OPS = 'deploy/family-ops-runbook.txt';
const RUNBOOK_RESTORE = 'deploy/restore-runbook.txt';
const RUNBOOK_INCIDENT = 'deploy/incident-runbooks.txt';

export function evaluateFamilyAlerts(
  snapshot: FamilyOpsMetricsSnapshot,
  options: {
    readonly nowMs?: number;
    readonly thresholds?: Partial<FamilyAlertThresholds>;
    /** True when an independent probe (outside the VPS) is not configured. */
    readonly offHostProbeConfigured?: boolean;
  } = {},
): FamilyAlertEvaluation {
  const nowMs = options.nowMs ?? Date.now();
  const thresholds: FamilyAlertThresholds = {
    ...DEFAULT_FAMILY_ALERT_THRESHOLDS,
    ...options.thresholds,
  };
  const alerts: FamilyAlert[] = [];

  const completed = snapshot.backup.lastCompletedAtMs;
  if (completed == null || nowMs - completed > thresholds.backupMaxAgeMs) {
    alerts.push({
      id: 'backup_stale_or_missing',
      severity: 'critical',
      ownerRole: 'backupOwner',
      runbook: RUNBOOK_RESTORE,
      summary: 'Daily off-server backup is missing or older than the working RPO window.',
      requiresOffHostChannel: true,
    });
  }
  if (snapshot.backup.lastAttemptOk === false) {
    alerts.push({
      id: 'backup_failed',
      severity: 'critical',
      ownerRole: 'backupOwner',
      runbook: RUNBOOK_RESTORE,
      summary: 'Last backup attempt failed; previous live data must stay untouched.',
      requiresOffHostChannel: true,
    });
  }
  if (
    snapshot.queueBacklog != null &&
    snapshot.queueBacklog > thresholds.queueBacklogMax
  ) {
    alerts.push({
      id: 'queue_backlog_high',
      severity: 'warning',
      ownerRole: 'composeOwner',
      runbook: RUNBOOK_FAMILY_OPS,
      summary: `Worker queue backlog is ${snapshot.queueBacklog}.`,
      requiresOffHostChannel: false,
    });
  }
  if (
    snapshot.requestCount >= thresholds.minRequestsForRejectRatio &&
    snapshot.rejectedCount / snapshot.requestCount > thresholds.rejectRatioMax
  ) {
    alerts.push({
      id: 'reject_ratio_high',
      severity: 'warning',
      ownerRole: 'observabilityOwner',
      runbook: RUNBOOK_FAMILY_OPS,
      summary: 'Rejected request ratio exceeded the working threshold.',
      requiresOffHostChannel: false,
    });
  }
  if (
    snapshot.maxSyncLagMs != null &&
    snapshot.maxSyncLagMs > thresholds.syncLagMaxMs
  ) {
    alerts.push({
      id: 'sync_lag_high',
      severity: 'warning',
      ownerRole: 'observabilityOwner',
      runbook: RUNBOOK_FAMILY_OPS,
      summary: `Observed sync lag sample ${snapshot.maxSyncLagMs}ms exceeds the working window.`,
      requiresOffHostChannel: false,
    });
  }
  if (snapshot.serverErrorCount >= thresholds.serverErrorMin) {
    alerts.push({
      id: 'server_errors',
      severity: 'critical',
      ownerRole: 'composeOwner',
      runbook: RUNBOOK_INCIDENT,
      summary: 'Repeated 5xx responses recorded without diary payloads.',
      requiresOffHostChannel: true,
    });
  }
  if (options.offHostProbeConfigured === false) {
    alerts.push({
      id: 'external_host_probe_required',
      severity: 'critical',
      ownerRole: 'observabilityOwner',
      runbook: RUNBOOK_FAMILY_OPS,
      summary:
        'No off-host uptime probe is configured; a total VPS outage would be silent.',
      requiresOffHostChannel: true,
    });
  }

  return {
    atMs: nowMs,
    alerts,
    ok: alerts.every((alert) => alert.severity !== 'critical'),
  };
}
