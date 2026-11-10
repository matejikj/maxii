import { AppError } from '../errors.ts';
import type { OperationId } from '../ids.ts';
import type { Instant } from '../ports/clock.ts';
import { isChildPrivateSyncKind } from './childPrivateKinds.ts';
import { createHash } from './hash.ts';

export type DurableOutboxEntry = {
  readonly operationId: OperationId;
  readonly commandType: string;
  readonly entityId: string;
  readonly revisionId: string;
  readonly parentRevisionIds: readonly string[];
  readonly schemaVersion: 1;
  readonly payloadHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly enqueuedAt: Instant;
  readonly acked: boolean;
  readonly attemptCount: number;
};

export type InboxEntry = {
  readonly changelogSeq: number;
  readonly operationId: string;
  readonly revisionId: string;
  readonly entityId: string;
  readonly kind: string;
  readonly payloadHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly applied: boolean;
};

export type LocalSyncState = {
  readonly familyId: string | null;
  readonly cursor: string | null;
  readonly epoch: number | null;
  readonly lastSuccessfulSyncAt: Instant | null;
  readonly resyncRequired: boolean;
  readonly outbox: DurableOutboxEntry[];
  readonly inbox: InboxEntry[];
};

export function createEmptySyncState(): LocalSyncState {
  return {
    familyId: null,
    cursor: null,
    epoch: null,
    lastSuccessfulSyncAt: null,
    resyncRequired: false,
    outbox: [],
    inbox: [],
  };
}

export function enqueueDurableOutbox(
  state: LocalSyncState,
  input: {
    readonly operationId: OperationId;
    readonly commandType: string;
    readonly entityId: string;
    readonly revisionId: string;
    readonly parentRevisionIds?: readonly string[];
    readonly payload: Readonly<Record<string, unknown>>;
    readonly enqueuedAt: Instant;
  },
): LocalSyncState {
  // Private workspace changes use a separate owner-scoped outbox/stream.
  if (
    isChildPrivateSyncKind(input.commandType) ||
    input.commandType.startsWith('child_private.')
  ) {
    throw new AppError(
      'FORBIDDEN',
      'Child-private operations must not enter the family care outbox',
      { details: { commandType: input.commandType } },
    );
  }
  const payloadHash = hashPayload(input.payload);
  const entry: DurableOutboxEntry = {
    operationId: input.operationId,
    commandType: input.commandType,
    entityId: input.entityId,
    revisionId: input.revisionId,
    parentRevisionIds: input.parentRevisionIds ?? [],
    schemaVersion: 1,
    payloadHash,
    payload: input.payload,
    enqueuedAt: input.enqueuedAt,
    acked: false,
    attemptCount: 0,
  };
  return { ...state, outbox: [...state.outbox, entry] };
}

export function pendingOutbox(state: LocalSyncState): readonly DurableOutboxEntry[] {
  return state.outbox.filter((item) => !item.acked);
}

export function markOutboxAttempt(
  state: LocalSyncState,
  operationIds: readonly string[],
): LocalSyncState {
  const wanted = new Set(operationIds);
  return {
    ...state,
    outbox: state.outbox.map((item) =>
      wanted.has(item.operationId)
        ? { ...item, attemptCount: item.attemptCount + 1 }
        : item,
    ),
  };
}

export function applyPushReceipts(
  state: LocalSyncState,
  receipts: readonly {
    readonly operationId: string;
    readonly status: string;
    readonly reason?: string;
  }[],
): LocalSyncState {
  const byId = new Map(receipts.map((item) => [item.operationId, item]));
  return {
    ...state,
    outbox: state.outbox.map((item) => {
      const receipt = byId.get(item.operationId);
      if (!receipt) return item;
      if (
        receipt.status === 'accepted' ||
        receipt.status === 'accepted_with_conflict' ||
        receipt.status === 'duplicate'
      ) {
        return { ...item, acked: true };
      }
      // Auth/permanent rejection keeps payload locally for manual resolution.
      return item;
    }),
  };
}

/**
 * Cursor advances only together with applied inbox rows. A crash between the
 * two must leave the previous cursor so the page can be pulled again.
 */
export function commitPullPage(
  state: LocalSyncState,
  input: {
    readonly entries: readonly Omit<InboxEntry, 'applied'>[];
    readonly nextCursor: string | null;
    readonly epoch: number;
    readonly syncedAt: Instant;
    readonly resyncRequired?: boolean;
  },
): LocalSyncState {
  if (input.resyncRequired) {
    return {
      ...state,
      epoch: input.epoch,
      resyncRequired: true,
      // Never wipe unsent local work on resync signal.
    };
  }
  const incoming = input.entries.map((entry) => ({ ...entry, applied: true }));
  return {
    ...state,
    epoch: input.epoch,
    cursor: input.nextCursor,
    lastSuccessfulSyncAt: input.syncedAt,
    resyncRequired: false,
    inbox: [...state.inbox, ...incoming],
  };
}

export function isolateRejectedFamilyPush(
  state: LocalSyncState,
  operationIds: readonly string[],
): { readonly state: LocalSyncState; readonly isolatedIds: readonly string[] } {
  // Keep entries unacked so they are never redirected to another family.
  void state;
  return { state, isolatedIds: [...operationIds] };
}

export function syncBackoffMs(attemptCount: number, jitterRatio = 0.2): number {
  const base = Math.min(30_000, 250 * 2 ** Math.max(0, attemptCount - 1));
  const jitter = base * jitterRatio * Math.random();
  return Math.floor(base + jitter);
}

export function hashPayload(payload: Readonly<Record<string, unknown>>): string {
  return createHash(stableStringify(payload));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
