import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { AppUserId, FamilyId } from '@lumi/contracts';
import { createAppDbPool, withTenantTransaction } from '../db/pool.ts';
import { evaluateFamilyOpsReadiness } from './familyOpsReadiness.ts';
import { parseOperationsOwners } from './owners.ts';

export type FamilyComposeStackDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type FamilyComposeStackDrillResult = {
  readonly ok: boolean;
  readonly liveReady: boolean;
  readonly softwareReady: boolean;
  readonly cases: readonly FamilyComposeStackDrillCase[];
};

const REQUIRED_TABLES = [
  'app_user',
  'family',
  'family_membership',
  'family_object',
  'family_sync_state',
  'family_sync_operation',
  'worker_job',
] as const;

/**
 * Local Compose stack proof: Postgres schema/RLS + optional S3Mock health.
 * A healthy local stack never flips family ops liveReady — that still needs
 * named on-call and measured host drills.
 */
export async function runFamilyComposeStackDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
  readonly s3Endpoint?: string | null;
  readonly deployDir: string;
}): Promise<FamilyComposeStackDrillResult> {
  const cases: FamilyComposeStackDrillCase[] = [];

  const ownersPath = join(input.deployDir, 'operations-owners.json');
  const runbooks = [
    'family-ops-runbook.txt',
    'incident-runbooks.txt',
    'restore-runbook.txt',
    'migration-cutover-runbook.txt',
  ];
  const existing = new Set(runbooks.filter((name) => existsSync(join(input.deployDir, name))));
  const owners = parseOperationsOwners(JSON.parse(readFileSync(ownersPath, 'utf8')) as unknown);
  const readiness = evaluateFamilyOpsReadiness({
    owners,
    requiredRunbookPaths: runbooks,
    existingRunbookPaths: existing,
    offHostProbeConfigured: false,
    metricsModuleLoaded: true,
    alertsModuleLoaded: true,
  });
  cases.push({
    name: 'ops_software_ready',
    ok: readiness.softwareReady,
    detail: readiness.softwareReady ? 'software checklist ready' : readiness.blockers.join(','),
  });
  cases.push({
    name: 'ops_live_ready_stays_false',
    ok: readiness.liveReady === false,
    detail: readiness.liveReady
      ? 'local compose must not claim liveReady'
      : `liveReady=false (${readiness.blockers.length} live blockers)`,
  });

  const admin = new pg.Client({
    connectionString: input.adminDatabaseUrl,
    connectionTimeoutMillis: 5_000,
  });
  try {
    await admin.connect();
    cases.push({
      name: 'postgres_reachable',
      ok: true,
      detail: 'admin connection ok',
    });
  } catch (error) {
    cases.push({
      name: 'postgres_reachable',
      ok: false,
      detail: error instanceof Error ? error.message : 'connect failed',
    });
    return {
      ok: false,
      liveReady: readiness.liveReady,
      softwareReady: readiness.softwareReady,
      cases,
    };
  }

  try {
    const roles = await admin.query(
      `select rolname from pg_roles where rolname = any($1::text[])`,
      [['lumi_app', 'lumi_migrator']],
    );
    const roleNames = new Set(roles.rows.map((row) => row.rolname as string));
    const rolesOk = roleNames.has('lumi_app') && roleNames.has('lumi_migrator');
    cases.push({
      name: 'app_roles',
      ok: rolesOk,
      detail: rolesOk ? 'lumi_app + lumi_migrator present' : 'missing app roles',
    });

    const tables = await admin.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = any($1::text[])`,
      [REQUIRED_TABLES],
    );
    const tableNames = new Set(tables.rows.map((row) => row.table_name as string));
    const missing = REQUIRED_TABLES.filter((name) => !tableNames.has(name));
    cases.push({
      name: 'migrations_applied',
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `tables present (${REQUIRED_TABLES.length})`
          : `missing ${missing.join(',')}`,
    });

    const userA = randomUUID();
    const userB = randomUUID();
    const familyA = randomUUID();
    const familyB = randomUUID();
    const objectA = randomUUID();
    await admin.query('begin');
    await admin.query(
      `insert into app_user (app_user_id, status) values ($1, 'active'), ($2, 'active')`,
      [userA, userB],
    );
    await admin.query(
      `insert into family (family_id, display_name, created_by) values ($1, 'compose-a', $2), ($3, 'compose-b', $4)`,
      [familyA, userA, familyB, userB],
    );
    await admin.query(
      `insert into family_membership (membership_id, family_id, app_user_id, role, status)
       values ($1, $2, $3, 'admin', 'active'), ($4, $5, $6, 'admin', 'active')`,
      [randomUUID(), familyA, userA, randomUUID(), familyB, userB],
    );
    await admin.query(
      `insert into family_object (object_id, family_id, kind, label) values ($1, $2, 'note', 'compose-secret')`,
      [objectA, familyA],
    );
    await admin.query('commit');

    const pool = createAppDbPool(input.databaseUrl);
    try {
      const allowed = await withTenantTransaction(
        pool,
        { appUserId: userA as AppUserId, familyId: familyA as FamilyId },
        async (client) => {
          const result = await client.query(
            `select label from family_object where object_id = $1`,
            [objectA],
          );
          return result.rows[0]?.label as string | undefined;
        },
      );
      const denied = await withTenantTransaction(
        pool,
        { appUserId: userB as AppUserId, familyId: familyA as FamilyId },
        async (client) => {
          const result = await client.query(
            `select label from family_object where object_id = $1`,
            [objectA],
          );
          return result.rowCount;
        },
      );
      const rlsOk = allowed === 'compose-secret' && denied === 0;
      cases.push({
        name: 'rls_tenant_isolation',
        ok: rlsOk,
        detail: rlsOk
          ? 'member reads own object; foreign membership denied'
          : 'RLS isolation failed',
      });
    } finally {
      await pool.end();
    }
  } finally {
    await admin.end().catch(() => undefined);
  }

  if (input.s3Endpoint) {
    try {
      const response = await fetch(`${input.s3Endpoint.replace(/\/$/, '')}/`, {
        method: 'GET',
      });
      cases.push({
        name: 's3mock_reachable',
        ok: response.ok,
        detail: response.ok ? 'local S3-compatible endpoint healthy' : `status ${response.status}`,
      });
    } catch (error) {
      cases.push({
        name: 's3mock_reachable',
        ok: false,
        detail: error instanceof Error ? error.message : 's3 unreachable',
      });
    }
  } else {
    cases.push({
      name: 's3mock_reachable',
      ok: true,
      detail: 'skipped (no endpoint requested)',
    });
  }

  return {
    ok: cases.every((row) => row.ok),
    liveReady: readiness.liveReady,
    softwareReady: readiness.softwareReady,
    cases,
  };
}

export const LOCAL_COMPOSE_STACK_DRILL_DEFAULTS = {
  databaseUrl: 'postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app',
  adminDatabaseUrl: 'postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app',
  s3Endpoint: 'http://127.0.0.1:9090',
} as const;
