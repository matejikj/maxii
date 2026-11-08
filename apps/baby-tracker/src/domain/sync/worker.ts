import {
  applyPushReceipts,
  commitPullPage,
  markOutboxAttempt,
  pendingOutbox,
  syncBackoffMs,
  type LocalSyncState,
} from './transport.ts';

export type SyncTransportPort = {
  push: (input: {
    readonly familyId: string;
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
  pull: (input: {
    readonly familyId: string;
    readonly cursor: string | null;
  }) => Promise<{
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

export type SyncWorkerResult = {
  readonly state: LocalSyncState;
  readonly pushed: number;
  readonly pulled: number;
  readonly nextDelayMs: number;
};

/**
 * One sync tick. Network status is advisory — timeouts and typed responses
 * decide success. Push notifications only wake this loop; they are not delivery.
 */
export async function runSyncTick(input: {
  readonly state: LocalSyncState;
  readonly familyId: string;
  readonly transport: SyncTransportPort;
  readonly attemptId: string;
  readonly now: string;
  readonly batchSize?: number;
}): Promise<SyncWorkerResult> {
  let state = {
    ...input.state,
    familyId: input.familyId,
  };
  const pending = pendingOutbox(state).slice(0, input.batchSize ?? 25);
  let pushed = 0;
  let pulled = 0;
  let maxAttempt = 0;

  if (pending.length > 0) {
    state = markOutboxAttempt(
      state,
      pending.map((item) => item.operationId),
    );
    maxAttempt = Math.max(...pending.map((item) => item.attemptCount + 1));
    try {
      const pushedResult = await input.transport.push({
        familyId: input.familyId,
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
      state = applyPushReceipts(state, pushedResult.receipts);
      state = { ...state, epoch: pushedResult.epoch };
      pushed = pushedResult.receipts.filter((item) =>
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
      familyId: input.familyId,
      cursor: state.cursor,
    });
    state = commitPullPage(state, {
      entries: page.entries,
      nextCursor: page.nextCursor,
      epoch: page.epoch,
      syncedAt: input.now,
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
    nextDelayMs: pendingOutbox(state).length > 0 ? syncBackoffMs(1, 0) : 5_000,
  };
}
