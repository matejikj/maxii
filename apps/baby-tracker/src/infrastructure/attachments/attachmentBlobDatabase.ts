import Dexie, { type EntityTable } from 'dexie';

/**
 * Sealed photo blobs live in a diary-adjacent IndexedDB that is never the
 * public service-worker app cache. Origin isolation is the web boundary —
 * AEAD still authenticates each rendition so swapped rows fail open.
 */
export const WEB_ATTACHMENT_BLOB_DATABASE_NAME = 'lumi-web-attachment-blobs';
export const WEB_ATTACHMENT_BLOB_SCHEMA_VERSION = 1;

export type WebSealedAttachmentBlobRow = {
  blobKey: string;
  format: string;
  nonceHex: string;
  ciphertextHex: string;
  updatedAtMs: number;
};

export class AttachmentBlobDatabase extends Dexie {
  sealedBlobs!: EntityTable<WebSealedAttachmentBlobRow, 'blobKey'>;

  constructor(databaseName = WEB_ATTACHMENT_BLOB_DATABASE_NAME) {
    super(databaseName);
    this.version(WEB_ATTACHMENT_BLOB_SCHEMA_VERSION).stores({
      sealedBlobs: 'blobKey, updatedAtMs',
    });
  }
}
