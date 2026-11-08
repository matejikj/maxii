import { createHash, randomUUID } from 'node:crypto';
import type {
  AppUserId,
  FamilyId,
  SyncChangelogEntry,
  SyncCursor,
  SyncOperation,
  SyncOperationReceipt,
  SyncPullResponse,
  SyncPushResponse,
} from '@lumi/contracts';
import {
  LUMI_API_LIMITS,
  LUMI_API_PROTOCOL_VERSION,
  authorizeFamilyAccess,
} from '@lumi/contracts';

type FamilySyncState = {
  familyId: FamilyId;
  epoch: number;
  lastChangelogSeq: number;
  writerGeneration: number;
};

type StoredReceipt = {
  familyId: FamilyId;
  operationId: string;
  payloadHash: string;
  operation: SyncOperation;
  receipt: SyncOperationReceipt;
  changelogSeq: number;
  acceptedAt: string;
};

type CursorPayload = {
  epoch: number;
  seq: number;
};

/**
 * In-memory sync ledger with commit-safe changelog numbering. Sequence is
 * assigned only while the family lock is held at accept time, never leased
 * before the durable write completes.
 */
export class MemorySyncStore {
  readonly states = new Map<FamilyId, FamilySyncState>();
  readonly byOperation = new Map<string, StoredReceipt>();
  readonly changelog = new Map<FamilyId, StoredReceipt[]>();
  private readonly locks = new Map<FamilyId, Promise<void>>();
  /** Test hook: delay before assigning changelog seq to prove ordering. */
  slowCommitMs = 0;

  ensureFamily(familyId: FamilyId): FamilySyncState {
    let state = this.states.get(familyId);
    if (!state) {
      state = {
        familyId,
        epoch: 1,
        lastChangelogSeq: 0,
        writerGeneration: 1,
      };
      this.states.set(familyId, state);
      this.changelog.set(familyId, []);
    }
    return state;
  }

  /**
   * Simulates a hosting move that keeps receipts/hashes but bumps epoch so an
   * old cursor cannot silently skip gaps.
   */
  rotateEpochKeepReceipts(familyId: FamilyId): number {
    const state = this.ensureFamily(familyId);
    state.epoch += 1;
    state.writerGeneration += 1;
    return state.epoch;
  }

  async push(input: {
    familyId: FamilyId;
    appUserId: AppUserId;
    memberships: readonly {
      appUserId: AppUserId;
      familyId: FamilyId;
      role: 'admin' | 'caregiver';
      status: 'active' | 'revoked';
    }[];
    attemptId: string;
    operations: readonly SyncOperation[];
    now: string;
  }): Promise<SyncPushResponse> {
    const access = authorizeFamilyAccess({
      memberships: input.memberships as never,
      appUserId: input.appUserId,
      familyId: input.familyId,
    });
    if (!access.allow) {
      throw coded('forbidden', access.reason === 'revoked' ? 'revoked' : 'forbidden');
    }
    if (input.operations.length === 0 || input.operations.length > LUMI_API_LIMITS.maxSyncPushBatch) {
      throw coded('validation', 'invalid_batch_size');
    }

    return this.withFamilyLock(input.familyId, async () => {
      const state = this.ensureFamily(input.familyId);
      const receipts: SyncOperationReceipt[] = [];

      // Family lock scope: assign sequences only after validation, in order.
      for (const operation of input.operations) {
        receipts.push(await this.acceptOne(state, input.appUserId, operation, input.now));
      }

      return {
        familyId: input.familyId,
        attemptId: input.attemptId,
        epoch: state.epoch,
        receipts,
      };
    });
  }

  pull(input: {
    familyId: FamilyId;
    appUserId: AppUserId;
    memberships: readonly {
      appUserId: AppUserId;
      familyId: FamilyId;
      role: 'admin' | 'caregiver';
      status: 'active' | 'revoked';
    }[];
    cursor: SyncCursor | null;
    limit?: number;
  }): SyncPullResponse {
    const access = authorizeFamilyAccess({
      memberships: input.memberships as never,
      appUserId: input.appUserId,
      familyId: input.familyId,
    });
    if (!access.allow) {
      throw coded('forbidden', access.reason === 'revoked' ? 'revoked' : 'forbidden');
    }

    const state = this.ensureFamily(input.familyId);
    const limit = Math.min(
      Math.max(1, input.limit ?? 20),
      LUMI_API_LIMITS.maxSyncPullPage,
    );

    let afterSeq = 0;
    if (input.cursor) {
      const parsed = decodeCursor(input.cursor);
      if (!parsed || parsed.epoch !== state.epoch) {
        return {
          familyId: input.familyId,
          epoch: state.epoch,
          entries: [],
          nextCursor: null,
          resyncRequired: true,
        };
      }
      afterSeq = parsed.seq;
    }

    const log = this.changelog.get(input.familyId) ?? [];
    const slice = log.filter((item) => item.changelogSeq > afterSeq).slice(0, limit);
    const entries: SyncChangelogEntry[] = slice.map((item) => ({
      changelogSeq: item.changelogSeq,
      operationId: item.operationId,
      revisionId: item.operation.revisionId,
      entityId: item.operation.entityId,
      kind: item.operation.kind,
      payloadHash: item.payloadHash,
      payload: item.operation.payload,
      acceptedAt: item.acceptedAt,
      heads: item.receipt.heads ?? [item.operation.revisionId],
    }));
    const last = entries[entries.length - 1];
    return {
      familyId: input.familyId,
      epoch: state.epoch,
      entries,
      nextCursor: last
        ? encodeCursor({ epoch: state.epoch, seq: last.changelogSeq })
        : input.cursor,
      resyncRequired: false,
    };
  }

  private async withFamilyLock<T>(familyId: FamilyId, run: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(familyId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      familyId,
      previous.then(() => gate),
    );
    await previous;
    try {
      return await run();
    } finally {
      release();
    }
  }

  private async acceptOne(
    state: FamilySyncState,
    appUserId: AppUserId,
    operation: SyncOperation,
    now: string,
  ): Promise<SyncOperationReceipt> {
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
    if (String(operation.actorAppUserId) !== String(appUserId)) {
      return {
        operationId: operation.operationId,
        status: 'rejected',
        reason: 'forbidden',
      };
    }

    const key = `${state.familyId}:${operation.operationId}`;
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

    if (this.slowCommitMs > 0) {
      await sleep(this.slowCommitMs);
    }

    state.lastChangelogSeq += 1;
    const changelogSeq = state.lastChangelogSeq;
    const receipt: SyncOperationReceipt = {
      operationId: operation.operationId,
      status: 'accepted',
      revisionId: operation.revisionId,
      heads: [operation.revisionId],
      changelogSeq,
    };
    const stored: StoredReceipt = {
      familyId: state.familyId,
      operationId: operation.operationId,
      payloadHash: operation.payloadHash,
      operation,
      receipt,
      changelogSeq,
      acceptedAt: now,
    };
    this.byOperation.set(key, stored);
    this.changelog.get(state.familyId)!.push(stored);
    return receipt;
  }
}

export function hashSyncPayload(payload: Readonly<Record<string, unknown>>): string {
  return createHash('sha256')
    .update(stableStringify(payload), 'utf8')
    .digest('hex');
}

export function encodeCursor(payload: CursorPayload): SyncCursor {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url') as SyncCursor;
}

export function decodeCursor(cursor: string): CursorPayload | null {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function newAttemptId(): string {
  return randomUUID();
}
