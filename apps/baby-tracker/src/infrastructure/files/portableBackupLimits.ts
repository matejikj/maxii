import { AppError } from '../../domain/errors';

export const MAX_PORTABLE_BACKUP_IMPORT_CHARS = 8 * 1024 * 1024;

export function portableBackupFileName(nowMs: number): string {
  const stamp = new Date(nowMs).toISOString().replace(/[:.]/g, '-');
  return `lumi-portable-backup-${stamp}.json`;
}

export function assertPortableBackupReadable(serialized: string): void {
  if (serialized.trim().length === 0) {
    throw new AppError('VALIDATION', 'Soubor zálohy je prázdný', {
      details: { reason: 'empty_backup_file' },
    });
  }
  if (serialized.length > MAX_PORTABLE_BACKUP_IMPORT_CHARS) {
    throw new AppError('VALIDATION', 'Soubor zálohy je příliš velký', {
      details: { reason: 'backup_too_large' },
    });
  }
}
