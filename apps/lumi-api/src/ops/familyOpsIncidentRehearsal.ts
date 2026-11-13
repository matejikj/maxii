import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFamilyOpsMetrics } from './familyMetrics.ts';
import { evaluateFamilyAlerts } from './familyAlerts.ts';
import {
  INCIDENT_PLAYBOOKS,
  simulateIncidentResponse,
  type IncidentKind,
} from './incidentPlaybooks.ts';
import { evaluateFamilyOpsReadiness } from './familyOpsReadiness.ts';
import { parseOperationsOwners } from './owners.ts';

export type FamilyOpsIncidentRehearsalCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type FamilyOpsIncidentRehearsalResult = {
  readonly ok: boolean;
  readonly softwareReady: boolean;
  /** Software tabletop never flips live readiness. */
  readonly liveReady: false;
  /** Owners file liveDrillEvidence must stay untouched by this rehearsal. */
  readonly liveDrillEvidenceMutated: false;
  readonly localTrackerRemainsAvailable: true;
  readonly remoteKillSwitchForbidden: true;
  readonly cases: readonly FamilyOpsIncidentRehearsalCase[];
};

/** Critical drills that still need a real host before family release. */
export const CRITICAL_SOFTWARE_REHEARSAL_KINDS = [
  'vps_total_outage',
  'disk_full',
  'database_failure',
  'identity_loss',
  'token_leak',
  'foreign_access',
] as const satisfies readonly IncidentKind[];

/**
 * Tabletop rehearsal of family-ops incidents against local artifacts.
 * Proves playbooks, alert wiring, and the local-tracker invariant without
 * filling liveDrillEvidence or claiming a measured host RPO/RTO.
 */
export async function runFamilyOpsIncidentRehearsal(input: {
  readonly deployDir: string;
  /** Optional Compose Postgres admin URL — reachability only, not a live restore. */
  readonly adminDatabaseUrl?: string | null;
  readonly nowMs?: number;
}): Promise<FamilyOpsIncidentRehearsalResult> {
  const cases: FamilyOpsIncidentRehearsalCase[] = [];
  const nowMs = input.nowMs ?? Date.now();

  const ownersPath = join(input.deployDir, 'operations-owners.json');
  const ownersRawBefore = readFileSync(ownersPath, 'utf8');
  const owners = parseOperationsOwners(JSON.parse(ownersRawBefore) as unknown);

  const runbooks = [
    'family-ops-runbook.txt',
    'incident-runbooks.txt',
    'restore-runbook.txt',
    'migration-cutover-runbook.txt',
  ];
  const existing = new Set(runbooks.filter((name) => existsSync(join(input.deployDir, name))));
  const readiness = evaluateFamilyOpsReadiness({
    owners,
    requiredRunbookPaths: runbooks,
    existingRunbookPaths: existing,
    offHostProbeConfigured: false,
    metricsModuleLoaded: true,
    alertsModuleLoaded: true,
  });
  cases.push({
    name: 'software_ready',
    ok: readiness.softwareReady,
    detail: readiness.softwareReady
      ? 'runbooks/metrics/alerts present'
      : readiness.blockers.join(','),
  });
  cases.push({
    name: 'live_ready_stays_false',
    ok: readiness.liveReady === false,
    detail: readiness.liveReady
      ? 'rehearsal must not claim liveReady'
      : `liveReady=false (${readiness.blockers.length} live blockers)`,
  });

  for (const kind of CRITICAL_SOFTWARE_REHEARSAL_KINDS) {
    const simulated = simulateIncidentResponse(kind);
    const playbook = INCIDENT_PLAYBOOKS[kind];
    const ok =
      simulated.localTrackerAvailable &&
      !simulated.wipeOrLockHistoryAttempted &&
      playbook.localTrackerRemainsAvailable &&
      playbook.remoteKillSwitchForbidden &&
      playbook.steps.length >= 2;
    cases.push({
      name: `rehearse_${kind}`,
      ok,
      detail: ok
        ? `tabletop ok; owner=${playbook.ownerRole}; local tracker kept`
        : 'playbook invariant failed',
    });
  }

  const metrics = createFamilyOpsMetrics();
  metrics.recordBackupAttempt({ ok: false, atMs: nowMs - 60_000 });
  metrics.setQueueBacklog(0);
  const alerts = evaluateFamilyAlerts(metrics.snapshot(), {
    nowMs,
    offHostProbeConfigured: false,
  });
  const failedBackup = alerts.alerts.some((row) => row.id === 'backup_failed');
  const offHostRequired = alerts.alerts.some(
    (row) => row.id === 'external_host_probe_required' && row.requiresOffHostChannel,
  );
  cases.push({
    name: 'failed_backup_alert_fires',
    ok: failedBackup,
    detail: failedBackup
      ? 'backup_failed alert wired with restore runbook'
      : 'backup_failed alert missing',
  });
  cases.push({
    name: 'off_host_probe_still_required',
    ok: offHostRequired,
    detail: offHostRequired
      ? 'critical alerts still demand a channel outside the VPS'
      : 'off-host requirement missing',
  });

  if (input.adminDatabaseUrl) {
    try {
      const pg = await import('pg');
      const client = new pg.default.Client({
        connectionString: input.adminDatabaseUrl,
        connectionTimeoutMillis: 2_500,
      });
      await client.connect();
      await client.query('select 1');
      await client.end();
      cases.push({
        name: 'compose_postgres_reachable',
        ok: true,
        detail: 'local Compose Postgres answers; this is not a LUKS/VPS restore drill',
      });
    } catch (error) {
      cases.push({
        name: 'compose_postgres_reachable',
        ok: false,
        detail: error instanceof Error ? error.message : 'postgres unreachable',
      });
    }
  } else {
    cases.push({
      name: 'compose_postgres_reachable',
      ok: true,
      detail: 'skipped (no admin URL; in-process tabletop only)',
    });
  }

  const ownersRawAfter = readFileSync(ownersPath, 'utf8');
  cases.push({
    name: 'owners_file_unchanged',
    ok: ownersRawAfter === ownersRawBefore,
    detail:
      ownersRawAfter === ownersRawBefore
        ? 'liveDrillEvidence left null; rehearsal does not forge live proof'
        : 'owners file was mutated — forbidden for software rehearsal',
  });
  cases.push({
    name: 'measured_rpo_rto_not_claimed',
    ok:
      owners.liveDrillEvidence.measuredRpoHours == null &&
      owners.liveDrillEvidence.measuredRtoHours == null,
    detail: 'software tabletop timings are not live RPO/RTO',
  });

  return {
    ok: cases.every((row) => row.ok),
    softwareReady: readiness.softwareReady,
    liveReady: false,
    liveDrillEvidenceMutated: false,
    localTrackerRemainsAvailable: true,
    remoteKillSwitchForbidden: true,
    cases,
  };
}
