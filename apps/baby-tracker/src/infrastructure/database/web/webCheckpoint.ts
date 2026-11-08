import { AppError } from '../../../domain/errors';
import type { Instant } from '../../../domain/ports/clock';
import type { LumiWebDatabase } from './lumiWebDatabase';

export type WebCheckpointRecord = {
  checkpointId: string;
  databaseName: string;
  schemaVersion: number;
  createdAtMs: number;
  payloadJson: string;
};

export type WebCheckpointStore = {
  createLogicalSnapshot(input: {
    db: LumiWebDatabase;
    schemaVersion: number;
    now: Instant;
  }): Promise<string>;
  read(checkpointId: string): Promise<WebCheckpointRecord | null>;
};

/**
 * Logical JSON snapshot of diary stores. Used before schema upgrades; it is not
 * a browser-file backup and does not survive origin eviction by itself.
 */
export function createMemoryWebCheckpointStore(): WebCheckpointStore & {
  readonly records: Map<string, WebCheckpointRecord>;
} {
  const records = new Map<string, WebCheckpointRecord>();
  return {
    records,
    async createLogicalSnapshot(input) {
      try {
        const payload = {
          childProfiles: await input.db.childProfiles.toArray(),
          careEvents: await input.db.careEvents.toArray(),
          sessions: await input.db.sessions.toArray(),
          drafts: await input.db.drafts.toArray(),
          revisions: await input.db.revisions.toArray(),
          operationReceipts: await input.db.operationReceipts.toArray(),
          deletionMarkers: await input.db.deletionMarkers.toArray(),
          meta: await input.db.meta.toArray(),
        };
        const checkpointId = `web_ckpt_${input.db.name}_${input.now.epochMs}_${records.size + 1}`;
        records.set(checkpointId, {
          checkpointId,
          databaseName: input.db.name,
          schemaVersion: input.schemaVersion,
          createdAtMs: input.now.epochMs,
          payloadJson: JSON.stringify(payload),
        });
        return checkpointId;
      } catch (error) {
        throw new AppError(
          'STORAGE',
          'Could not create a web diary checkpoint; migration was not started',
          {
            details: { reason: 'web_checkpoint_failed' },
            retryable: true,
            cause: error,
          },
        );
      }
    },
    async read(checkpointId) {
      return records.get(checkpointId) ?? null;
    },
  };
}
