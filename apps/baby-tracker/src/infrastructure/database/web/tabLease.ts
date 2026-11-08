import { AppError } from '../../../domain/errors';
import type { WebLeaseRow } from './lumiWebDatabase';
import { LumiWebLockDatabase } from './lockDatabase';

export const WRITE_LEASE_ID = 'write';
export const MIGRATE_LEASE_ID = 'migrate';
export const DEFAULT_LEASE_TTL_MS = 15_000;

export type TabLeaseCoordinator = {
  readonly tabId: string;
  acquire(purpose: WebLeaseRow['purpose'], ttlMs?: number): Promise<void>;
  heartbeat(purpose: WebLeaseRow['purpose'], ttlMs?: number): Promise<void>;
  release(purpose: WebLeaseRow['purpose']): Promise<void>;
  /** Recover expired leases left by a crashed tab without touching live owners. */
  reclaimExpired(nowMs?: number): Promise<number>;
  close(): void;
};

/**
 * Cross-tab exclusive leases live in IndexedDB so BroadcastChannel alone cannot
 * authorize a second writer. Expired leases are reclaimable after a tab crash.
 */
export function createTabLeaseCoordinator(
  options: {
    tabId?: string;
    nowMs?: () => number;
    lockDatabaseName?: string;
    openLockDatabase?: (name: string) => LumiWebLockDatabase;
  } = {},
): TabLeaseCoordinator {
  const tabId = options.tabId ?? createTabId();
  const nowMs = options.nowMs ?? (() => Date.now());
  const lockDb =
    options.openLockDatabase?.(options.lockDatabaseName ?? 'lumi-web-diary-locks') ??
    new LumiWebLockDatabase(options.lockDatabaseName);

  return {
    tabId,
    async acquire(purpose, ttlMs = DEFAULT_LEASE_TTL_MS) {
      await lockDb.open();
      const leaseId = purpose === 'write' ? WRITE_LEASE_ID : MIGRATE_LEASE_ID;
      await lockDb.transaction('rw', lockDb.leases, async () => {
        const now = nowMs();
        await reclaimExpiredInTx(lockDb, now);
        const existing = await lockDb.leases.get(leaseId);
        if (existing && existing.expiresAtMs > now && existing.ownerTabId !== tabId) {
          throw new AppError('CONFLICT', 'Another browser tab holds the diary write lease', {
            details: { reason: 'tab_lease_held', purpose },
            retryable: true,
          });
        }
        await lockDb.leases.put({
          leaseId,
          purpose,
          ownerTabId: tabId,
          expiresAtMs: now + ttlMs,
          heartbeatAtMs: now,
        });
      });
    },

    async heartbeat(purpose, ttlMs = DEFAULT_LEASE_TTL_MS) {
      await lockDb.open();
      const leaseId = purpose === 'write' ? WRITE_LEASE_ID : MIGRATE_LEASE_ID;
      await lockDb.transaction('rw', lockDb.leases, async () => {
        const now = nowMs();
        const existing = await lockDb.leases.get(leaseId);
        if (existing == null || existing.ownerTabId !== tabId) {
          throw new AppError('CONFLICT', 'Cannot heartbeat a lease owned by another tab', {
            details: { reason: 'tab_lease_foreign', purpose },
            retryable: true,
          });
        }
        await lockDb.leases.put({
          ...existing,
          expiresAtMs: now + ttlMs,
          heartbeatAtMs: now,
        });
      });
    },

    async release(purpose) {
      await lockDb.open();
      const leaseId = purpose === 'write' ? WRITE_LEASE_ID : MIGRATE_LEASE_ID;
      await lockDb.transaction('rw', lockDb.leases, async () => {
        const existing = await lockDb.leases.get(leaseId);
        if (existing?.ownerTabId === tabId) {
          await lockDb.leases.delete(leaseId);
        }
      });
    },

    async reclaimExpired(atMs) {
      await lockDb.open();
      return lockDb.transaction('rw', lockDb.leases, async () =>
        reclaimExpiredInTx(lockDb, atMs ?? nowMs()),
      );
    },

    close() {
      lockDb.close();
    },
  };
}

async function reclaimExpiredInTx(db: LumiWebLockDatabase, now: number): Promise<number> {
  const rows = await db.leases.toArray();
  let removed = 0;
  for (const row of rows) {
    if (row.expiresAtMs <= now) {
      await db.leases.delete(row.leaseId);
      removed += 1;
    }
  }
  return removed;
}

function createTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `tab_${crypto.randomUUID()}`;
  }
  return `tab_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
