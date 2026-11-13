import type {
  AppUserId,
  ChildPrivateSyncPullResponse,
  ChildPrivateSyncPushResponse,
  SyncChangelogEntry,
  SyncCursor,
  SyncOperation,
  SyncOperationReceipt,
} from '@lumi/contracts';
import {
  LUMI_API_LIMITS,
  LUMI_API_PROTOCOL_VERSION,
  childPrivateShareAudience,
  childPrivateSharePayloadIsSafe,
  isChildPrivateShareKind,
  isChildPrivateSyncKind,
} from '@lumi/contracts';
import { createAppDbPool, withTenantTransaction, type AppDbPool } from '../db/pool.ts';
import { hashChildPrivatePayload } from './childPrivateSyncStore.ts';

type CursorPayload = {
  epoch: number;
  seq: number;
};

/**
 * Durable child-private sync ledger under Compose Postgres RLS. Personal API
 * boots keep the in-memory store; this path is opt-in for family stack drills.
 */
export function createPostgresChildPrivateSyncStore(pool: AppDbPool) {
  return {
    async push(input: {
      ownerAppUserId: AppUserId;
      sessionAppUserId: AppUserId;
      attemptId: string;
      operations: readonly SyncOperation[];
      writerGeneration?: number;
      now: string;
    }): Promise<ChildPrivateSyncPushResponse> {
      if (String(input.sessionAppUserId) !== String(input.ownerAppUserId)) {
        throw coded('forbidden', 'denied_not_owner');
      }
      if (
        input.operations.length === 0 ||
        input.operations.length > LUMI_API_LIMITS.maxSyncPushBatch
      ) {
        throw coded('validation', 'invalid_batch_size');
      }

      return withTenantTransaction(
        pool,
        { appUserId: input.sessionAppUserId, familyId: null },
        async (client) => {
          const epochRow = await client.query(
            `select epoch from child_private_sync_ledger where id = true`,
          );
          const epoch = Number(epochRow.rows[0]?.epoch ?? 1);

          await client.query(
            `insert into child_private_sync_state (owner_app_user_id)
             values ($1)
             on conflict (owner_app_user_id) do nothing`,
            [input.ownerAppUserId],
          );
          // Lock the owner state row so concurrent pushes serialize seq assignment.
          const state = await client.query(
            `select writer_generation from child_private_sync_state
             where owner_app_user_id = $1 for update`,
            [input.ownerAppUserId],
          );
          const writerGeneration = Number(state.rows[0]?.writer_generation ?? 1);
          if (input.writerGeneration != null && input.writerGeneration !== writerGeneration) {
            return {
              ownerAppUserId: input.ownerAppUserId,
              attemptId: input.attemptId,
              epoch,
              receipts: input.operations.map((operation) => ({
                operationId: operation.operationId,
                status: 'rejected' as const,
                reason: 'stale_writer' as const,
              })),
            };
          }

          const receipts: SyncOperationReceipt[] = [];
          for (const operation of input.operations) {
            receipts.push(
              await acceptOne(client, {
                ownerAppUserId: input.ownerAppUserId,
                sessionAppUserId: input.sessionAppUserId,
                operation,
                now: input.now,
              }),
            );
          }
          return {
            ownerAppUserId: input.ownerAppUserId,
            attemptId: input.attemptId,
            epoch,
            receipts,
          };
        },
      );
    },

    async pull(input: {
      sessionAppUserId: AppUserId;
      cursor: SyncCursor | null;
      limit?: number;
    }): Promise<ChildPrivateSyncPullResponse> {
      const limit = Math.min(Math.max(1, input.limit ?? 20), LUMI_API_LIMITS.maxSyncPullPage);

      return withTenantTransaction(
        pool,
        { appUserId: input.sessionAppUserId, familyId: null },
        async (client) => {
          const epochRow = await client.query(
            `select epoch from child_private_sync_ledger where id = true`,
          );
          const epoch = Number(epochRow.rows[0]?.epoch ?? 1);

          let afterSeq = 0;
          if (input.cursor) {
            const parsed = decodeCursor(input.cursor);
            if (!parsed || parsed.epoch !== epoch) {
              return {
                ownerAppUserId: null,
                epoch,
                entries: [],
                nextCursor: null,
                resyncRequired: true,
                includesLivePrivateProjects: false,
              };
            }
            afterSeq = parsed.seq;
          }

          // RLS already filters to owner rows + addressed shares.
          const result = await client.query(
            `select owner_app_user_id, operation_id, revision_id, entity_id, kind,
                    payload_hash, payload_json, changelog_seq, accepted_at
             from child_private_sync_operation
             where changelog_seq > $1
             order by changelog_seq asc
             limit $2`,
            [afterSeq, limit],
          );

          const entries: SyncChangelogEntry[] = result.rows.map((row) => {
            const ownerId = String(row.owner_app_user_id);
            const isOwner = ownerId === String(input.sessionAppUserId);
            const payload = isOwner
              ? (row.payload_json as Record<string, unknown>)
              : stripLivePrivateFields(row.payload_json as Record<string, unknown>);
            return {
              changelogSeq: Number(row.changelog_seq),
              operationId: String(row.operation_id),
              revisionId: String(row.revision_id),
              entityId: String(row.entity_id),
              kind: String(row.kind),
              payloadHash: String(row.payload_hash),
              payload,
              acceptedAt: new Date(row.accepted_at as string | Date).toISOString(),
              heads: [String(row.revision_id)],
            };
          });

          const hasForeignShare = result.rows.some(
            (row) => String(row.owner_app_user_id) !== String(input.sessionAppUserId),
          );
          const last = entries[entries.length - 1];
          return {
            ownerAppUserId: hasForeignShare ? null : input.sessionAppUserId,
            epoch,
            entries,
            nextCursor: last ? encodeCursor({ epoch, seq: last.changelogSeq }) : input.cursor,
            resyncRequired: false,
            includesLivePrivateProjects: false,
          };
        },
      );
    },
  };
}

