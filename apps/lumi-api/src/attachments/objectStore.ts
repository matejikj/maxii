import { createHash } from 'node:crypto';

export type StoredAttachmentObject = {
  readonly objectKey: string;
  readonly familyId: string;
  readonly attachmentId: string;
  readonly role: 'display' | 'thumbnail';
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly contentType: 'image/jpeg';
  readonly activated: boolean;
  readonly erased: boolean;
};

export type AttachmentObjectStorePort = {
  putStaging(input: {
    objectKey: string;
    familyId: string;
    attachmentId: string;
    role: 'display' | 'thumbnail';
    bytes: Uint8Array;
    expectedSha256: string;
  }): Promise<{ ok: true } | { ok: false; reason: 'digest_mismatch' | 'empty' }>;
  activate(objectKey: string): Promise<boolean>;
  readActivated(objectKey: string): Promise<StoredAttachmentObject | null>;
  tombstoneByAttachment(input: {
    familyId: string;
    attachmentId: string;
  }): Promise<number>;
  deleteStaging(objectKey: string): Promise<void>;
  /**
   * Remove an activated object after a verified locator cutover. Staging-only
   * rows stay on deleteStaging; erased tombstones are left for retention policy.
   */
  purgeActivated(objectKey: string): Promise<boolean>;
};

/**
 * In-memory private object store shaped like a future R2 adapter. Keys stay
 * opaque; activation is separate from staging so failed uploads never publish.
 */
export function createMemoryAttachmentObjectStore(): AttachmentObjectStorePort {
  const objects = new Map<string, StoredAttachmentObject>();

  return {
    async putStaging(input) {
      if (input.bytes.byteLength === 0) return { ok: false, reason: 'empty' };
      const sha256 = createHash('sha256').update(input.bytes).digest('hex');
      if (sha256 !== input.expectedSha256) {
        return { ok: false, reason: 'digest_mismatch' };
      }
      objects.set(input.objectKey, {
        objectKey: input.objectKey,
        familyId: input.familyId,
        attachmentId: input.attachmentId,
        role: input.role,
        bytes: Uint8Array.from(input.bytes),
        sha256,
        contentType: 'image/jpeg',
        activated: false,
        erased: false,
      });
      return { ok: true };
    },
    async activate(objectKey) {
      const row = objects.get(objectKey);
      if (!row || row.erased) return false;
      objects.set(objectKey, { ...row, activated: true });
      return true;
    },
    async readActivated(objectKey) {
      const row = objects.get(objectKey);
      if (!row || !row.activated || row.erased) return null;
      return row;
    },
    async tombstoneByAttachment(input) {
      let count = 0;
      for (const [key, row] of objects) {
        if (row.familyId === input.familyId && row.attachmentId === input.attachmentId) {
          objects.set(key, { ...row, erased: true, activated: false });
          count += 1;
        }
      }
      return count;
    },
    async deleteStaging(objectKey) {
      const row = objects.get(objectKey);
      if (row && !row.activated) objects.delete(objectKey);
    },
    async purgeActivated(objectKey) {
      const row = objects.get(objectKey);
      if (!row || !row.activated || row.erased) return false;
      objects.delete(objectKey);
      return true;
    },
  };
}
