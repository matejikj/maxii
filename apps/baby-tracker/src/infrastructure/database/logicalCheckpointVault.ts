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

export function createMemoryLogicalCheckpointVault(): LogicalCheckpointVault & {
  readonly records: Map<string, LogicalCheckpointRecord>;
} {
  const records = new Map<string, LogicalCheckpointRecord>();

  return {
    records,
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

      const checkpointId = `logical_${input.kind}_${input.nowMs}_${records.size + 1}`;
      const record: LogicalCheckpointRecord = {
        checkpointId,
        kind: input.kind,
        createdAtMs: input.nowMs,
        dayKey: input.kind === 'daily' ? (input.dayKey ?? null) : null,
        manifest: input.archive.manifest,
        archiveJson,
      };
      records.set(checkpointId, record);

      // Rotate only after a successful write so the last valid point survives
      // a follow-up failure (for example when free space is exhausted mid-run).
      if (input.kind === 'daily') {
        pruneDaily(records, DAILY_CHECKPOINT_RETENTION);
      } else {
        pruneKind(records, 'pre_import', PRE_IMPORT_CHECKPOINT_RETENTION);
      }

      return summarize(record);
    },
    async list() {
      return [...records.values()]
        .map(summarize)
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    },
    async read(checkpointId) {
      return records.get(checkpointId) ?? null;
    },
    async readArchive(checkpointId) {
      const record = records.get(checkpointId);
      if (record == null) {
        throw new AppError('NOT_FOUND', 'Local recovery point is not available', {
          details: { checkpointId },
        });
      }
      return parseDiaryArchive(record.archiveJson);
    },
    async clearAll() {
      records.clear();
    },
  };
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

function pruneDaily(
  records: Map<string, LogicalCheckpointRecord>,
  retain: number,
): void {
  const daily = [...records.values()]
    .filter((row) => row.kind === 'daily')
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  // Keep one checkpoint per day key when present, then drop beyond retention.
  const keptKeys = new Set<string>();
  const keepIds = new Set<string>();
  for (const row of daily) {
    const key = row.dayKey ?? row.checkpointId;
    if (keptKeys.has(key)) {
      records.delete(row.checkpointId);
      continue;
    }
    if (keepIds.size >= retain) {
      records.delete(row.checkpointId);
      continue;
    }
    keptKeys.add(key);
    keepIds.add(row.checkpointId);
  }
}

function pruneKind(
  records: Map<string, LogicalCheckpointRecord>,
  kind: LogicalCheckpointKind,
  retain: number,
): void {
  const matched = [...records.values()]
    .filter((row) => row.kind === kind)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  for (const row of matched.slice(retain)) {
    records.delete(row.checkpointId);
  }
}
