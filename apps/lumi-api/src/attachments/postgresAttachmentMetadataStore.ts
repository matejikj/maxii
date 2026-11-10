import type { PoolClient } from 'pg';
import type { AppUserId, AttachmentRenditionRole, FamilyId } from '@lumi/contracts';
import { createAppDbPool, withTenantTransaction, type AppDbPool } from '../db/pool.ts';

export type FamilyAttachmentMetadataRow = {
  readonly familyId: string;
  readonly attachmentId: string;
  readonly childId: string;
  readonly eventId: string;
  readonly createdBy: string;
  readonly eraseGeneration: number | null;
  readonly erasedAtMs: number | null;
};

export type FamilyAttachmentObjectRow = {
  readonly familyId: string;
  readonly attachmentId: string;
  readonly role: AttachmentRenditionRole;
  readonly objectKey: string;
  readonly byteLength: number;
  readonly sha256: string;
};

/** Locator + erase rows only; JPEG bytes stay in the object store. */
export type AttachmentMetadataStorePort = {
  activateObject(input: {
    readonly appUserId: AppUserId;
    readonly familyId: FamilyId;
    readonly attachmentId: string;
    readonly childId: string;
    readonly eventId: string;
    readonly role: AttachmentRenditionRole;
    readonly objectKey: string;
    readonly byteLength: number;
    readonly sha256: string;
    readonly nowMs: number;
  }): Promise<void>;
  getObject(input: {
    readonly appUserId: AppUserId;
    readonly familyId: FamilyId;
    readonly attachmentId: string;
    readonly role: AttachmentRenditionRole;
  }): Promise<FamilyAttachmentObjectRow | null>;
  tombstone(input: {
    readonly appUserId: AppUserId;
    readonly familyId: FamilyId;
    readonly attachmentId: string;
    readonly eraseGeneration: number;
    readonly nowMs: number;
  }): Promise<{ removedObjects: number }>;
  getAttachment(input: {
    readonly appUserId: AppUserId;
    readonly familyId: FamilyId;
    readonly attachmentId: string;
  }): Promise<FamilyAttachmentMetadataRow | null>;
};

/**
 * Durable attachment metadata under family RLS. Blob bytes stay in the object
 * store; personal boots never require this pool.
 */
