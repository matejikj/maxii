import { AppError } from '../../../domain/errors';
import type { Instant } from '../../../domain/ports/clock';

export type CheckpointRecord = {
  checkpointId: string;
  databaseName: string;
  fromVersion: number;
  createdAtMs: number;
  payload: Uint8Array;
};

export type CheckpointStore = {
  createPreMigrationCheckpoint(input: {
    databaseName: string;
    fromVersion: number;
    serialize: () => Promise<Uint8Array>;
    now: Instant;
  }): Promise<string>;
  read(checkpointId: string): Promise<CheckpointRecord | null>;
  restore(checkpointId: string): Promise<CheckpointRecord>;
};

/**
 * In-memory / injectable checkpoint vault. Production can swap in a file-backed
 * store; migrations refuse to start when serialization fails (e.g. disk full).
 */
export function createMemoryCheckpointStore(): CheckpointStore & {
  readonly records: Map<string, CheckpointRecord>;
} {
  const records = new Map<string, CheckpointRecord>();
  return {
    records,
    async createPreMigrationCheckpoint(input) {
      let payload: Uint8Array;
      try {
        payload = await input.serialize();
      } catch (error) {
        throw new AppError(
          'STORAGE',
          'Could not create a pre-migration checkpoint; migration was not started',
          {
            details: { reason: 'checkpoint_serialize' },
            retryable: true,
            cause: error,
          },
        );
      }
      if (payload.byteLength === 0) {
        throw new AppError(
          'STORAGE',
          'Empty checkpoint is not a consistent recovery point; migration refused',
          { details: { reason: 'checkpoint_empty' } },
        );
      }
      const checkpointId = `ckpt_${input.databaseName}_${input.now.epochMs}_${records.size + 1}`;
      records.set(checkpointId, {
        checkpointId,
        databaseName: input.databaseName,
        fromVersion: input.fromVersion,
        createdAtMs: input.now.epochMs,
        payload,
      });
      return checkpointId;
    },
    async read(checkpointId) {
      return records.get(checkpointId) ?? null;
    },
    async restore(checkpointId) {
      const record = records.get(checkpointId);
      if (record == null) {
        throw new AppError('NOT_FOUND', 'Checkpoint is not available for restore', {
          details: { checkpointId },
        });
      }
      return record;
    },
  };
}
