import { AppError } from '../../../domain/errors';
import type { Instant } from '../../../domain/ports/clock';
import type { FaultInjection } from '../../../domain';
import {
  LumiWebDatabase,
  WEB_DIARY_DATABASE_NAME,
  WEB_SCHEMA_VERSION,
} from './lumiWebDatabase';
import { createTabLeaseCoordinator, type TabLeaseCoordinator } from './tabLease';
import {
  createMemoryWebCheckpointStore,
  type WebCheckpointStore,
} from './webCheckpoint';
import { createWebChangeFeed, type WebChangeFeed } from './webChangeFeed';
import { probeWebStorageCapabilities } from './webLimits';
import type { WebDiaryRuntime } from './webUnitOfWork';

export type OpenWebDatabaseOptions = {
  databaseName?: string;
  lockDatabaseName?: string;
  tabId?: string;
  now?: Instant;
  faults?: FaultInjection;
  checkpointStore?: WebCheckpointStore;
  changeFeed?: WebChangeFeed;
  /** Injected for tests — e.g. simulate blocked upgrade or missing IndexedDB. */
  openDatabase?: (name: string) => LumiWebDatabase;
};

export type WebDatabaseHandle = WebDiaryRuntime & {
  readonly capabilities: Awaited<ReturnType<typeof probeWebStorageCapabilities>>;
  close(): Promise<void>;
};

/**
 * Opens the personal web diary, runs Dexie upgrades behind a migrate lease, and
 * refuses to pretend the origin store is a hardware vault.
 */
export async function openWebDatabase(
  options: OpenWebDatabaseOptions = {},
): Promise<WebDatabaseHandle> {
  const faults = options.faults;
  if (faults?.shouldFail('storage_corrupt')) {
    throw new AppError('STORAGE', 'Injected corrupt web database fault', {
      details: { reason: 'storage_corrupt' },
    });
  }
  if (faults?.shouldFail('storage_full')) {
    throw new AppError('STORAGE', 'Browser storage quota was exceeded', {
      details: { reason: 'storage_full' },
      retryable: true,
    });
  }
  if (faults?.shouldFail('storage_busy')) {
    throw new AppError('STORAGE', 'Database is busy or locked', {
      details: { reason: 'storage_busy' },
      retryable: true,
    });
  }

  const capabilities = await probeWebStorageCapabilities();
  if (!capabilities.indexedDbAvailable) {
    throw new AppError('UNAVAILABLE', 'IndexedDB is not available in this browser context', {
      details: { reason: 'indexeddb_unavailable' },
    });
  }

  const databaseName = options.databaseName ?? WEB_DIARY_DATABASE_NAME;
  const lease = createTabLeaseCoordinator({
    ...(options.tabId !== undefined ? { tabId: options.tabId } : {}),
    nowMs: () => options.now?.epochMs ?? Date.now(),
    ...(options.lockDatabaseName !== undefined
      ? { lockDatabaseName: options.lockDatabaseName }
      : {}),
  });
  const checkpointStore = options.checkpointStore ?? createMemoryWebCheckpointStore();
  const changeFeed = options.changeFeed ?? createWebChangeFeed();
  const db = options.openDatabase?.(databaseName) ?? new LumiWebDatabase(databaseName);

  try {
    await lease.reclaimExpired();
    await lease.acquire('migrate');
    try {
      await db.open();
      await checkpointStore.createLogicalSnapshot({
        db,
        schemaVersion: WEB_SCHEMA_VERSION,
        now: options.now ?? { epochMs: Date.now() },
      });
      await db.meta.put({ key: 'schemaVersion', value: String(WEB_SCHEMA_VERSION) });
      if ((await db.meta.get('dataVersion')) == null) {
        await db.meta.put({ key: 'dataVersion', value: '0' });
      }
    } finally {
      await lease.release('migrate');
    }
  } catch (error) {
    lease.close();
    changeFeed.close();
    db.close();
    if (isBlockedUpgrade(error)) {
      throw new AppError(
        'STORAGE',
        'Database upgrade is blocked by another open tab. Close older tabs and reload.',
        {
          details: { reason: 'upgrade_blocked_by_tab' },
          retryable: true,
          cause: error,
        },
      );
    }
    throw error;
  }

  const runtime: WebDiaryRuntime = {
    db,
    lease,
    changeFeed,
    async getDataVersion() {
      const row = await db.meta.get('dataVersion');
      return row ? Number(row.value) || 0 : 0;
    },
    async bumpDataVersion(txnDb) {
      const row = await txnDb.meta.get('dataVersion');
      const next = (row ? Number(row.value) || 0 : 0) + 1;
      await txnDb.meta.put({ key: 'dataVersion', value: String(next) });
      return next;
    },
  };

  return {
    ...runtime,
    capabilities,
    async close() {
      changeFeed.close();
      await lease.release('write').catch(() => undefined);
      await lease.release('migrate').catch(() => undefined);
      lease.close();
      db.close();
    },
  };
}

function isBlockedUpgrade(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UpgradeError|blocked|versionchange|older version/i.test(message);
}

export type { TabLeaseCoordinator };
