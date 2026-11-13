import {
  applyChildPrivatePushReceipts,
  commitChildPrivatePullPage,
  markChildPrivateOutboxAttempt,
  pendingChildPrivateOutbox,
  type LocalChildPrivateSyncState,
} from './childPrivateTransport.ts';
import { syncBackoffMs } from './transport.ts';

export type ChildPrivateSyncTransportPort = {
  push: (input: {
    readonly ownerAppUserId: string;
    readonly attemptId: string;
    readonly operations: readonly {
      readonly operationId: string;
      readonly commandType: string;
      readonly entityId: string;
      readonly revisionId: string;
      readonly parentRevisionIds: readonly string[];
      readonly schemaVersion: 1;
      readonly payloadHash: string;
      readonly payload: Readonly<Record<string, unknown>>;
    }[];
  }) => Promise<{
    readonly receipts: readonly {
      readonly operationId: string;
      readonly status: string;
      readonly reason?: string;
    }[];
    readonly epoch: number;
  }>;
  pull: (input: { readonly ownerAppUserId: string; readonly cursor: string | null }) => Promise<{
    readonly entries: readonly {
      readonly changelogSeq: number;
      readonly operationId: string;
      readonly revisionId: string;
      readonly entityId: string;
      readonly kind: string;
      readonly payloadHash: string;
      readonly payload: Readonly<Record<string, unknown>>;
    }[];
    readonly nextCursor: string | null;
    readonly epoch: number;
    readonly resyncRequired: boolean;
  }>;
};

export type ChildPrivateSyncWorkerResult = {
  readonly state: LocalChildPrivateSyncState;
  readonly pushed: number;
  readonly pulled: number;
  readonly nextDelayMs: number;
};

/**
 * One owner-scoped sync tick. FamilyId is intentionally absent — private
 * operations never call the family care endpoint.
 */
export async function runChildPrivateSyncTick(input: {
  readonly state: LocalChildPrivateSyncState;
  readonly ownerAppUserId: string;
  readonly transport: ChildPrivateSyncTransportPort;
  readonly attemptId: string;
  readonly now: string;
  readonly batchSize?: number;
}): Promise<ChildPrivateSyncWorkerResult> {
  let state: LocalChildPrivateSyncState = {
    ...input.state,
    ownerAppUserId: input.ownerAppUserId,
  };
  const pending = pendingChildPrivateOutbox(state).slice(0, input.batchSize ?? 25);
  let pushed = 0;
  let pulled: number;
  let maxAttempt = 0;

  if (pending.length > 0) {
    state = markChildPrivateOutboxAttempt(
      state,
      pending.map((item) => item.operationId),
    );
    maxAttempt = Math.max(...pending.map((item) => item.attemptCount + 1));
    try {
      const pushedResult = await input.transport.push({
        ownerAppUserId: input.ownerAppUserId,
        attemptId: input.attemptId,
        operations: pending.map((item) => ({
          operationId: item.operationId,
          commandType: item.commandType,
          entityId: item.entityId,
          revisionId: item.revisionId,
          parentRevisionIds: item.parentRevisionIds,
          schemaVersion: item.schemaVersion,
          payloadHash: item.payloadHash,
          payload: item.payload,
        })),
      });
      state = applyChildPrivatePushReceipts(state, pushedResult.receipts);
      state = { ...state, epoch: pushedResult.epoch };
      pushed = pushedResult.receipts.filter(
        (item) =>
          item.status === 'accepted' ||
          item.status === 'accepted_with_conflict' ||
          item.status === 'duplicate',
      ).length;
    } catch {
      return {
        state,
        pushed: 0,
        pulled: 0,
        nextDelayMs: syncBackoffMs(Math.max(1, maxAttempt), 0),
      };
    }
  }

  try {
    const page = await input.transport.pull({
      ownerAppUserId: input.ownerAppUserId,
      cursor: state.cursor,
    });
    state = commitChildPrivatePullPage(state, {
      entries: page.entries,
      nextCursor: page.nextCursor,
      epoch: page.epoch,
      syncedAt: { epochMs: Date.parse(input.now) },
      resyncRequired: page.resyncRequired,
    });
    pulled = page.entries.length;
  } catch {
    return {
      state,
      pushed,
      pulled: 0,
      nextDelayMs: syncBackoffMs(Math.max(1, maxAttempt || 1), 0),
    };
  }

  return {
    state,
    pushed,
    pulled,
    nextDelayMs: pendingChildPrivateOutbox(state).length > 0 ? syncBackoffMs(1, 0) : 5_000,
  };
}
