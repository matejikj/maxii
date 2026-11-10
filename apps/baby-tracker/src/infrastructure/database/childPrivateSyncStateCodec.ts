import type { Instant } from '../../domain/ports/clock';
import type {
  DurableOutboxEntry,
  InboxEntry,
} from '../../domain/sync/transport';
import {
  createEmptyChildPrivateSyncState,
  type LocalChildPrivateSyncState,
} from '../../domain/sync/childPrivateTransport';
import { asOperationId } from '../../domain/ids';

type PersistedInstant = { readonly epochMs: number };

function asInstant(value: unknown): Instant {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { epochMs?: unknown }).epochMs === 'number'
  ) {
    return { epochMs: (value as PersistedInstant).epochMs };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { epochMs: value };
  }
  throw new Error('invalid_child_private_sync_instant');
}

function mapOutbox(raw: unknown): DurableOutboxEntry[] {
  if (!Array.isArray(raw)) throw new Error('invalid_child_private_sync_outbox');
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      operationId: asOperationId(String(row.operationId)),
      commandType: String(row.commandType),
      entityId: String(row.entityId),
      revisionId: String(row.revisionId),
      parentRevisionIds: Array.isArray(row.parentRevisionIds)
        ? row.parentRevisionIds.map(String)
        : [],
      schemaVersion: 1,
      payloadHash: String(row.payloadHash),
      payload:
        row.payload && typeof row.payload === 'object'
          ? (row.payload as Readonly<Record<string, unknown>>)
          : {},
      enqueuedAt: asInstant(row.enqueuedAt),
      acked: Boolean(row.acked),
      attemptCount: Number(row.attemptCount ?? 0),
    };
  });
}

function mapInbox(raw: unknown): InboxEntry[] {
  if (!Array.isArray(raw)) throw new Error('invalid_child_private_sync_inbox');
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      changelogSeq: Number(row.changelogSeq),
      operationId: String(row.operationId),
      revisionId: String(row.revisionId),
      entityId: String(row.entityId),
      kind: String(row.kind),
      payloadHash: String(row.payloadHash),
      payload:
        row.payload && typeof row.payload === 'object'
          ? (row.payload as Readonly<Record<string, unknown>>)
          : {},
      applied: Boolean(row.applied),
    };
  });
}

export type ChildPrivateSyncStateRow = {
  readonly ownerAppUserId: string | null;
  readonly cursor: string | null;
  readonly epoch: number | null;
  readonly lastSuccessfulSyncAtMs: number | null;
  readonly resyncRequired: boolean;
  readonly outboxJson: string;
  readonly inboxJson: string;
};

export function serializeChildPrivateSyncState(
  state: LocalChildPrivateSyncState,
): ChildPrivateSyncStateRow {
  return {
    ownerAppUserId: state.ownerAppUserId,
    cursor: state.cursor,
    epoch: state.epoch,
    lastSuccessfulSyncAtMs: state.lastSuccessfulSyncAt?.epochMs ?? null,
    resyncRequired: state.resyncRequired,
    outboxJson: JSON.stringify(state.outbox),
    inboxJson: JSON.stringify(state.inbox),
  };
}

export function parseChildPrivateSyncState(
  row: ChildPrivateSyncStateRow | null,
): LocalChildPrivateSyncState {
  if (!row) return createEmptyChildPrivateSyncState();
  return {
    ownerAppUserId: row.ownerAppUserId,
    cursor: row.cursor,
    epoch: row.epoch,
    lastSuccessfulSyncAt:
      row.lastSuccessfulSyncAtMs == null
        ? null
        : { epochMs: row.lastSuccessfulSyncAtMs },
    resyncRequired: row.resyncRequired,
    outbox: mapOutbox(JSON.parse(row.outboxJson)),
    inbox: mapInbox(JSON.parse(row.inboxJson)),
  };
}
