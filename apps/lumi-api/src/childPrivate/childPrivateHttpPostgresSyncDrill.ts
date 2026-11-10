import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { AppUserId } from '@lumi/contracts';
import { LUMI_API_PROTOCOL_VERSION } from '@lumi/contracts';
import { loadApiConfig } from '../config/env.ts';
import { createFamilyApi } from '../http/createServer.ts';
import { createAppDbPool } from '../db/pool.ts';
import { createPostgresChildPrivateSyncStore } from './postgresChildPrivateSyncStore.ts';
import { hashChildPrivatePayload } from './childPrivateSyncStore.ts';
import { LOCAL_CHILD_PRIVATE_POSTGRES_SYNC_DRILL_DEFAULTS } from './childPrivatePostgresSyncDrill.ts';

export type ChildPrivateHttpPostgresSyncDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type ChildPrivateHttpPostgresSyncDrillResult = {
  readonly ok: boolean;
  readonly personalColdUnaffected: true;
  readonly familyAdminIsPrivateSuperuser: false;
  readonly cases: readonly ChildPrivateHttpPostgresSyncDrillCase[];
};

/**
 * HTTP child-private sync routed through the durable Postgres ledger.
 * Default createFamilyApi boots stay memory so personal mode needs no DB.
 */
export async function runChildPrivateHttpPostgresSyncDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
}): Promise<ChildPrivateHttpPostgresSyncDrillResult> {
  const cases: ChildPrivateHttpPostgresSyncDrillCase[] = [];

  const personal = await createFamilyApi(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'cp-http-pg-personal-cold',
      LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    } as NodeJS.ProcessEnv),
  );
  cases.push({
    name: 'personal_cold_memory_default',
    ok: personal.childPrivateSyncProvider === 'memory',
    detail:
      personal.childPrivateSyncProvider === 'memory'
        ? 'default createFamilyApi keeps child-private sync in memory'
        : `expected memory, got ${personal.childPrivateSyncProvider}`,
  });
  await personal.app.close();

  const admin = new pg.Client({
    connectionString: input.adminDatabaseUrl,
    connectionTimeoutMillis: 5_000,
  });
  const childOwner = randomUUID();
  const parentAdmin = randomUUID();
  const namedParent = randomUUID();

  try {
    await admin.connect();
    const present = await admin.query(
      `select to_regclass('public.child_private_sync_operation') is not null as ok`,
    );
    const schemaOk = present.rows[0]?.ok === true;
    cases.push({
      name: 'sync_ledger_present',
      ok: schemaOk,
      detail: schemaOk
        ? 'child_private_sync_operation present'
        : 'apply migrations/009_child_private_sync.sql',
    });
    if (!schemaOk) {
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
       values ($1, 'active'), ($2, 'active'), ($3, 'active')`,
      [childOwner, parentAdmin, namedParent],
    );
    await admin.query('commit');
    cases.push({
      name: 'seed_principals',
      ok: true,
      detail: 'owner, admin, named recipient seeded for HTTP+PG path',
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
  const durable = createPostgresChildPrivateSyncStore(pool);
  const api = await createFamilyApi(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'cp-http-pg-hs256',
      LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
    } as NodeJS.ProcessEnv),
    {
      childPrivateSync: durable,
      childPrivateSyncProvider: 'postgres',
    },
  );
  cases.push({
    name: 'api_wired_postgres_sync',
    ok: api.childPrivateSyncProvider === 'postgres',
    detail:
      api.childPrivateSyncProvider === 'postgres'
        ? 'createFamilyApi received Postgres child-private sync store'
        : `wired ${api.childPrivateSyncProvider}`,
  });

  try {
    const childToken = await api.tokens.mintTestToken({
      subject: 'child-http-pg',
      appUserId: childOwner as AppUserId,
    });
    const parentToken = await api.tokens.mintTestToken({
      subject: 'parent-http-pg',
      appUserId: parentAdmin as AppUserId,
    });
    const namedToken = await api.tokens.mintTestToken({
      subject: 'named-http-pg',
      appUserId: namedParent as AppUserId,
    });

    const secret = `http-pg-secret-${randomUUID()}`;
    const projectPayload = {
      title: 'Most',
      reflection: secret,
      status: 'active',
    };
    const sharePayload = {
      publishedTitle: 'Ukázka',
      publishedBody: 'Jen tato věta.',
      audienceAppUserIds: [namedParent],
    };
    const push = await api.app.inject({
      method: 'POST',
      url: '/v1/child-private/sync/push',
      headers: { authorization: `Bearer ${childToken}` },
      payload: {
        protocolVersion: LUMI_API_PROTOCOL_VERSION,
        attemptId: randomUUID(),
        operations: [
          {
            schemaVersion: LUMI_API_PROTOCOL_VERSION,
            operationId: randomUUID(),
            deviceId: 'http-pg',
            actorAppUserId: childOwner,
            kind: 'child_private.project.upsert',
            entityId: randomUUID(),
            revisionId: randomUUID(),
            parentRevisionIds: [],
            payloadHash: hashChildPrivatePayload(projectPayload),
            payload: projectPayload,
          },
          {
            schemaVersion: LUMI_API_PROTOCOL_VERSION,
            operationId: randomUUID(),
            deviceId: 'http-pg',
            actorAppUserId: childOwner,
            kind: 'child_private.share.publish',
            entityId: randomUUID(),
            revisionId: randomUUID(),
            parentRevisionIds: [],
            payloadHash: hashChildPrivatePayload(sharePayload),
            payload: sharePayload,
          },
        ],
      },
    });
    cases.push({
      name: 'http_owner_push',
      ok:
        push.statusCode === 200 &&
        push.json().receipts?.every((row: { status: string }) => row.status === 'accepted'),
      detail:
        push.statusCode === 200
          ? 'HTTP push accepted into durable ledger'
          : `status=${push.statusCode}`,
    });

    const ownerPull = await api.app.inject({
      method: 'GET',
      url: '/v1/child-private/sync/pull',
      headers: { authorization: `Bearer ${childToken}` },
    });
    cases.push({
      name: 'http_owner_pull_reflection',
      ok:
        ownerPull.statusCode === 200 &&
        ownerPull.json().entries?.some(
          (row: { payload?: { reflection?: string } }) =>
            row.payload?.reflection === secret,
        ),
      detail:
        ownerPull.json().entries?.some(
          (row: { payload?: { reflection?: string } }) =>
            row.payload?.reflection === secret,
        )
          ? 'owner HTTP pull reads durable reflection'
          : 'owner pull missed reflection',
    });

    const adminPull = await api.app.inject({
      method: 'GET',
      url: '/v1/child-private/sync/pull',
      headers: { authorization: `Bearer ${parentToken}` },
    });
    cases.push({
      name: 'http_admin_pull_empty',
      ok: adminPull.statusCode === 200 && adminPull.json().entries?.length === 0,
      detail:
        adminPull.json().entries?.length === 0
          ? 'family admin HTTP pull stays empty under RLS'
          : `admin leaked ${adminPull.json().entries?.length ?? '?'} entries`,
    });

    const namedPull = await api.app.inject({
      method: 'GET',
      url: '/v1/child-private/sync/pull',
      headers: { authorization: `Bearer ${namedToken}` },
    });
    const entries = namedPull.json().entries ?? [];
    const shareOnly =
      namedPull.statusCode === 200 &&
      entries.length === 1 &&
      entries[0]?.kind === 'child_private.share.publish' &&
      entries[0]?.payload?.publishedBody === 'Jen tato věta.' &&
      entries[0]?.payload?.reflection === undefined &&
      namedPull.json().includesLivePrivateProjects === false;
    cases.push({
      name: 'http_recipient_share_only',
      ok: shareOnly,
      detail: shareOnly
        ? 'named recipient HTTP pull is frozen share only'
        : 'recipient path leaked live project or missed share',
    });

    // Second API process with the same Postgres store still sees durable rows.
    const second = await createFamilyApi(
      loadApiConfig({
        LUMI_TEST_HS256_SECRET: 'cp-http-pg-hs256-2',
        LUMI_OIDC_ISSUER: 'http://test.invalid/realms/lumi',
      } as NodeJS.ProcessEnv),
      {
        childPrivateSync: durable,
        childPrivateSyncProvider: 'postgres',
      },
    );
    try {
      const token2 = await second.tokens.mintTestToken({
        subject: 'child-http-pg-2',
        appUserId: childOwner as AppUserId,
      });
      const pull2 = await second.app.inject({
        method: 'GET',
        url: '/v1/child-private/sync/pull',
        headers: { authorization: `Bearer ${token2}` },
      });
      cases.push({
        name: 'second_process_reads_durable',
        ok:
          pull2.statusCode === 200 &&
          pull2.json().entries?.some(
            (row: { payload?: { reflection?: string } }) =>
              row.payload?.reflection === secret,
          ),
        detail:
          pull2.json().entries?.some(
            (row: { payload?: { reflection?: string } }) =>
              row.payload?.reflection === secret,
          )
            ? 'second API boot reads the same Postgres ledger'
            : 'second process missed durable rows',
      });
    } finally {
      await second.app.close();
    }
  } finally {
    await api.app.close();
    await pool.end();
  }

  return {
    ok: cases.every((row) => row.ok),
    personalColdUnaffected: true,
    familyAdminIsPrivateSuperuser: false,
    cases,
  };
}

export const LOCAL_CHILD_PRIVATE_HTTP_POSTGRES_SYNC_DRILL_DEFAULTS =
  LOCAL_CHILD_PRIVATE_POSTGRES_SYNC_DRILL_DEFAULTS;