async function acceptOne(
  client: {
    query: (
      sql: string,
      params?: unknown[],
    ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  },
  input: {
    ownerAppUserId: AppUserId;
    sessionAppUserId: AppUserId;
    operation: SyncOperation;
    now: string;
  },
): Promise<SyncOperationReceipt> {
  const { operation, sessionAppUserId, ownerAppUserId, now } = input;
  if (operation.schemaVersion !== LUMI_API_PROTOCOL_VERSION) {
    return {
      operationId: operation.operationId,
      status: 'rejected',
      reason: 'unsupported_schema',
    };
  }
  if (!operation.operationId || !operation.payloadHash || !operation.revisionId) {
    return {
      operationId: operation.operationId || 'unknown',
      status: 'rejected',
      reason: 'validation',
    };
  }
  if (String(operation.actorAppUserId) !== String(sessionAppUserId)) {
    return {
      operationId: operation.operationId,
      status: 'rejected',
      reason: 'forbidden',
    };
  }
  if (!isChildPrivateSyncKind(operation.kind)) {
    return {
      operationId: operation.operationId,
      status: 'rejected',
      reason: 'validation',
    };
  }
  if (
    isChildPrivateShareKind(operation.kind) &&
    !childPrivateSharePayloadIsSafe(operation.payload)
  ) {
    return {
      operationId: operation.operationId,
      status: 'rejected',
      reason: 'validation',
    };
  }
  if (hashChildPrivatePayload(operation.payload) !== operation.payloadHash) {
    return {
      operationId: operation.operationId,
      status: 'rejected',
      reason: 'hash_mismatch',
    };
  }

  const existing = await client.query(
    `select payload_hash, changelog_seq, revision_id
     from child_private_sync_operation
     where owner_app_user_id = $1 and operation_id = $2`,
    [ownerAppUserId, operation.operationId],
  );
  if (existing.rows[0]) {
    if (String(existing.rows[0].payload_hash) !== operation.payloadHash) {
      return {
        operationId: operation.operationId,
        status: 'rejected',
        reason: 'hash_mismatch',
      };
    }
    return {
      operationId: operation.operationId,
      status: 'duplicate',
      revisionId: String(existing.rows[0].revision_id),
      heads: [String(existing.rows[0].revision_id)],
      changelogSeq: Number(existing.rows[0].changelog_seq),
    };
  }

  const audience = isChildPrivateShareKind(operation.kind)
    ? childPrivateShareAudience(operation.payload)
    : null;
  const seqRow = await client.query(`select nextval('child_private_sync_global_seq') as seq`);
  const changelogSeq = Number(seqRow.rows[0]?.seq);

  await client.query(
    `insert into child_private_sync_operation (
       owner_app_user_id, operation_id, payload_hash, revision_id, entity_id,
       kind, device_id, actor_app_user_id, parent_revision_ids, payload_json,
       audience_app_user_ids, changelog_seq, accepted_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::uuid[],$12,$13::timestamptz
     )`,
    [
      ownerAppUserId,
      operation.operationId,
      operation.payloadHash,
      operation.revisionId,
      operation.entityId,
      operation.kind,
      String(operation.deviceId),
      operation.actorAppUserId,
      JSON.stringify(operation.parentRevisionIds),
      JSON.stringify(operation.payload),
      audience,
      changelogSeq,
      now,
    ],
  );

  return {
    operationId: operation.operationId,
    status: 'accepted',
    revisionId: operation.revisionId,
    heads: [operation.revisionId],
    changelogSeq,
  };
}

function stripLivePrivateFields(
  payload: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const next: Record<string, unknown> = { ...payload };
  delete next.reflection;
  delete next.intent;
  delete next.variantNotes;
  delete next.sourceNotes;
  delete next.steps;
  return next;
}

function encodeCursor(payload: CursorPayload): SyncCursor {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url') as SyncCursor;
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (!Number.isFinite(raw.epoch) || !Number.isFinite(raw.seq)) return null;
    return raw;
  } catch {
    return null;
  }
}

function coded(code: string, reason: string): Error {
  return Object.assign(new Error(reason), { code, reason });
}

export function createPostgresChildPrivateSyncStoreFromUrl(databaseUrl: string) {
  return createPostgresChildPrivateSyncStore(createAppDbPool(databaseUrl));
}
