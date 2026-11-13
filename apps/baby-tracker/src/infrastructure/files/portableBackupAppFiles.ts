import { Platform } from 'react-native';
import { assertPortableBackupReadable } from './portableBackupLimits';
import { LAST_PORTABLE_BACKUP_BASENAME } from './portableBackupAppPaths';

export {
  LAST_PORTABLE_BACKUP_BASENAME,
  androidExternalPortableBackupDirUri,
  describePortableBackupSidecarForTests,
  lastPortableBackupSidecarUri,
} from './portableBackupAppPaths';

export type PortableBackupSidecarResult =
  { ok: true; uri: string } | { ok: false; code: 'unavailable' | 'failed'; message: string };

/**
 * Persists the sealed envelope under the app document directory so caregivers
 * can reload the last export without the system picker. Share success still
 * does not prove the file was archived elsewhere.
 *
 * Expo FileSystem only grants write access under the app files/cache trees; a
 * hardcoded Android/data URI is rejected before the directory exists.
 */
export async function writeLastPortableBackupSidecar(
  serialized: string,
  fileName: string = LAST_PORTABLE_BACKUP_BASENAME,
): Promise<PortableBackupSidecarResult> {
  assertPortableBackupReadable(serialized);
  if (Platform.OS === 'web') {
    return {
      ok: false,
      code: 'unavailable',
      message: 'Sidecar soubor je dostupný jen v nativní aplikaci.',
    };
  }
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const root = FileSystem.documentDirectory;
    if (!root) {
      return { ok: false, code: 'unavailable', message: 'Dokumentové úložiště není dostupné.' };
    }
    const dir = `${root}portable-backups/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const primary = `${dir}${LAST_PORTABLE_BACKUP_BASENAME}`;
    await FileSystem.writeAsStringAsync(primary, serialized);
    if (fileName !== LAST_PORTABLE_BACKUP_BASENAME) {
      await FileSystem.writeAsStringAsync(`${dir}${fileName}`, serialized);
    }
    return { ok: true, uri: primary };
  } catch (error) {
    return {
      ok: false,
      code: 'failed',
      message: error instanceof Error ? error.message : 'Zápis sidecar souboru selhal',
    };
  }
}

export async function readLastPortableBackupSidecar(): Promise<
  | { ok: true; contents: string; uri: string }
  | { ok: false; code: 'missing' | 'failed'; message: string }
> {
  if (Platform.OS === 'web') {
    return { ok: false, code: 'missing', message: 'Sidecar soubor na webu není.' };
  }
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const root = FileSystem.documentDirectory;
    if (!root) {
      return { ok: false, code: 'missing', message: 'Dokumentové úložiště není dostupné.' };
    }
    const uri = `${root}portable-backups/${LAST_PORTABLE_BACKUP_BASENAME}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) {
      return {
        ok: false,
        code: 'missing',
        message: 'Ve složce aplikace není žádný poslední export.',
      };
    }
    const contents = await FileSystem.readAsStringAsync(uri);
    assertPortableBackupReadable(contents);
    return { ok: true, contents, uri };
  } catch (error) {
    return {
      ok: false,
      code: 'failed',
      message: error instanceof Error ? error.message : 'Čtení sidecar souboru selhal',
    };
  }
}
