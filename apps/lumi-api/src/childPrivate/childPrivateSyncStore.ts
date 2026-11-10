import { createHash, randomUUID } from 'node:crypto';
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

type OwnerState = {
  ownerAppUserId: AppUserId;
  epoch: number;
  writerGeneration: number;
};

type StoredReceipt = {
  ownerAppUserId: AppUserId;
  globalSeq: number;
  operationId: string;
  payloadHash: string;
  operation: SyncOperation;
  receipt: SyncOperationReceipt;
  acceptedAt: string;
};

type CursorPayload = {
  epoch: number;
  seq: number;
};

/**
 * Separate owner-scoped changelog for child-private outbox. Family membership
 * never authorizes this stream; recipients only see share snapshot ops.
 */
export class MemoryChildPrivateSyncStore {
  readonly owners = new Map<string, OwnerState>();
  readonly byOperation = new Map<string, StoredReceipt>();
  readonly log: StoredReceipt[] = [];
  private globalSeq = 0;
  private globalEpoch = 1;
  private readonly locks = new Map<string, Promise<void>>();

  ensureOwner(ownerAppUserId: AppUserId): OwnerState {
    const key = String(ownerAppUserId);
    let state = this.owners.get(key);
    if (!state) {
      state = {
        ownerAppUserId,
        epoch: this.globalEpoch,
        writerGeneration: 1,
      };
      this.owners.set(key, state);
    }
    return state;
  }

  async push(input: {
    ownerAppUserId: AppUserId;
    /** Authenticated session — must match owner and each operation actor. */
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

    return this.withOwnerLock(input.ownerAppUserId, async () => {
      const state = this.ensureOwner(input.ownerAppUserId);
      if (
        input.writerGeneration != null &&
        input.writerGeneration !== state.writerGeneration
      ) {
        return {
          ownerAppUserId: input.ownerAppUserId,
          attemptId: input.attemptId,
          epoch: this.globalEpoch,
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
          this.acceptOne(state, input.sessionAppUserId, operation, input.now),
        );
      }
      return {
        ownerAppUserId: input.ownerAppUserId,
        attemptId: input.attemptId,
        epoch: this.globalEpoch,
        receipts,
      };
    });
  }

  pull(input: {
    sessionAppUserId: AppUserId;
    cursor: SyncCursor | null;
    limit?: number;
  }): ChildPrivateSyncPullResponse {
    const limit = Math.min(
      Math.max(1, input.limit ?? 20),
      LUMI_API_LIMITS.maxSyncPullPage,
    );

    let afterSeq = 0;
    if (input.cursor) {
      const parsed = decodeCursor(input.cursor);
      if (!parsed || parsed.epoch !== this.globalEpoch) {
        return {
          ownerAppUserId: null,
          epoch: this.globalEpoch,
          entries: [],
          nextCursor: null,
          resyncRequired: true,
          includesLivePrivateProjects: false,
        };
      }
      afterSeq = parsed.seq;
    }

    const visible = this.log.filter((item) => {
      if (item.globalSeq <= afterSeq) return false;
      return entryVisibleTo(item, input.sessionAppUserId);
    });
    const slice = visible.slice(0, limit);
    const entries: SyncChangelogEntry[] = slice.map((item) =>
      presentEntry(item, input.sessionAppUserId),
    );
    const last = entries[entries.length - 1];
    const hasForeignShare = slice.some(
      (item) => String(item.ownerAppUserId) !== String(input.sessionAppUserId),
    );
    return {
      // Mixed recipient inbox is not a single owner stream.
      ownerAppUserId: hasForeignShare ? null : input.sessionAppUserId,
      epoch: this.globalEpoch,
      entries,
      nextCursor: last
        ? encodeCursor({ epoch: this.globalEpoch, seq: last.changelogSeq })
        : input.cursor,
      resyncRequired: false,
      includesLivePrivateProjects: false,
    };
  }

  private acceptOne(
    state: OwnerState,
    sessionAppUserId: AppUserId,
    operation: SyncOperation,
    now: string,
  ): SyncOperationReceipt {
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

    const expectedHash = hashChildPrivatePayload(operation.payload);
    if (expectedHash !== operation.payloadHash) {
      return {
        operationId: operation.operationId,
        status: 'rejected',
        reason: 'hash_mismatch',
      };
    }

    const key = `${state.ownerAppUserId}:${operation.operationId}`;
    const existing = this.byOperation.get(key);
    if (existing) {
      if (existing.payloadHash !== operation.payloadHash) {
        return {
          operationId: operation.operationId,
          status: 'rejected',
          reason: 'hash_mismatch',
        };
      }
      return { ...existing.receipt, status: 'duplicate' };
    }

    this.globalSeq += 1;
    const changelogSeq = this.globalSeq;
    const receipt: SyncOperationReceipt = {
      operationId: operation.operationId,
      status: 'accepted',
      revisionId: operation.revisionId,
      heads: [operation.revisionId],
      changelogSeq,
    };
    const stored: StoredReceipt = {
      ownerAppUserId: state.ownerAppUserId,
      globalSeq: changelogSeq,
      operationId: operation.operationId,
      payloadHash: operation.payloadHash,
      operation,
      receipt,
      acceptedAt: now,
    };
    this.byOperation.set(key, stored);
    this.log.push(stored);
    return receipt;
  }

  private async withOwnerLock<T>(
    ownerAppUserId: AppUserId,
    run: () => Promise<T>,
  ): Promise<T> {
    const key = String(ownerAppUserId);
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      key,
      previous.then(() => gate),
    );
    await previous;
    try {
      return await run();
    } finally {
      release();
    }
  }
}

function entryVisibleTo(item: StoredReceipt, sessionAppUserId: AppUserId): boolean {
  if (String(item.ownerAppUserId) === String(sessionAppUserId)) {
    return true;
  }
  if (!isChildPrivateShareKind(item.operation.kind)) {
    return false;
  }
  return childPrivateShareAudience(item.operation.payload).includes(
    String(sessionAppUserId),
  );
}

function presentEntry(
  item: StoredReceipt,
  sessionAppUserId: AppUserId,
): SyncChangelogEntry {
  const isOwner = String(item.ownerAppUserId) === String(sessionAppUserId);
  // Non-owners only ever see share snapshot kinds already filtered above.
  const payload = isOwner
    ? item.operation.payload
    : stripLivePrivateFields(item.operation.payload);
  return {
    changelogSeq: item.globalSeq,
    operationId: item.operationId,
    revisionId: item.operation.revisionId,
    entityId: item.operation.entityId,
    kind: item.operation.kind,
    payloadHash: item.payloadHash,
    payload,
    acceptedAt: item.acceptedAt,
    heads: item.receipt.heads ?? [item.operation.revisionId],
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

export function hashChildPrivatePayload(
  payload: Readonly<Record<string, unknown>>,
): string {
  return createHash('sha256')
    .update(stableStringify(payload), 'utf8')
    .digest('hex');
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function coded(code: string, reason: string): Error {
  return Object.assign(new Error(reason), { code, reason });
}

export function newChildPrivateAttemptId(): string {
  return randomUUID();
}
