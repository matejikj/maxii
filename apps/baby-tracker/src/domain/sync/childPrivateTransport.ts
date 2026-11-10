import { AppError } from '../errors.ts';
import type { OperationId } from '../ids.ts';
import type { Instant } from '../ports/clock.ts';
import {
  isChildPrivateShareKind,
  isChildPrivateSyncKind,
  childPrivateSharePayloadIsSafe,
} from './childPrivateKinds.ts';
import { hashPayload, type DurableOutboxEntry, type InboxEntry } from './transport.ts';

/**
 * Local durable state for the owner-scoped child-private sync stream.
 * Intentionally separate from LocalSyncState so private work never rides the
 * family care cursor or family outbox.
 */
export type LocalChildPrivateSyncState = {
  readonly ownerAppUserId: string | null;
  readonly cursor: string | null;
  readonly epoch: number | null;
  readonly lastSuccessfulSyncAt: Instant | null;
  readonly resyncRequired: boolean;
  readonly outbox: DurableOutboxEntry[];
  readonly inbox: InboxEntry[];
};

export function createEmptyChildPrivateSyncState(): LocalChildPrivateSyncState {
  return {
    ownerAppUserId: null,
    cursor: null,
    epoch: null,
    lastSuccessfulSyncAt: null,
    resyncRequired: false,
    outbox: [],
    inbox: [],
  };
}

/**
 * Enqueue a private workspace change locally. Network is not required — the
 * personal build can keep writing while the child-private stream is offline.
 */
export function enqueueChildPrivateOutbox(
  state: LocalChildPrivateSyncState,
  input: {
    readonly ownerAppUserId: string;
    readonly operationId: OperationId;
    readonly commandType: string;
    readonly entityId: string;
    readonly revisionId: string;
    readonly parentRevisionIds?: readonly string[];
    readonly payload: Readonly<Record<string, unknown>>;
    readonly enqueuedAt: Instant;
  },
): LocalChildPrivateSyncState {
  if (!isChildPrivateSyncKind(input.commandType)) {
    throw new AppError(
      'VALIDATION',
      'Only child-private sync kinds may enter the owner-scoped outbox',
      { details: { commandType: input.commandType } },
    );
  }
  if (
    isChildPrivateShareKind(input.commandType) &&
    input.commandType === 'child_private.share.publish' &&
    !childPrivateSharePayloadIsSafe(input.payload)
  ) {
    throw new AppError(
      'VALIDATION',
      'Share publish payloads must be frozen snapshots without live private fields',
      { details: { commandType: input.commandType } },
    );
  }
  if (
    state.ownerAppUserId !== null &&
    state.ownerAppUserId !== input.ownerAppUserId
  ) {
    throw new AppError(
      'FORBIDDEN',
      'Child-private outbox is bound to a single owner workspace',
      {
        details: {
          boundOwner: state.ownerAppUserId,
          attemptedOwner: input.ownerAppUserId,
        },
      },
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
  return {
    ...state,
    ownerAppUserId: input.ownerAppUserId,
    outbox: [...state.outbox, entry],
  };
}

export function pendingChildPrivateOutbox(
  state: LocalChildPrivateSyncState,
): readonly DurableOutboxEntry[] {
  return state.outbox.filter((item) => !item.acked);
}

export function markChildPrivateOutboxAttempt(
  state: LocalChildPrivateSyncState,
  operationIds: readonly string[],
): LocalChildPrivateSyncState {
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

export function applyChildPrivatePushReceipts(
  state: LocalChildPrivateSyncState,
  receipts: readonly {
    readonly operationId: string;
    readonly status: string;
    readonly reason?: string;
  }[],
): LocalChildPrivateSyncState {
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
      // Auth/permanent rejection keeps the private payload locally.
      return item;
    }),
  };
}

/**
 * Cursor advances only with applied inbox rows so a crash between pull and
 * apply leaves the previous cursor for a safe retry.
 */
export function commitChildPrivatePullPage(
  state: LocalChildPrivateSyncState,
  input: {
    readonly entries: readonly Omit<InboxEntry, 'applied'>[];
    readonly nextCursor: string | null;
    readonly epoch: number;
    readonly syncedAt: Instant;
    readonly resyncRequired?: boolean;
  },
): LocalChildPrivateSyncState {
  if (input.resyncRequired) {
    return {
      ...state,
      epoch: input.epoch,
      resyncRequired: true,
      // Never wipe unsent private work on a resync signal.
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

/**
 * Keep rejected private pushes local. They must not be redirected onto another
 * owner workspace or the family care stream.
 */
export function isolateRejectedChildPrivatePush(
  state: LocalChildPrivateSyncState,
  operationIds: readonly string[],
): {
  readonly state: LocalChildPrivateSyncState;
  readonly isolatedIds: readonly string[];
} {
  void state;
  return { state, isolatedIds: [...operationIds] };
}
