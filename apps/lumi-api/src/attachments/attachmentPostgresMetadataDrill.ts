import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { AppUserId, FamilyId } from '@lumi/contracts';
import { createAppDbPool, withTenantTransaction } from '../db/pool.ts';
import { createPostgresAttachmentMetadataStore } from './postgresAttachmentMetadataStore.ts';
import { resolveAttachmentObjectStore } from './resolveAttachmentObjectStore.ts';
import { loadApiConfig } from '../config/env.ts';

export type AttachmentPostgresMetadataDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type AttachmentPostgresMetadataDrillResult = {
  readonly ok: boolean;
  /** Metadata persistence is family-only; personal boots stay memory/cold. */
  readonly personalColdUnaffected: true;
  readonly cases: readonly AttachmentPostgresMetadataDrillCase[];
};

/**
 * Proves attachment metadata tables under Compose Postgres RLS. Does not upload
 * blobs and does not claim Cloudflare R2 readiness.
 */
export async function runAttachmentPostgresMetadataDrill(input: {
  readonly databaseUrl: string;
  readonly adminDatabaseUrl: string;
}): Promise<AttachmentPostgresMetadataDrillResult> {
  const cases: AttachmentPostgresMetadataDrillCase[] = [];

  const personal = resolveAttachmentObjectStore(
    loadApiConfig({
      LUMI_TEST_HS256_SECRET: 'attachment-pg-meta-personal-cold',
    } as NodeJS.ProcessEnv),
  );
  cases.push({
    name: 'personal_cold_memory_default',
    ok: personal.provider === 'memory',
    detail:
      personal.provider === 'memory'
        ? 'personal boots still default to memory object store'
        : `expected memory, got ${personal.provider}`,
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
    return { ok: false, personalColdUnaffected: true, cases };
  }

  const userA = randomUUID();
  const userB = randomUUID();
  const familyA = randomUUID();
  const familyB = randomUUID();
  const attachmentId = randomUUID();
  const nowMs = Date.now();

  try {
    const tables = await admin.query(
      `select table_name from information_schema.tables
       where table_schema = 'public'
         and table_name = any($1::text[])`,
      [['family_attachment', 'family_attachment_object']],
    );
    const names = new Set(tables.rows.map((row) => row.table_name as string));
    const schemaOk =
      names.has('family_attachment') && names.has('family_attachment_object');
    cases.push({
      name: 'attachment_tables_present',
      ok: schemaOk,
      detail: schemaOk
        ? 'family_attachment + family_attachment_object present'
        : 'apply migrations/006_family_attachments.sql',
    });
    if (!schemaOk) {
      return { ok: false, personalColdUnaffected: true, cases };
    }

    await admin.query('begin');
    await admin.query(
      `insert into app_user (app_user_id, status) values ($1, 'active'), ($2, 'active')`,
      [userA, userB],
    );
    await admin.query(
      `insert into family (family_id, display_name, created_by)
       values ($1, 'att-meta-a', $2), ($3, 'att-meta-b', $4)`,
      [familyA, userA, familyB, userB],
    );
    await admin.query(
      `insert into family_membership (membership_id, family_id, app_user_id, role, status)
       values ($1, $2, $3, 'admin', 'active'), ($4, $5, $6, 'admin', 'active')`,
      [randomUUID(), familyA, userA, randomUUID(), familyB, userB],
    );
    await admin.query('commit');
    cases.push({
      name: 'seed_families',
      ok: true,
      detail: 'two families seeded for metadata RLS',
    });
  } catch (error) {
    try {
      await admin.query('rollback');
    } catch {
      // ignore
    }
    cases.push({
      name: 'seed_families',
      ok: false,
      detail: error instanceof Error ? error.message : 'seed failed',
    });
    await admin.end().catch(() => undefined);
    return { ok: false, personalColdUnaffected: true, cases };
  } finally {
    await admin.end().catch(() => undefined);
  }

  const pool = createAppDbPool(input.databaseUrl);
  const store = createPostgresAttachmentMetadataStore(pool);
  try {
    await store.activateObject({
      appUserId: userA as AppUserId,
      familyId: familyA as FamilyId,
      attachmentId,
      childId: 'child_opaque',
      eventId: 'event_opaque',
      role: 'display',
      objectKey: `fam/${familyA}/att/${attachmentId}/display/drill`,
      byteLength: 128,
      sha256: 'a'.repeat(64),
      nowMs,
    });
    cases.push({
      name: 'owner_activate',
      ok: true,
      detail: 'member wrote attachment object metadata',
    });

    const owned = await store.getObject({
      appUserId: userA as AppUserId,
      familyId: familyA as FamilyId,
      attachmentId,
      role: 'display',
    });
    cases.push({
      name: 'owner_read',
      ok: owned?.sha256 === 'a'.repeat(64) && owned.byteLength === 128,
      detail: owned ? 'owner reads digest + length' : 'owner read missed row',
    });

    const stolen = await store.getObject({
      appUserId: userB as AppUserId,
      familyId: familyA as FamilyId,
      attachmentId,
      role: 'display',
    });
    cases.push({
      name: 'foreign_member_read_denied',
      ok: stolen == null,
      detail: stolen
        ? 'RLS leaked attachment metadata across families'
        : 'foreign membership cannot read attachment metadata',
    });

    // Wrong-family GUC with an active membership elsewhere still sees nothing.
    const wrongFamily = await withTenantTransaction(
      pool,
      { appUserId: userB as AppUserId, familyId: familyB as FamilyId },
      async (client) => {
        const result = await client.query(
          `select attachment_id from family_attachment_object where attachment_id = $1`,
          [attachmentId],
        );
        return result.rowCount ?? 0;
      },
    );
    cases.push({
      name: 'wrong_family_context_empty',
      ok: wrongFamily === 0,
      detail:
        wrongFamily === 0
          ? 'tenant GUC keeps foreign attachment rows invisible'
          : `leaked ${wrongFamily} rows`,
    });

    const erased = await store.tombstone({
      appUserId: userA as AppUserId,
      familyId: familyA as FamilyId,
      attachmentId,
      eraseGeneration: 1,
      nowMs: nowMs + 1,
    });
    const after = await store.getObject({
      appUserId: userA as AppUserId,
      familyId: familyA as FamilyId,
      attachmentId,
      role: 'display',
    });
    const header = await store.getAttachment({
      appUserId: userA as AppUserId,
      familyId: familyA as FamilyId,
      attachmentId,
    });
    cases.push({
      name: 'tombstone_removes_objects',
      ok:
        erased.removedObjects >= 1 &&
        after == null &&
        header?.eraseGeneration === 1,
      detail:
        erased.removedObjects >= 1 && after == null && header?.eraseGeneration === 1
          ? 'objects deleted; erase generation recorded'
          : 'tombstone left readable metadata',
    });
  } finally {
    await pool.end();
  }

  return {
    ok: cases.every((row) => row.ok),
    personalColdUnaffected: true,
    cases,
  };
}

export const LOCAL_ATTACHMENT_POSTGRES_METADATA_DRILL_DEFAULTS = {
  databaseUrl: 'postgres://lumi_app:lumi_app_dev_only@127.0.0.1:5433/lumi_app',
  adminDatabaseUrl:
    'postgres://postgres:postgres_dev_only@127.0.0.1:5433/lumi_app',
} as const;
