import Dexie, { type EntityTable } from 'dexie';
import type { WebLeaseRow } from './lumiWebDatabase';

/**
 * Tiny side database for cross-tab leases. Kept on schema v1 forever so diary
 * upgrades cannot deadlock against the lock store they need to coordinate.
 */
export const WEB_LOCK_DATABASE_NAME = 'lumi-web-diary-locks';

export class LumiWebLockDatabase extends Dexie {
  leases!: EntityTable<WebLeaseRow, 'leaseId'>;

  constructor(databaseName = WEB_LOCK_DATABASE_NAME) {
    super(databaseName);
    this.version(1).stores({
      leases: 'leaseId, purpose, ownerTabId, expiresAtMs',
    });
  }
}
