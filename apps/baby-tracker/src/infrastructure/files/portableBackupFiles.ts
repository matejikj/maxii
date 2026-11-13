import { Platform } from 'react-native';
import {
  MAX_PORTABLE_BACKUP_IMPORT_CHARS,
  assertPortableBackupReadable,
  portableBackupFileName,
} from './portableBackupLimits';
import { writeLastPortableBackupSidecar } from './portableBackupAppFiles';

export type PortableBackupFileResult =
  | {
      ok: true;
      outcome: 'shared' | 'downloaded' | 'copied';
      /** App-local sealed copy when the platform could write one. */
      sidecarUri?: string;
    }
  | { ok: false; code: 'cancelled' | 'unavailable' | 'failed'; message: string };

export type PortableBackupPickResult =
  | { ok: true; contents: string; fileName: string | null }
  | { ok: false; code: 'cancelled' | 'unavailable' | 'failed' | 'too_large'; message: string };

export { assertPortableBackupReadable, portableBackupFileName };

/**
 * Writes the sealed envelope to a cache file and opens the system share sheet.
 * Closing the sheet is not proof the caregiver stored the file permanently.
 */
export async function shareOrDownloadPortableBackup(
  serialized: string,
  fileName: string,
): Promise<PortableBackupFileResult> {
  if (Platform.OS === 'web') {
    return downloadPortableBackupWeb(serialized, fileName);
  }
  const sidecar = await writeLastPortableBackupSidecar(serialized, fileName);
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');
    const cacheRoot = FileSystem.cacheDirectory;
    if (!cacheRoot) {
      if (sidecar.ok) {
        // Sidecar alone still lets the caregiver retry from app storage.
        return { ok: true, outcome: 'copied', sidecarUri: sidecar.uri };
      }
      return { ok: false, code: 'unavailable', message: 'Dočasné úložiště není dostupné.' };
    }
    const path = `${cacheRoot}${fileName}`;
    await FileSystem.writeAsStringAsync(path, serialized);
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      if (sidecar.ok) {
        return { ok: true, outcome: 'copied', sidecarUri: sidecar.uri };
      }
      return {
        ok: false,
        code: 'unavailable',
        message: 'Sdílení souborů není na tomto zařízení dostupné.',
      };
    }
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'Uložit přenosnou zálohu',
      UTI: 'public.json',
    });
    // Best-effort cleanup of the share staging copy after the sheet returns.
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    return sidecar.ok
      ? { ok: true, outcome: 'shared', sidecarUri: sidecar.uri }
      : { ok: true, outcome: 'shared' };
  } catch (error) {
    if (sidecar.ok) {
      return { ok: true, outcome: 'copied', sidecarUri: sidecar.uri };
    }
    return {
      ok: false,
      code: 'failed',
      message: error instanceof Error ? error.message : 'Sdílení zálohy selhalo',
    };
  }
}

export async function pickPortableBackupFile(): Promise<PortableBackupPickResult> {
  if (Platform.OS === 'web') {
    return pickPortableBackupWeb();
  }
  try {
    const DocumentPicker = await import('expo-document-picker');
    const FileSystem = await import('expo-file-system/legacy');
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) {
      return { ok: false, code: 'cancelled', message: 'Výběr souboru byl zrušen.' };
    }
    const asset = picked.assets[0];
    if (asset.size != null && asset.size > MAX_PORTABLE_BACKUP_IMPORT_CHARS) {
      return {
        ok: false,
        code: 'too_large',
        message: 'Soubor zálohy je příliš velký a nebyl načten.',
      };
    }
    const contents = await FileSystem.readAsStringAsync(asset.uri);
    if (contents.length > MAX_PORTABLE_BACKUP_IMPORT_CHARS) {
      return {
        ok: false,
        code: 'too_large',
        message: 'Soubor zálohy je příliš velký a nebyl načten.',
      };
    }
    return { ok: true, contents, fileName: asset.name ?? null };
  } catch (error) {
    return {
      ok: false,
      code: 'failed',
      message: error instanceof Error ? error.message : 'Soubor se nepodařilo otevřít',
    };
  }
}

function downloadPortableBackupWeb(serialized: string, fileName: string): PortableBackupFileResult {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return { ok: false, code: 'unavailable', message: 'Stahování souboru není dostupné.' };
  }
  try {
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return { ok: true, outcome: 'downloaded' };
  } catch (error) {
    return {
      ok: false,
      code: 'failed',
      message: error instanceof Error ? error.message : 'Stahování selhalo',
    };
  }
}

function pickPortableBackupWeb(): Promise<PortableBackupPickResult> {
  if (typeof document === 'undefined') {
    return Promise.resolve({
      ok: false,
      code: 'unavailable',
      message: 'Výběr souboru není dostupný.',
    });
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,text/plain,.json';
    input.style.display = 'none';
    const cleanup = () => {
      input.remove();
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve({ ok: false, code: 'cancelled', message: 'Výběr souboru byl zrušen.' });
        return;
      }
      if (file.size > MAX_PORTABLE_BACKUP_IMPORT_CHARS) {
        resolve({
          ok: false,
          code: 'too_large',
          message: 'Soubor zálohy je příliš velký a nebyl načten.',
        });
        return;
      }
      file
        .text()
        .then((contents) => {
          if (contents.length > MAX_PORTABLE_BACKUP_IMPORT_CHARS) {
            resolve({
              ok: false,
              code: 'too_large',
              message: 'Soubor zálohy je příliš velký a nebyl načten.',
            });
            return;
          }
          resolve({ ok: true, contents, fileName: file.name });
        })
        .catch((error: unknown) => {
          resolve({
            ok: false,
            code: 'failed',
            message: error instanceof Error ? error.message : 'Soubor se nepodařilo přečíst',
          });
        });
    });
    input.addEventListener('cancel', () => {
      cleanup();
      resolve({ ok: false, code: 'cancelled', message: 'Výběr souboru byl zrušen.' });
    });
    document.body.appendChild(input);
    input.click();
  });
}
