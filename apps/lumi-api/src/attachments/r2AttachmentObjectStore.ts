import { createHash } from 'node:crypto';
import type { AttachmentObjectStorePort, StoredAttachmentObject } from './objectStore.ts';
import type { S3CompatibleClient } from './s3CompatibleClient.ts';

type MetaRecord = {
  familyId: string;
  attachmentId: string;
  role: 'display' | 'thumbnail';
  sha256: string;
  byteLength: number;
  activated: boolean;
  erased: boolean;
};

/**
 * R2/S3-backed private attachment store. Staging and active namespaces keep
 * failed uploads from becoming readable family objects.
 */
/** Object keys minted by the family attachment service. */
export function parseFamilyAttachmentObjectKey(objectKey: string): {
  readonly familyId: string;
  readonly attachmentId: string;
  readonly role: 'display' | 'thumbnail';
} | null {
  const parts = objectKey.split('/');
  if (parts.length < 6) return null;
  if (parts[0] !== 'fam' || parts[2] !== 'att') return null;
  const role = parts[4];
  if (role !== 'display' && role !== 'thumbnail') return null;
  const familyId = parts[1];
  const attachmentId = parts[3];
  if (!familyId || !attachmentId) return null;
  return { familyId, attachmentId, role };
}

export function createR2AttachmentObjectStore(input: {
  readonly client: S3CompatibleClient;
  /** Optional in-process meta for tests; production may replace with durable rows. */
  readonly meta?: Map<string, MetaRecord>;
}): AttachmentObjectStorePort {
  const meta = input.meta ?? new Map<string, MetaRecord>();

  function stagingKey(objectKey: string): string {
    return `staging/${objectKey}`;
  }
  function activeKey(objectKey: string): string {
    return `active/${objectKey}`;
  }

  return {
    async putStaging(request) {
      if (request.bytes.byteLength === 0) return { ok: false, reason: 'empty' };
      const sha256 = createHash('sha256').update(request.bytes).digest('hex');
      if (sha256 !== request.expectedSha256) {
        return { ok: false, reason: 'digest_mismatch' };
      }
      const ok = await input.client.putObject(
        stagingKey(request.objectKey),
        request.bytes,
        'image/jpeg',
      );
      if (!ok) return { ok: false, reason: 'digest_mismatch' };
      meta.set(request.objectKey, {
        familyId: request.familyId,
        attachmentId: request.attachmentId,
        role: request.role,
        sha256,
        byteLength: request.bytes.byteLength,
        activated: false,
        erased: false,
      });
      return { ok: true };
    },

    async activate(objectKey) {
      const row = meta.get(objectKey);
      if (!row || row.erased) return false;
      const bytes = await input.client.getObject(stagingKey(objectKey));
      if (!bytes) return false;
      const put = await input.client.putObject(activeKey(objectKey), bytes, 'image/jpeg');
      if (!put) return false;
      await input.client.deleteObject(stagingKey(objectKey));
      meta.set(objectKey, { ...row, activated: true });
      return true;
    },

    async readActivated(objectKey) {
      const row = meta.get(objectKey);
      if (row?.erased) return null;
      if (row && !row.activated) return null;
      const bytes = await input.client.getObject(activeKey(objectKey));
      if (!bytes) return null;
      if (row) {
        return {
          objectKey,
          familyId: row.familyId,
          attachmentId: row.attachmentId,
          role: row.role,
          bytes,
          sha256: row.sha256,
          contentType: 'image/jpeg' as const,
          activated: true,
          erased: false,
        } satisfies StoredAttachmentObject;
      }
      // Another API process may have activated the object; durable metadata
      // already authorized the opaque key, so reconstruct identity from it.
      const parsed = parseFamilyAttachmentObjectKey(objectKey);
      if (!parsed) return null;
      return {
        objectKey,
        familyId: parsed.familyId,
        attachmentId: parsed.attachmentId,
        role: parsed.role,
        bytes,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        contentType: 'image/jpeg',
        activated: true,
        erased: false,
      };
    },

    async tombstoneByAttachment(request) {
      let count = 0;
      for (const [objectKey, row] of meta) {
        if (row.familyId !== request.familyId || row.attachmentId !== request.attachmentId) {
          continue;
        }
        await input.client.deleteObject(stagingKey(objectKey));
        await input.client.deleteObject(activeKey(objectKey));
        meta.set(objectKey, { ...row, erased: true, activated: false });
        count += 1;
      }
      return count;
    },

    async deleteStaging(objectKey) {
      const row = meta.get(objectKey);
      if (row?.activated) return;
      await input.client.deleteObject(stagingKey(objectKey));
      if (row && !row.activated) meta.delete(objectKey);
    },

    async purgeActivated(objectKey) {
      const row = meta.get(objectKey);
      if (row?.erased) return false;
      if (row && !row.activated) return false;
      const active = await input.client.getObject(activeKey(objectKey));
      if (!active && !row) return false;
      await input.client.deleteObject(activeKey(objectKey));
      await input.client.deleteObject(stagingKey(objectKey));
      meta.delete(objectKey);
      return true;
    },
  };
}
