import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { AppUserId } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { createAppDbPool } from '../db/pool.ts';
import { createPostgresChildPrivateSyncStore } from './postgresChildPrivateSyncStore.ts';
import { hashChildPrivatePayload } from './childPrivateSyncStore.ts';

export type ChildPrivatePostgresSyncDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ChildPrivatePostgresSyncDrillResult = {
  readonly ok: boolean;
  readonly personalColdUnaffected: true;
  readonly familyAdminIsPrivateSuperuser: false;
  readonly cases: readonly ChildPrivatePostgresSyncDrillCase[];
};

/**
 * Proves durable child-private sync ledger under Compose Postgres RLS.
 * Does not wire HTTP routes or claim live child identity.
 */
export async function runChildPrivatePostgresSyncDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
}): Promise<ChildPrivatePostgresSyncDrillResult> {
  const cases: ChildPrivatePostgresSyncDrillCase[] = [];
  const admin = new pg.Client({
    connectionString: input.adminDatabaseUrl,
    connectionTimeoutMillis: 5_000,
  });

  try {
    await admin.connect();
  } catch (error) {
    cases.push({
      name: 'postgres_reachable',
      ok: false,
      detail: error instanceof Error ? error.message : 'admin connect failed',
    });
    return {
      ok: false,
      personalColdUnaffected: true,
      familyAdminIsPrivateSuperuser: false,
      cases,
    };
  }

  const childOwner = randomUUID();
  const parentAdmin = randomUUID();
  const namedParent = randomUUID();
  const sibling = randomUUID();
  const familyId = randomUUID();

  try {
    const tables = await admin.query(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name = any($1::text[])`,
      [['child_private_sync_ledger', 'child_private_sync_state', 'child_private_sync_operation']],
    );
    const names = new Set(tables.rows.map((row) => row.table_name as string));
    const schemaOk =
      names.has('child_private_sync_ledger') &&
      names.has('child_private_sync_state') &&
      names.has('child_private_sync_operation');
    cases.push({
      name: 'sync_tables_present',
      ok: schemaOk,
      detail: schemaOk
        ? 'child_private_sync ledger/state/operation present'
        : 'apply migrations/009_child_private_sync.sql',
    });
    if (!schemaOk) {
      await admin.end().catch(() => undefined);
      return {
        ok: false,
        personalColdUnaffected: true,
        familyAdminIsPrivateSuperuser: false,
        cases,
      };
    }

    await admin.query('begin');
    await admin.query(
      `insert into app_user (app_user_id, status)
       values ($1, 'active'), ($2, 'active'), ($3, 'active'), ($4, 'active')`,
      [childOwner, parentAdmin, namedParent, sibling],
    );
    await admin.query(
      `insert into family (family_id, display_name, created_by) values ($1, 'cp-sync', $2)`,
      [familyId, parentAdmin],
    );
    await admin.query(
      `insert into family_membership (membership_id, family_id, app_user_id, role, status)
       values
         ($1, $2, $3, 'admin', 'active'),
         ($4, $2, $5, 'caregiver', 'active'),
         ($6, $2, $7, 'caregiver', 'active')`,
      [randomUUID(), familyId, parentAdmin, randomUUID(), namedParent, randomUUID(), sibling],
    );
    await admin.query('commit');
    cases.push({
      name: 'seed_principals',
      ok: true,
      detail: 'owner, admin, named recipient, sibling seeded',
    });
  } catch (error) {
    try {
      await admin.query('rollback');
    } catch {
      // ignore
    }
    cases.push({
      name: 'seed_principals',
      ok: false,
      detail: error instanceof Error ? error.message : 'seed failed',
    });
    await admin.end().catch(() => undefined);
    return {
      ok: false,
      personalColdUnaffected: true,
      familyAdminIsPrivateSuperuser: false,
      cases,
    };
  } finally {
    await admin.end().catch(() => undefined);
  }

  const pool = createAppDbPool(input.databaseUrl);
  const store = createPostgresChildPrivateSyncStore(pool);
  const secret = `secret-reflection-${randomUUID()}`;

  try {
    const projectPayload = {
      title: 'Most',
      reflection: secret,
      status: 'active',
    };
    const sharePayload = {
      publishedTitle: 'Ukázka mostu',
      publishedBody: 'Jen tato věta.',
      audienceAppUserIds: [namedParent],
    };
    const projectOp = {
      schemaVersion: LUMI_API_PROTOCOL_VERSION,
      operationId: randomUUID(),
      deviceId: 'drill-device',
      actorAppUserId: childOwner as AppUserId,
      kind: 'child_private.project.upsert',
      entityId: randomUUID(),
      revisionId: randomUUID(),
      parentRevisionIds: [] as string[],
      payloadHash: hashChildPrivatePayload(projectPayload),
      payload: projectPayload,
    };
    const shareOp = {
      schemaVersion: LUMI_API_PROTOCOL_VERSION,
      operationId: randomUUID(),
      deviceId: 'drill-device',
      actorAppUserId: childOwner as AppUserId,
      kind: 'child_private.share.publish',
      entityId: randomUUID(),
      revisionId: randomUUID(),
      parentRevisionIds: [] as string[],
      payloadHash: hashChildPrivatePayload(sharePayload),
      payload: sharePayload,
    };

    const push = await store.push({
      ownerAppUserId: childOwner as AppUserId,
      sessionAppUserId: childOwner as AppUserId,
      attemptId: randomUUID(),
      operations: [projectOp, shareOp],
      now: new Date().toISOString(),
    });
    cases.push({
      name: 'owner_push_accepted',
      ok: push.receipts.length === 2 && push.receipts.every((row) => row.status === 'accepted'),
      detail: push.receipts.every((row) => row.status === 'accepted')
        ? 'owner accepted project + share into durable ledger'
        : `receipts=${push.receipts.map((row) => row.status).join(',')}`,
    });

    const ownerPull = await store.pull({
      sessionAppUserId: childOwner as AppUserId,
      cursor: null,
    });
    cases.push({
      name: 'owner_pull_includes_reflection',
      ok:
        ownerPull.entries.length === 2 &&
        ownerPull.entries.some(
          (row) => row.kind === 'child_private.project.upsert' && row.payload.reflection === secret,
        ),
      detail: ownerPull.entries.some((row) => row.payload.reflection === secret)
        ? 'owner reads durable project with reflection'
        : 'owner pull missed reflection',
    });

    const adminPull = await store.pull({
      sessionAppUserId: parentAdmin as AppUserId,
      cursor: null,
    });
    cases.push({
      name: 'family_admin_pull_empty',
      ok: adminPull.entries.length === 0,
      detail:
        adminPull.entries.length === 0
          ? 'family admin cannot read child-private sync ledger'
          : `admin leaked ${adminPull.entries.length} entries`,
    });

    const siblingPull = await store.pull({
      sessionAppUserId: sibling as AppUserId,
      cursor: null,
    });
    cases.push({
      name: 'sibling_pull_empty',
      ok: siblingPull.entries.length === 0,
      detail:
        siblingPull.entries.length === 0
          ? 'sibling cannot read private sync ops'
          : `sibling leaked ${siblingPull.entries.length} entries`,
    });

    const recipientPull = await store.pull({
      sessionAppUserId: namedParent as AppUserId,
      cursor: null,
    });
    const shareOnly =
      recipientPull.entries.length === 1 &&
      recipientPull.entries[0]?.kind === 'child_private.share.publish' &&
      recipientPull.entries[0]?.payload.publishedBody === 'Jen tato věta.' &&
      recipientPull.entries[0]?.payload.reflection === undefined;
    cases.push({
      name: 'recipient_share_only',
      ok: shareOnly && recipientPull.includesLivePrivateProjects === false,
      detail: shareOnly
        ? 'recipient reads frozen share only from durable ledger'
        : 'recipient path leaked live project or missed share',
    });

    const dup = await store.push({
      ownerAppUserId: childOwner as AppUserId,
      sessionAppUserId: childOwner as AppUserId,
      attemptId: randomUUID(),
      operations: [projectOp],
      now: new Date().toISOString(),
    });
    cases.push({
      name: 'duplicate_push_idempotent',
      ok: dup.receipts[0]?.status === 'duplicate',
      detail:
        dup.receipts[0]?.status === 'duplicate'
          ? 'same operation_id returns duplicate receipt'
          : `got ${dup.receipts[0]?.status}`,
    });

    // Spoof: admin tries to insert as child owner through RLS with check.
    const spoofPool = createAppDbPool(input.databaseUrl);
    try {
      const spoof = await createPostgresChildPrivateSyncStore(spoofPool).push({
        ownerAppUserId: childOwner as AppUserId,
        sessionAppUserId: parentAdmin as AppUserId,
        attemptId: randomUUID(),
        operations: [projectOp],
        now: new Date().toISOString(),
      });
      void spoof;
      cases.push({
        name: 'spoofed_session_push_rejected',
        ok: false,
        detail: 'expected forbidden when session !== owner',
      });
    } catch (error) {
      const reason = (error as { reason?: string }).reason;
      cases.push({
        name: 'spoofed_session_push_rejected',
        ok: reason === 'denied_not_owner',
        detail:
          reason === 'denied_not_owner'
            ? 'session/owner mismatch denied before write'
            : `unexpected ${String(error)}`,
      });
    } finally {
      await spoofPool.end();
    }
  } finally {
    await pool.end();
  }

  return {
    ok: cases.every((row) => row.ok),
    personalColdUnaffected: true,
    familyAdminIsPrivateSuperuser: false,
    cases,
  };
}

export const LOCAL_CHILD_PRIVATE_POSTGRES_SYNC_DRILL_DEFAULTS = {
  databaseUrl: 'postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app',
  adminDatabaseUrl: 'postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app',
} as const;
