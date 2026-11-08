import {
  parseDiaryArchive,
  type DiaryArchive,
  type DiaryArchiveManifest,
} from '../../domain';
import { AppError } from '../../domain/errors';

export const DAILY_CHECKPOINT_RETENTION = 7;
export const PRE_IMPORT_CHECKPOINT_RETENTION = 3;

export type LogicalCheckpointKind = 'daily' | 'pre_import';

export type LogicalCheckpointSummary = {
  checkpointId: string;
  kind: LogicalCheckpointKind;
  createdAtMs: number;
  /** Local calendar day key for daily rotation (YYYY-MM-DD). */
  dayKey: string | null;
  manifest: DiaryArchiveManifest;
};

export type LogicalCheckpointRecord = LogicalCheckpointSummary & {
  archiveJson: string;
};

/**
 * Device-local recovery points kept outside the live diary tables so a replace
 * import cannot wipe the mandatory rollback copy.
 */
export type LogicalCheckpointVault = {
  create(input: {
    kind: LogicalCheckpointKind;
    archive: DiaryArchive;
    dayKey?: string | null;
    nowMs: number;
  }): Promise<LogicalCheckpointSummary>;
  list(): Promise<LogicalCheckpointSummary[]>;
  read(checkpointId: string): Promise<LogicalCheckpointRecord | null>;
  readArchive(checkpointId: string): Promise<DiaryArchive>;
  /** Removes every local recovery point (used by full personal wipe). */
  clearAll(): Promise<void>;
};

/**
 * Persistence backend for logical checkpoints. Production adapters must survive
 * process death; in-memory maps are only for tests.
 */
export type LogicalCheckpointBackend = {
  listRecords(): Promise<LogicalCheckpointRecord[]>;
  putRecord(record: LogicalCheckpointRecord): Promise<void>;
  deleteRecord(checkpointId: string): Promise<void>;
  clearAll(): Promise<void>;
};

export function createLogicalCheckpointVault(
  backend: LogicalCheckpointBackend,
): LogicalCheckpointVault {
  return {
    async create(input) {
      let archiveJson: string;
      try {
        archiveJson = JSON.stringify(input.archive);
      } catch (error) {
        throw new AppError(
          'STORAGE',
          'Could not serialize a local recovery point; live diary was left unchanged',
          {
            details: { reason: 'checkpoint_serialize' },
            retryable: true,
            cause: error,
          },
        );
      }
      if (archiveJson.length === 0) {
        throw new AppError(
          'STORAGE',
          'Empty recovery point is not consistent; operation refused',
          { details: { reason: 'checkpoint_empty' } },
        );
      }

      const existing = await backend.listRecords();
      const checkpointId = `logical_${input.kind}_${input.nowMs}_${existing.length + 1}`;
      const record: LogicalCheckpointRecord = {
        checkpointId,
        kind: input.kind,
        createdAtMs: input.nowMs,
        dayKey: input.kind === 'daily' ? (input.dayKey ?? null) : null,
        manifest: input.archive.manifest,
        archiveJson,
      };
      await backend.putRecord(record);

      // Rotate only after a successful write so the last valid point survives
      // a follow-up failure (for example when free space is exhausted mid-run).
      const afterWrite = await backend.listRecords();
      const toDelete =
        input.kind === 'daily'
          ? pruneDailyIds(afterWrite, DAILY_CHECKPOINT_RETENTION)
          : pruneKindIds(afterWrite, 'pre_import', PRE_IMPORT_CHECKPOINT_RETENTION);
      for (const id of toDelete) {
        await backend.deleteRecord(id);
      }

      return summarize(record);
    },
    async list() {
      return (await backend.listRecords())
        .map(summarize)
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    },
    async read(checkpointId) {
      return (await backend.listRecords()).find((row) => row.checkpointId === checkpointId) ?? null;
    },
    async readArchive(checkpointId) {
      const record = await this.read(checkpointId);
      if (record == null) {
        throw new AppError('NOT_FOUND', 'Local recovery point is not available', {
          details: { checkpointId },
        });
      }
      return parseDiaryArchive(record.archiveJson);
    },
    async clearAll() {
      await backend.clearAll();
    },
  };
}

export function createMemoryLogicalCheckpointVault(): LogicalCheckpointVault & {
  readonly records: Map<string, LogicalCheckpointRecord>;
  readonly backend: LogicalCheckpointBackend;
} {
  const records = new Map<string, LogicalCheckpointRecord>();
  const backend: LogicalCheckpointBackend = {
    async listRecords() {
      return [...records.values()];
    },
    async putRecord(record) {
      records.set(record.checkpointId, record);
    },
    async deleteRecord(checkpointId) {
      records.delete(checkpointId);
    },
    async clearAll() {
      records.clear();
    },
  };
  return Object.assign(createLogicalCheckpointVault(backend), { records, backend });
}

function summarize(record: LogicalCheckpointRecord): LogicalCheckpointSummary {
  return {
    checkpointId: record.checkpointId,
    kind: record.kind,
    createdAtMs: record.createdAtMs,
    dayKey: record.dayKey,
    manifest: record.manifest,
  };
}

function pruneDailyIds(records: LogicalCheckpointRecord[], retain: number): string[] {
  const daily = [...records]
    .filter((row) => row.kind === 'daily')
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  const keptKeys = new Set<string>();
  const keepIds = new Set<string>();
  const remove: string[] = [];
  for (const row of daily) {
    const key = row.dayKey ?? row.checkpointId;
    if (keptKeys.has(key) || keepIds.size >= retain) {
      remove.push(row.checkpointId);
      continue;
    }
    keptKeys.add(key);
    keepIds.add(row.checkpointId);
  }
  return remove;
}

function pruneKindIds(
  records: LogicalCheckpointRecord[],
  kind: LogicalCheckpointKind,
  retain: number,
): string[] {
  const matched = [...records]
    .filter((row) => row.kind === kind)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  return matched.slice(retain).map((row) => row.checkpointId);
}
