import type { PrivateAttachmentBlobStore } from '../../domain/attachments';
import { openAttachmentBlob, sealAttachmentBlob, type SealedAttachmentBlob } from './sealedBlobCodec';

const ROOT_SEGMENT = 'lumi-private-attachments/';

/**
 * Durable sealed JPEG store under the app documents directory. Not a disposable
 * image cache — own/pending copies stay until explicit delete/trash purge.
 */
export function createFilePrivateAttachmentStore(input: {
  key: Uint8Array;
}): PrivateAttachmentBlobStore {
  async function resolvePath(blobKey: string): Promise<string> {
    const FileSystem = await import('expo-file-system/legacy');
    const root = FileSystem.documentDirectory;
    if (!root) throw new Error('documentDirectory unavailable for attachment blobs');
    const dir = `${root}${ROOT_SEGMENT}`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const safe = blobKey.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${dir}${safe}.json`;
  }

  return {
    async writeDurable({ blobKey, bytes, aad }) {
      const FileSystem = await import('expo-file-system/legacy');
      const path = await resolvePath(blobKey);
      const sealed = sealAttachmentBlob(input.key, bytes, aad);
      await FileSystem.writeAsStringAsync(path, JSON.stringify(sealed));
    },
    async readDurable({ blobKey, aad }) {
      const FileSystem = await import('expo-file-system/legacy');
      const path = await resolvePath(blobKey);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists || info.isDirectory) {
        throw new Error(`Missing durable attachment blob ${blobKey}`);
      }
      const raw = await FileSystem.readAsStringAsync(path);
      const sealed = JSON.parse(raw) as SealedAttachmentBlob;
      return openAttachmentBlob(input.key, sealed, aad);
    },
    async deleteDurable(blobKey) {
      const FileSystem = await import('expo-file-system/legacy');
      const path = await resolvePath(blobKey);
      await FileSystem.deleteAsync(path, { idempotent: true });
    },
    async hasDurable(blobKey) {
      const FileSystem = await import('expo-file-system/legacy');
      const path = await resolvePath(blobKey);
      const info = await FileSystem.getInfoAsync(path);
      return Boolean(info.exists && !info.isDirectory);
    },
  };
}
