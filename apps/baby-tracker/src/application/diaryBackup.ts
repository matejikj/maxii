import {
  DIARY_ARCHIVE_MAX_COMPAT,
  compareDiaryArchives,
  careEventsToPrivateCsv,
  filterDiaryArchiveByScope,
  filterExportableMeta,
  parseDiaryArchive,
  type DiaryArchive,
  type DiaryArchiveCompare,
  type DiaryExportScope,
  type UnitOfWorkFactory,
} from '../domain';
import { AppError } from '../domain/errors';
import {
  DEFAULT_ARGON2ID_PARAMS,
  type Argon2idParams,
  openPortableBackup,
  parsePortableBackup,
  sealPortableBackup,
  serializePortableBackup,
  type PortableBackupEnvelope,
} from '../infrastructure/crypto/portableBackup';
import type {
  LogicalCheckpointSummary,
  LogicalCheckpointVault,
} from '../infrastructure/database/logicalCheckpointVault';

export const META_LAST_PORTABLE_EXPORT_AT = 'last_portable_export_at_ms';

export type StagedPortableImport = {
  archive: DiaryArchive;
  compare: DiaryArchiveCompare;
};

export type ActivatedPortableImport = {
  rollbackCheckpointId: string;
  restoredCareEventCount: number;
};

function localDayKey(epochMs: number, timeZone: string): string {
  // en-CA yields stable YYYY-MM-DD for daily rotation keys.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(epochMs));
}

async function captureArchive(unitOfWork: UnitOfWorkFactory, nowMs: number): Promise<DiaryArchive> {
  return unitOfWork.run(async (uow) => {
    const archive = await uow.diary.capture({
      createdAtMs: nowMs,
      schemaCompatibility: DIARY_ARCHIVE_MAX_COMPAT,
    });
    return {
      ...archive,
      meta: filterExportableMeta(archive.meta),
    };
  });
}

/** Best-effort daily local recovery point; failures never block care writes. */
export async function ensureDailyLogicalCheckpoint(input: {
  unitOfWork: UnitOfWorkFactory;
  vault: LogicalCheckpointVault;
  nowMs: number;
  timeZone: string;
}): Promise<LogicalCheckpointSummary | null> {
  const dayKey = localDayKey(input.nowMs, input.timeZone);
  const existing = (await input.vault.list()).find(
    (row) => row.kind === 'daily' && row.dayKey === dayKey,
  );
  if (existing) return existing;
  try {
    const archive = await captureArchive(input.unitOfWork, input.nowMs);
    return await input.vault.create({
      kind: 'daily',
      archive,
      dayKey,
      nowMs: input.nowMs,
    });
  } catch {
    return null;
  }
}

export async function listLocalRecoveryPoints(
  vault: LogicalCheckpointVault,
): Promise<LogicalCheckpointSummary[]> {
  return vault.list();
}

export async function restoreLocalRecoveryPoint(input: {
  unitOfWork: UnitOfWorkFactory;
  vault: LogicalCheckpointVault;
  checkpointId: string;
}): Promise<number> {
  const archive = await input.vault.readArchive(input.checkpointId);
  await input.unitOfWork.run(async (uow) => {
    await uow.diary.replace(archive);
  });
  return archive.careEvents.length;
}

/**
 * Sealed portable diary for cross-device recovery. The returned text is the
 * recovery file; recording export time does not claim the file still exists
 * outside the phone.
 */
export async function exportSealedPortableDiary(input: {
  unitOfWork: UnitOfWorkFactory;
  password: string;
  nowMs: number;
  argonParams?: Argon2idParams;
  /**
   * Default exports every local child. One-child scope must never silently
   * include another profile's care rows.
   */
  scope?: DiaryExportScope;
}): Promise<{ serialized: string; envelope: PortableBackupEnvelope; exportedAtMs: number }> {
  const full = await captureArchive(input.unitOfWork, input.nowMs);
  const archive = filterDiaryArchiveByScope(full, input.scope ?? { kind: 'all_children' });
  const plaintext = new TextEncoder().encode(JSON.stringify(archive));
  const envelope = sealPortableBackup(
    plaintext,
    input.password,
    input.argonParams ?? DEFAULT_ARGON2ID_PARAMS,
  );
  await input.unitOfWork.run(async (uow) => {
    await uow.meta.set(META_LAST_PORTABLE_EXPORT_AT, String(input.nowMs));
  });
  return {
    serialized: serializePortableBackup(envelope),
    envelope,
    exportedAtMs: input.nowMs,
  };
}

