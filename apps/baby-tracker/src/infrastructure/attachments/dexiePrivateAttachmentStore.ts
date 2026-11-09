import type { PrivateAttachmentBlobStore } from '../../domain/attachments';
import {
  AttachmentBlobDatabase,
  WEB_ATTACHMENT_BLOB_DATABASE_NAME,
} from './attachmentBlobDatabase';
import { openAttachmentBlob, sealAttachmentBlob } from './sealedBlobCodec';

/**
 * Durable sealed JPEG store for the web diary. Rows are private IndexedDB
 * records — not CacheStorage — so a routine SW refresh cannot drop photos.
 */
export function createDexiePrivateAttachmentStore(input: {
  key: Uint8Array;
  databaseName?: string;
  nowMs?: () => number;
}): PrivateAttachmentBlobStore {
  const db = new AttachmentBlobDatabase(
    input.databaseName ?? WEB_ATTACHMENT_BLOB_DATABASE_NAME,
  );
  const nowMs = input.nowMs ?? (() => Date.now());

  return {
    async writeDurable({ blobKey, bytes, aad }) {
      const sealed = sealAttachmentBlob(input.key, bytes, aad);
      await db.sealedBlobs.put({
        blobKey,
        format: sealed.format,
        nonceHex: sealed.nonceHex,
        ciphertextHex: sealed.ciphertextHex,
        updatedAtMs: nowMs(),
      });
    },
    async readDurable({ blobKey, aad }) {
      const row = await db.sealedBlobs.get(blobKey);
      if (!row) throw new Error(`Missing durable attachment blob ${blobKey}`);
      return openAttachmentBlob(
        input.key,
        {
          format: row.format as 'lumi.attachment-blob.v1',
          nonceHex: row.nonceHex,
          ciphertextHex: row.ciphertextHex,
        },
        aad,
      );
    },
    async deleteDurable(blobKey) {
      await db.sealedBlobs.delete(blobKey);
    },
    async hasDurable(blobKey) {
      const row = await db.sealedBlobs.get(blobKey);
      return row != null;
    },
  };
}

/** Wipe helper — clears sealed photo blobs without touching the diary schema. */
export async function deleteWebAttachmentBlobDatabase(
  databaseName = WEB_ATTACHMENT_BLOB_DATABASE_NAME,
): Promise<void> {
  const Dexie = (await import('dexie')).default;
  await Dexie.delete(databaseName);
}
