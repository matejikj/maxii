import { Platform } from 'react-native';
import { deleteWebAttachmentBlobDatabase } from './dexiePrivateAttachmentStore';

const NATIVE_ATTACHMENT_ROOT = 'lumi-private-attachments/';

/**
 * Removes sealed photo blobs and local attachment metadata during a personal
 * wipe so diary erase also drops private photographs.
 */
export async function clearPersonalAttachmentStorage(): Promise<void> {
  if (Platform.OS === 'web') {
    await deleteWebAttachmentBlobDatabase();
    return;
  }
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const root = FileSystem.documentDirectory;
    if (!root) return;
    await FileSystem.deleteAsync(`${root}${NATIVE_ATTACHMENT_ROOT}`, {
      idempotent: true,
    });
  } catch {
    // Wipe continues even if the photo directory is already gone.
  }
}
