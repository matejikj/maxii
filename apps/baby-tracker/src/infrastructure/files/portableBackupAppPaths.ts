import { PERSONAL_APPLICATION_ID } from '../../ops/releaseEvidence.ts';
import { portableBackupFileName } from './portableBackupLimits';

/**
 * Stable sidecar basename under the app document directory. Install scripts may
 * pull it from the emulator app-files tree with adb root; this is not a cloud
 * backup and share-sheet dismissal still does not prove archival elsewhere.
 */
export const LAST_PORTABLE_BACKUP_BASENAME = 'lumi-last-portable-backup.json';

/** Relative directory used under Expo documentDirectory / Android filesDir. */
export const PORTABLE_BACKUP_SIDECAR_RELATIVE_DIR = 'portable-backups/';

/**
 * Absolute on-device path used by emulator install verification after `adb root`.
 * Production UI reads via Expo documentDirectory, not this literal string.
 */
export function androidAppFilesPortableBackupDir(
  applicationId: string = PERSONAL_APPLICATION_ID,
): string {
  return `/data/data/${applicationId}/files/${PORTABLE_BACKUP_SIDECAR_RELATIVE_DIR}`;
}

export function lastPortableBackupSidecarDevicePath(
  applicationId: string = PERSONAL_APPLICATION_ID,
): string {
  return `${androidAppFilesPortableBackupDir(applicationId)}${LAST_PORTABLE_BACKUP_BASENAME}`;
}

/** @deprecated Prefer lastPortableBackupSidecarDevicePath for install scripts. */
export function androidExternalPortableBackupDirUri(
  applicationId: string = PERSONAL_APPLICATION_ID,
): string {
  return `file://${androidAppFilesPortableBackupDir(applicationId)}`;
}

export function lastPortableBackupSidecarUri(
  applicationId: string = PERSONAL_APPLICATION_ID,
): string {
  return `file://${lastPortableBackupSidecarDevicePath(applicationId)}`;
}

export function describePortableBackupSidecarForTests(nowMs: number): {
  lastBasename: string;
  stampedBasename: string;
  androidDir: string;
  devicePath: string;
} {
  return {
    lastBasename: LAST_PORTABLE_BACKUP_BASENAME,
    stampedBasename: portableBackupFileName(nowMs),
    androidDir: androidExternalPortableBackupDirUri(),
    devicePath: lastPortableBackupSidecarDevicePath(),
  };
}
