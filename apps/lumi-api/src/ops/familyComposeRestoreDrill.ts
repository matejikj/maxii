import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { evaluateFamilyOpsReadiness } from './familyOpsReadiness.ts';
import { parseOperationsOwners } from './owners.ts';

const execFileAsync = promisify(execFile);

export type FamilyComposeRestoreDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type FamilyComposeRestoreDrillResult = {
  readonly ok: boolean;
  readonly softwareReady: boolean;
  /** Local Compose restore never opens the family live gate. */
  readonly liveReady: false;
  readonly liveDrillEvidenceMutated: false;
  /** Wall-clock restore seconds for software exercise only. */
  readonly softwareMeasuredRtoSeconds: number | null;
  /** Seconds from last seeded write to dump capture (local exercise). */
  readonly softwareMeasuredRpoSeconds: number | null;
  readonly cases: readonly FamilyComposeRestoreDrillCase[];
};

function caseOf(name: string, ok: boolean, detail: string): FamilyComposeRestoreDrillCase {
  return { name, ok, detail };
}

function withDatabaseName(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function withClient<T>(url: string, work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/**
 * Logical dump → restore into a throwaway Compose database. Proves the restore
 * runbook order on local Docker without LUKS, off-host paging, or filling
 * liveDrillEvidence.
 */
export async function runFamilyComposeRestoreDrill(input: {
  readonly deployDir: string;
  readonly adminDatabaseUrl: string;
  readonly composeFile: string;
}): Promise<FamilyComposeRestoreDrillResult> {
  const cases: FamilyComposeRestoreDrillCase[] = [];
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
  cases.push(
    caseOf(
      'software_ready',
      readiness.softwareReady,
      readiness.softwareReady ? 'ops software artifacts present' : readiness.blockers.join(','),
    ),
  );
  cases.push(
    caseOf(
      'live_ready_stays_false',
      readiness.liveReady === false,
      readiness.liveReady
        ? 'compose restore must not claim liveReady'
        : `liveReady=false (${readiness.blockers.length} live blockers)`,
    ),
  );

  const markerId = randomUUID();
  const restoreDb = `lumi_restore_${markerId.replace(/-/g, '').slice(0, 10)}`;
  let softwareMeasuredRtoSeconds: number | null = null;
  let softwareMeasuredRpoSeconds: number | null = null;

  const compose = async (args: string[]) =>
    execFileAsync('docker', ['compose', '-f', input.composeFile, ...args], {
      cwd: input.deployDir,
      maxBuffer: 4 * 1024 * 1024,
    });

  try {
    const lastWriteAtMs = Date.now();
    await withClient(input.adminDatabaseUrl, async (client) => {
      await client.query(
        `insert into app_user (app_user_id, status) values ($1, 'active')
         on conflict (app_user_id) do nothing`,
        [markerId],
      );
    });
    cases.push(caseOf('seed_marker_user', true, `seeded marker user ${markerId.slice(0, 8)}…`));

    await compose([
      'exec',
      '-T',
      'postgres',
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'lumi_app',
      '--format=custom',
      '--file=/tmp/lumi_restore_drill.dump',
    ]);
    softwareMeasuredRpoSeconds = Math.max(0, Math.round((Date.now() - lastWriteAtMs) / 1000));
    cases.push(
      caseOf(
        'logical_pg_dump',
        true,
        `custom dump captured inside Compose (software RPO≈${softwareMeasuredRpoSeconds}s)`,
      ),
    );

    await withClient(input.adminDatabaseUrl, async (client) => {
      await client.query(`drop database if exists ${restoreDb}`);
      await client.query(`create database ${restoreDb}`);
    });

    const restoreStarted = Date.now();
    await compose([
      'exec',
      '-T',
      'postgres',
      'pg_restore',
      '-U',
      'postgres',
      '-d',
      restoreDb,
      '--clean',
      '--if-exists',
      '--no-owner',
      '/tmp/lumi_restore_drill.dump',
    ]);
    softwareMeasuredRtoSeconds = Math.max(1, Math.round((Date.now() - restoreStarted) / 1000));

    const marker = await withClient(
      withDatabaseName(input.adminDatabaseUrl, restoreDb),
      async (client) =>
        client.query(`select status from app_user where app_user_id = $1`, [markerId]),
    );
    const markerOk = marker.rowCount === 1 && marker.rows[0]?.status === 'active';
    cases.push(
      caseOf(
        'restore_marker_present',
        markerOk,
        markerOk
          ? `restored DB contains marker (software RTO≈${softwareMeasuredRtoSeconds}s)`
          : 'marker missing after restore',
      ),
    );

    cases.push(
      caseOf(
        'working_targets_not_exceeded',
        softwareMeasuredRtoSeconds <= owners.workingTargets.rtoHours * 3600 &&
          (softwareMeasuredRpoSeconds ?? 0) <= owners.workingTargets.rpoHours * 3600,
        `local timings within working RPO ${owners.workingTargets.rpoHours}h / RTO ${owners.workingTargets.rtoHours}h targets`,
      ),
    );

    cases.push(
      caseOf(
        'erasure_before_ready_policy',
        owners.backup.erasureRegistryMustPrecedeServerConfirm === true,
        'restore runbook still requires current erasure registry before /ready',
      ),
    );
  } catch (error) {
    cases.push(
      caseOf(
        'compose_restore_failed',
        false,
        error instanceof Error ? error.message : 'restore drill failed',
      ),
    );
  } finally {
    try {
      await withClient(input.adminDatabaseUrl, async (client) => {
        await client.query(`drop database if exists ${restoreDb}`);
        await client.query(`delete from app_user where app_user_id = $1`, [markerId]);
      });
    } catch {
      // ignore cleanup
    }
  }

  const ownersRawAfter = readFileSync(ownersPath, 'utf8');
  cases.push(
    caseOf(
      'live_drill_evidence_untouched',
      ownersRawAfter === ownersRawBefore,
      ownersRawAfter === ownersRawBefore
        ? 'operations-owners.json liveDrillEvidence unchanged'
        : 'owners file mutated — refuse to claim live evidence',
    ),
  );

  try {
    // reports/ is gitignored — never treat this file as liveDrillEvidence.
    writeFileSync(
      join(input.deployDir, '..', 'reports', 'compose-restore-drill-last.json'),
      `${JSON.stringify(
        {
          at: new Date().toISOString(),
          liveReady: false,
          softwareMeasuredRpoSeconds,
          softwareMeasuredRtoSeconds,
          note: 'Local Compose only — not LUKS/VPS liveDrillEvidence',
        },
        null,
        2,
      )}\n`,
    );
  } catch {
    // optional report
  }

  return {
    ok: cases.every((row) => row.ok),
    softwareReady: readiness.softwareReady,
    liveReady: false,
    liveDrillEvidenceMutated: false,
    softwareMeasuredRtoSeconds,
    softwareMeasuredRpoSeconds,
    cases,
  };
}

export const LOCAL_COMPOSE_RESTORE_DRILL_DEFAULTS = {
  adminDatabaseUrl: 'postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app',
} as const;