export async function exportPrivateCareCsv(input: {
  unitOfWork: UnitOfWorkFactory;
  nowMs: number;
}): Promise<{ csv: string; careEventCount: number }> {
  const archive = await captureArchive(input.unitOfWork, input.nowMs);
  return {
    csv: careEventsToPrivateCsv(archive.careEvents),
    careEventCount: archive.careEvents.length,
  };
}

/**
 * Decrypt and validate into staging memory only. Live diary rows are untouched
 * until activatePortableImport runs after an explicit caregiver confirmation.
 */
export async function stagePortableImport(input: {
  unitOfWork: UnitOfWorkFactory;
  serializedEnvelope: string;
  password: string;
}): Promise<StagedPortableImport> {
  let envelope;
  try {
    envelope = parsePortableBackup(input.serializedEnvelope);
  } catch (error) {
    throw new AppError('VALIDATION', 'Portable backup file is incomplete or invalid', {
      details: { reason: 'envelope_parse' },
      cause: error,
    });
  }

  let plaintext: Uint8Array;
  try {
    plaintext = openPortableBackup(envelope, input.password);
  } catch (error) {
    throw new AppError('CRYPTO', 'Wrong recovery password or tampered backup file', {
      details: { reason: 'envelope_auth' },
      cause: error,
    });
  }

  const decoded = new TextDecoder().decode(plaintext);
  const incoming = parseDiaryArchive(decoded);
  const current = await captureArchive(input.unitOfWork, Date.now());
  return {
    archive: incoming,
    compare: compareDiaryArchives(current, incoming),
  };
}

/**
 * Creates the mandatory rollback point first. If that fails, the live diary
 * stays unchanged. Activation is a single replace — never a merge.
 */
export async function activatePortableImport(input: {
  unitOfWork: UnitOfWorkFactory;
  vault: LogicalCheckpointVault;
  archive: DiaryArchive;
  nowMs: number;
}): Promise<ActivatedPortableImport> {
  const current = await captureArchive(input.unitOfWork, input.nowMs);
  let rollbackCheckpointId: string;
  try {
    const point = await input.vault.create({
      kind: 'pre_import',
      archive: current,
      nowMs: input.nowMs,
    });
    rollbackCheckpointId = point.checkpointId;
  } catch (error) {
    throw new AppError('STORAGE', 'Could not create a rollback point; import was not started', {
      details: { reason: 'pre_import_checkpoint_failed' },
      retryable: true,
      cause: error,
    });
  }

  try {
    await input.unitOfWork.run(async (uow) => {
      await uow.diary.replace(input.archive);
    });
  } catch (error) {
    // Leave the rollback point available even when activation fails mid-write.
    throw new AppError(
      'STORAGE',
      'Import activation failed; previous diary remains available via rollback',
      {
        details: { reason: 'import_activate_failed', rollbackCheckpointId },
        retryable: true,
        cause: error,
      },
    );
  }

  return {
    rollbackCheckpointId,
    restoredCareEventCount: input.archive.careEvents.length,
  };
}

export async function rollbackPreImportRestore(input: {
  unitOfWork: UnitOfWorkFactory;
  vault: LogicalCheckpointVault;
  rollbackCheckpointId: string;
}): Promise<number> {
  return restoreLocalRecoveryPoint({
    unitOfWork: input.unitOfWork,
    vault: input.vault,
    checkpointId: input.rollbackCheckpointId,
  });
}

export async function readLastPortableExportAtMs(
  unitOfWork: UnitOfWorkFactory,
): Promise<number | null> {
  const raw = await unitOfWork.run((uow) => uow.meta.get(META_LAST_PORTABLE_EXPORT_AT));
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