export function createPostgresAttachmentMetadataStore(pool: AppDbPool): AttachmentMetadataStorePort {
  return {
    async activateObject(input: {
      readonly appUserId: AppUserId;
      readonly familyId: FamilyId;
      readonly attachmentId: string;
      readonly childId: string;
      readonly eventId: string;
      readonly role: AttachmentRenditionRole;
      readonly objectKey: string;
      readonly byteLength: number;
      readonly sha256: string;
      readonly nowMs: number;
    }): Promise<void> {
      await withTenantTransaction(
        pool,
        { appUserId: input.appUserId, familyId: input.familyId },
        async (client) => {
          await upsertAttachmentHeader(client, input);
          await client.query(
            `insert into family_attachment_object
               (family_id, attachment_id, role, object_key, byte_length, sha256, activated_at)
             values ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
             on conflict (family_id, attachment_id, role) do update set
               object_key = excluded.object_key,
               byte_length = excluded.byte_length,
               sha256 = excluded.sha256,
               activated_at = excluded.activated_at`,
            [
              input.familyId,
              input.attachmentId,
              input.role,
              input.objectKey,
              input.byteLength,
              input.sha256.toLowerCase(),
              input.nowMs,
            ],
          );
        },
      );
    },

    async getObject(input: {
      readonly appUserId: AppUserId;
      readonly familyId: FamilyId;
      readonly attachmentId: string;
      readonly role: AttachmentRenditionRole;
    }): Promise<FamilyAttachmentObjectRow | null> {
      return withTenantTransaction(
        pool,
        { appUserId: input.appUserId, familyId: input.familyId },
        async (client) => {
          const result = await client.query(
            `select family_id, attachment_id, role, object_key, byte_length, sha256
             from family_attachment_object
             where family_id = $1 and attachment_id = $2 and role = $3`,
            [input.familyId, input.attachmentId, input.role],
          );
          const row = result.rows[0];
          if (!row) return null;
          return {
            familyId: row.family_id as string,
            attachmentId: row.attachment_id as string,
            role: row.role as AttachmentRenditionRole,
            objectKey: row.object_key as string,
            byteLength: Number(row.byte_length),
            sha256: row.sha256 as string,
          };
        },
      );
    },

    async tombstone(input: {
      readonly appUserId: AppUserId;
      readonly familyId: FamilyId;
      readonly attachmentId: string;
      readonly eraseGeneration: number;
      readonly nowMs: number;
    }): Promise<{ removedObjects: number }> {
      return withTenantTransaction(
        pool,
        { appUserId: input.appUserId, familyId: input.familyId },
        async (client) => {
          const deleted = await client.query(
            `delete from family_attachment_object
             where family_id = $1 and attachment_id = $2`,
            [input.familyId, input.attachmentId],
          );
          await client.query(
            `insert into family_attachment
               (family_id, attachment_id, child_id, event_id, created_by, erase_generation, erased_at, updated_at)
             values ($1, $2, 'tombstone', 'tombstone', $3, $4, to_timestamp($5 / 1000.0), to_timestamp($5 / 1000.0))
             on conflict (family_id, attachment_id) do update set
               erase_generation = greatest(
                 coalesce(family_attachment.erase_generation, 0),
                 excluded.erase_generation
               ),
               erased_at = excluded.erased_at,
               updated_at = excluded.updated_at`,
            [
              input.familyId,
              input.attachmentId,
              input.appUserId,
              input.eraseGeneration,
              input.nowMs,
            ],
          );
          return { removedObjects: deleted.rowCount ?? 0 };
        },
      );
    },

    async getAttachment(input: {
      readonly appUserId: AppUserId;
      readonly familyId: FamilyId;
      readonly attachmentId: string;
    }): Promise<FamilyAttachmentMetadataRow | null> {
      return withTenantTransaction(
        pool,
        { appUserId: input.appUserId, familyId: input.familyId },
        async (client) => {
          const result = await client.query(
            `select family_id, attachment_id, child_id, event_id, created_by,
                    erase_generation, erased_at
             from family_attachment
             where family_id = $1 and attachment_id = $2`,
            [input.familyId, input.attachmentId],
          );
          const row = result.rows[0];
          if (!row) return null;
          return {
            familyId: row.family_id as string,
            attachmentId: row.attachment_id as string,
            childId: row.child_id as string,
            eventId: row.event_id as string,
            createdBy: row.created_by as string,
            eraseGeneration:
              row.erase_generation == null ? null : Number(row.erase_generation),
            erasedAtMs:
              row.erased_at == null ? null : new Date(row.erased_at as string).getTime(),
          };
        },
      );
    },
  };
}

async function upsertAttachmentHeader(
  client: PoolClient,
  input: {
    readonly familyId: string;
    readonly attachmentId: string;
    readonly childId: string;
    readonly eventId: string;
    readonly appUserId: string;
    readonly nowMs: number;
  },
): Promise<void> {
  await client.query(
    `insert into family_attachment
       (family_id, attachment_id, child_id, event_id, created_by, updated_at)
     values ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0))
     on conflict (family_id, attachment_id) do update set
       child_id = excluded.child_id,
       event_id = excluded.event_id,
       updated_at = excluded.updated_at
     where family_attachment.erase_generation is null`,
    [
      input.familyId,
      input.attachmentId,
      input.childId,
      input.eventId,
      input.appUserId,
      input.nowMs,
    ],
  );
}

export function createPostgresAttachmentMetadataStoreFromUrl(databaseUrl: string) {
  return createPostgresAttachmentMetadataStore(createAppDbPool(databaseUrl));
}
