import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { AppUserId, FamilyId } from '@lumi/contracts';
import { createAppDbPool, withTenantTransaction } from '../db/pool.ts';
import {
  evaluateChildPrivateServerAccess,
  familyAdminIsChildPrivateSuperuserOnServer,
} from './serverAccessMatrix.ts';

export type ChildPrivatePostgresRlsDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ChildPrivatePostgresRlsDrillResult = {
  readonly ok: boolean;
  /** Personal tracker still boots without this API or Postgres. */
  readonly personalColdUnaffected: true;
  readonly familyAdminIsPrivateSuperuser: false;
  readonly cases: readonly ChildPrivatePostgresRlsDrillCase[];
};

const REQUIRED_TABLES = [
  'child_private_project',
  'child_private_portfolio_item',
  'child_private_share_snapshot',
] as const;

/**
 * Proves owner/grant RLS for child-private tables under Compose Postgres.
 * Does not activate live child identity or flip family ops liveReady.
 */
export async function runChildPrivatePostgresRlsDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
}): Promise<ChildPrivatePostgresRlsDrillResult> {
  const cases: ChildPrivatePostgresRlsDrillCase[] = [];

  cases.push({
    name: 'matrix_family_admin_not_superuser',
    ok: familyAdminIsChildPrivateSuperuserOnServer() === false,
    detail: 'typed server matrix keeps family admin out of private rows',
  });

  const matrixOwner = evaluateChildPrivateServerAccess({
    principalKind: 'owner',
    sessionAppUserId: 'child',
    resource: 'project',
    action: 'read',
    ownerAppUserId: 'child',
  });
  const matrixAdmin = evaluateChildPrivateServerAccess({
    principalKind: 'other_adult_admin',
    sessionAppUserId: 'admin',
    resource: 'project',
    action: 'read',
    ownerAppUserId: 'child',
  });
  cases.push({
    name: 'matrix_owner_vs_admin',
    ok: matrixOwner.allowed && !matrixAdmin.allowed,
    detail:
      matrixOwner.allowed && !matrixAdmin.allowed
        ? 'unit matrix: owner allow, family admin deny'
        : 'unit matrix mismatch',
  });

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
  const sibling = randomUUID();
  const parentAdmin = randomUUID();
  const namedParent = randomUUID();
  const foreignAdult = randomUUID();
  const familyId = randomUUID();
  const foreignFamily = randomUUID();
  const projectId = randomUUID();
  const portfolioId = randomUUID();
  const shareId = randomUUID();
  const secretReflection = `secret-reflection-${randomUUID()}`;

  try {
    const tables = await admin.query(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name = any($1::text[])`,
      [REQUIRED_TABLES],
    );
    const names = new Set(tables.rows.map((row) => row.table_name as string));
    const schemaOk = REQUIRED_TABLES.every((name) => names.has(name));
    cases.push({
      name: 'child_private_tables_present',
      ok: schemaOk,
      detail: schemaOk
        ? 'child_private_project + portfolio + share present'
        : 'apply migrations/008_child_private_workspace.sql',
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
       values ($1, 'active'), ($2, 'active'), ($3, 'active'), ($4, 'active'), ($5, 'active')`,
      [childOwner, sibling, parentAdmin, namedParent, foreignAdult],
    );
    await admin.query(
      `insert into family (family_id, display_name, created_by)
       values ($1, 'child-private-a', $2), ($3, 'child-private-b', $4)`,
      [familyId, parentAdmin, foreignFamily, foreignAdult],
    );
    await admin.query(
      `insert into family_membership (membership_id, family_id, app_user_id, role, status)
       values
         ($1, $2, $3, 'admin', 'active'),
         ($4, $2, $5, 'caregiver', 'active'),
         ($6, $2, $7, 'caregiver', 'active'),
         ($8, $9, $10, 'admin', 'active')`,
      [
        randomUUID(),
        familyId,
        parentAdmin,
        randomUUID(),
        namedParent,
        randomUUID(),
        sibling,
        randomUUID(),
        foreignFamily,
        foreignAdult,
      ],
    );
    // Seed as migrator/admin so RLS is not in play for fixture creation.
    await admin.query(
      `insert into child_private_project
         (project_id, owner_app_user_id, linked_child_profile_id, title, intent, reflection, status)
       values ($1, $2, 'child_profile_a', 'Most', 'Stavím', $3, 'active')`,
      [projectId, childOwner, secretReflection],
    );
    await admin.query(
      `insert into child_private_portfolio_item
         (portfolio_item_id, owner_app_user_id, project_id, title, description)
       values ($1, $2, $3, 'Foto mostu', null)`,
      [portfolioId, childOwner, projectId],
    );
    await admin.query(
      `insert into child_private_share_snapshot
         (share_id, owner_app_user_id, source_project_id, published_title, published_body, audience_app_user_ids)
       values ($1, $2, $3, 'Ukázka mostu', 'Jen tato věta.', array[$4]::uuid[])`,
      [shareId, childOwner, projectId, namedParent],
    );
    await admin.query('commit');
    cases.push({
      name: 'seed_principals',
      ok: true,
      detail: 'owner, sibling, admin, named recipient, foreign adult seeded',
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
  try {
    const ownerRead = await withTenantTransaction(
      pool,
      { appUserId: childOwner as AppUserId, familyId: familyId as FamilyId },
      async (client) => {
        const result = await client.query(
          `select title, reflection from child_private_project where project_id = $1`,
          [projectId],
        );
        return result.rows[0] as { title: string; reflection: string } | undefined;
      },
    );
    cases.push({
      name: 'owner_reads_project',
      ok: ownerRead?.title === 'Most' && ownerRead.reflection === secretReflection,
      detail: ownerRead
        ? 'owner reads live project including reflection'
        : 'owner missed own project',
    });

    const adminRead = await withTenantTransaction(
      pool,
      { appUserId: parentAdmin as AppUserId, familyId: familyId as FamilyId },
      async (client) => {
        const result = await client.query(
          `select project_id from child_private_project where project_id = $1`,
          [projectId],
        );
        return result.rowCount ?? 0;
      },
    );
    cases.push({
      name: 'family_admin_project_denied',
      ok: adminRead === 0,
      detail:
        adminRead === 0
          ? 'family admin cannot select child-private project'
          : `admin leaked ${adminRead} project rows`,
    });

    const siblingRead = await withTenantTransaction(
      pool,
      { appUserId: sibling as AppUserId, familyId: familyId as FamilyId },
      async (client) => {
        const projects = await client.query(
          `select project_id from child_private_project where project_id = $1`,
          [projectId],
        );
        const portfolio = await client.query(
          `select portfolio_item_id from child_private_portfolio_item where portfolio_item_id = $1`,
          [portfolioId],
        );
        return (projects.rowCount ?? 0) + (portfolio.rowCount ?? 0);
      },
    );
    cases.push({
      name: 'sibling_project_portfolio_denied',
      ok: siblingRead === 0,
      detail:
        siblingRead === 0
          ? 'sibling cannot read private project or portfolio'
          : `sibling leaked ${siblingRead} rows`,
    });

    const namedShare = await withTenantTransaction(
      pool,
      { appUserId: namedParent as AppUserId, familyId: familyId as FamilyId },
      async (client) => {
        const share = await client.query(
          `select published_body from child_private_share_snapshot where share_id = $1`,
          [shareId],
        );
        const live = await client.query(
          `select reflection from child_private_project where project_id = $1`,
          [projectId],
        );
        return {
          body: share.rows[0]?.published_body as string | undefined,
          liveCount: live.rowCount ?? 0,
        };
      },
    );
    cases.push({
      name: 'named_recipient_share_only',
      ok: namedShare.body === 'Jen tato věta.' && namedShare.liveCount === 0,
      detail:
        namedShare.body === 'Jen tato věta.' && namedShare.liveCount === 0
          ? 'recipient reads frozen share; live reflection stays hidden'
          : 'recipient path leaked live project or missed share',
    });

    const foreignShare = await withTenantTransaction(
      pool,
      { appUserId: foreignAdult as AppUserId, familyId: foreignFamily as FamilyId },
      async (client) => {
        const result = await client.query(
          `select share_id from child_private_share_snapshot where share_id = $1`,
          [shareId],
        );
        return result.rowCount ?? 0;
      },
    );
    cases.push({
      name: 'foreign_family_share_denied',
      ok: foreignShare === 0,
      detail:
        foreignShare === 0
          ? 'foreign adult cannot read unaddressed share'
          : `foreign leaked ${foreignShare} shares`,
    });

    // Revoke via owner session, then prove recipient loses access.
    await withTenantTransaction(
      pool,
      { appUserId: childOwner as AppUserId, familyId: null },
      async (client) => {
        await client.query(
          `update child_private_share_snapshot
             set revoked_at = now()
           where share_id = $1`,
          [shareId],
        );
      },
    );
    const afterRevoke = await withTenantTransaction(
      pool,
      { appUserId: namedParent as AppUserId, familyId: familyId as FamilyId },
      async (client) => {
        const result = await client.query(
          `select share_id from child_private_share_snapshot where share_id = $1`,
          [shareId],
        );
        return result.rowCount ?? 0;
      },
    );
    cases.push({
      name: 'revoked_share_hidden_from_recipient',
      ok: afterRevoke === 0,
      detail:
        afterRevoke === 0
          ? 'revoked share disappears for the named recipient'
          : 'revoked share remained visible',
    });

    // Spoof attempt: body claims another owner while session is the admin.
    const spoofInsert = await withTenantTransaction(
      pool,
      { appUserId: parentAdmin as AppUserId, familyId: familyId as FamilyId },
      async (client) => {
        try {
          await client.query(
            `insert into child_private_project
               (project_id, owner_app_user_id, title, intent, status)
             values ($1, $2, 'Spoof', 'nope', 'active')`,
            [randomUUID(), childOwner],
          );
          return 'inserted';
        } catch {
          return 'rejected';
        }
      },
    );
    cases.push({
      name: 'spoofed_owner_insert_rejected',
      ok: spoofInsert === 'rejected',
      detail:
        spoofInsert === 'rejected'
          ? 'with check blocks insert as another owner'
          : 'admin inserted a project owned by the child',
    });
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

export const LOCAL_CHILD_PRIVATE_POSTGRES_RLS_DRILL_DEFAULTS = {
  databaseUrl: 'postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app',
  adminDatabaseUrl:
    'postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app',
} as const;
