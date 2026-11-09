import type { PrivateAttachmentBlobStore } from '../../domain/attachments';
import { openAttachmentBlob, sealAttachmentBlob } from './sealedBlobCodec';

/**
 * In-memory durable store for unit tests. Production factories must use the
 * filesystem/IndexedDB sealed adapters — never this map.
 */
export function createMemoryPrivateAttachmentStore(input: {
  key: Uint8Array;
}): PrivateAttachmentBlobStore {
  const files = new Map<string, string>();
  return {
    async writeDurable({ blobKey, bytes, aad }) {
      const sealed = sealAttachmentBlob(input.key, bytes, aad);
      files.set(blobKey, JSON.stringify(sealed));
    },
    async readDurable({ blobKey, aad }) {
      const raw = files.get(blobKey);
      if (!raw) throw new Error(`Missing durable attachment blob ${blobKey}`);
      return openAttachmentBlob(input.key, JSON.parse(raw), aad);
    },
    async deleteDurable(blobKey) {
      files.delete(blobKey);
    },
    async hasDurable(blobKey) {
      return files.has(blobKey);
    },
  };
}
