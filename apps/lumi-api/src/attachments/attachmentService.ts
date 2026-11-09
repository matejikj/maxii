import { createHash, randomUUID } from 'node:crypto';
import {
  FAMILY_ATTACHMENT_QUOTA,
  LUMI_API_PROTOCOL_VERSION,
  authorizeFamilyAttachmentAction,
  type AttachmentRenditionRole,
  type FamilyAttachmentFinalizeResponse,
  type FamilyAttachmentQuotaView,
  type FamilyAttachmentUploadIntentResponse,
  type FamilyRole,
} from '@lumi/contracts';
import type { AttachmentObjectStorePort } from './objectStore.ts';
import type { FamilyAttachmentQuotaLedger } from './quotaLedger.ts';

export type AttachmentIntentRecord = {
  readonly intentId: string;
  readonly familyId: string;
  readonly appUserId: string;
  readonly attachmentId: string;
  readonly childId: string;
  readonly eventId: string;
  readonly role: AttachmentRenditionRole;
  readonly expectedBytes: number;
  readonly expectedSha256: string;
  readonly objectKey: string;
  readonly expiresAtMs: number;
  uploaded: boolean;
  finalized: boolean;
};

export type AttachmentMembership = {
  readonly active: boolean;
  readonly role: FamilyRole | null;
};

type CreateIntentInput = {
  readonly familyId: string;
  readonly appUserId: string;
  readonly membership: AttachmentMembership;
  readonly attachmentId: string;
  readonly childId: string;
  readonly eventId: string;
  readonly role: AttachmentRenditionRole;
  readonly expectedBytes: number;
  readonly expectedSha256: string;
  readonly nowMs: number;
  readonly idempotencyKey: string;
};

/**
 * Family photo upload/finalize/read/tombstone orchestration. Personal mode
 * never requires this service — local sealed blobs stay enough offline.
 */
export function createFamilyAttachmentService(input: {
  readonly objects: AttachmentObjectStorePort;
  readonly quota: FamilyAttachmentQuotaLedger;
}) {
  const intents = new Map<string, AttachmentIntentRecord>();
  const idempotency = new Map<string, string>();
  const activatedKeys = new Map<string, { familyId: string; attachmentId: string; role: AttachmentRenditionRole; objectKey: string; byteLength: number; sha256: string }>();

  function authorize(
    membership: AttachmentMembership,
    action: 'upload' | 'read' | 'finalize' | 'tombstone',
  ) {
    return authorizeFamilyAttachmentAction({
      membershipActive: membership.active,
      role: membership.role,
      action,
    });
  }

  return {
    quotaView(familyId: string): FamilyAttachmentQuotaView {
      return input.quota.view(familyId);
    },

    async createIntent(
      create: CreateIntentInput,
    ): Promise<
      | { ok: true; response: FamilyAttachmentUploadIntentResponse }
      | { ok: false; code: 'forbidden' | 'validation' | 'conflict'; message: string; details?: Record<string, string | number | boolean | null> }
    > {
      const gate = authorize(create.membership, 'upload');
      if (!gate.allow) {
        return { ok: false, code: 'forbidden', message: 'Attachment upload is not allowed' };
      }
      if (create.role === 'display' && create.expectedBytes > FAMILY_ATTACHMENT_QUOTA.displayMaxBytes) {
        return { ok: false, code: 'validation', message: 'Display rendition exceeds size limit' };
      }
      if (
        create.role === 'thumbnail' &&
        create.expectedBytes > FAMILY_ATTACHMENT_QUOTA.thumbnailMaxBytes
      ) {
        return { ok: false, code: 'validation', message: 'Thumbnail exceeds size limit' };
      }
      if (!/^[a-f0-9]{64}$/i.test(create.expectedSha256)) {
        return { ok: false, code: 'validation', message: 'SHA-256 digest is required' };
      }

      const idemKey = `${create.familyId}:${create.appUserId}:${create.idempotencyKey}`;
      const existingIntentId = idempotency.get(idemKey);
      if (existingIntentId) {
        const existing = intents.get(existingIntentId);
        if (existing && !existing.finalized && existing.expiresAtMs > create.nowMs) {
          return {
            ok: true,
            response: {
              protocolVersion: LUMI_API_PROTOCOL_VERSION,
              intentId: existing.intentId,
              familyId: existing.familyId,
              attachmentId: existing.attachmentId,
              role: existing.role,
              reservedBytes: existing.expectedBytes,
              expiresAt: new Date(existing.expiresAtMs).toISOString(),
              objectKey: existing.objectKey,
            },
          };
        }
      }

      const reserved = await input.quota.reserve(create.familyId, create.expectedBytes);
      if (!reserved.ok) {
        return {
          ok: false,
          code: 'conflict',
          message: 'Family photo quota cannot reserve this upload',
          details: { reason: reserved.reason },
        };
      }

      const intentId = randomUUID();
      const objectKey = `fam/${create.familyId}/att/${create.attachmentId}/${create.role}/${intentId}`;
      const record: AttachmentIntentRecord = {
        intentId,
        familyId: create.familyId,
        appUserId: create.appUserId,
        attachmentId: create.attachmentId,
        childId: create.childId,
        eventId: create.eventId,
        role: create.role,
        expectedBytes: create.expectedBytes,
        expectedSha256: create.expectedSha256.toLowerCase(),
        objectKey,
        expiresAtMs: create.nowMs + FAMILY_ATTACHMENT_QUOTA.intentTtlMs,
        uploaded: false,
        finalized: false,
      };
      intents.set(intentId, record);
      idempotency.set(idemKey, intentId);
      return {
        ok: true,
        response: {
          protocolVersion: LUMI_API_PROTOCOL_VERSION,
          intentId,
          familyId: create.familyId,
          attachmentId: create.attachmentId,
          role: create.role,
          reservedBytes: create.expectedBytes,
          expiresAt: new Date(record.expiresAtMs).toISOString(),
          objectKey,
        },
      };
    },

    async uploadBytes(inputUpload: {
      readonly intentId: string;
      readonly appUserId: string;
      readonly membership: AttachmentMembership;
      readonly bytes: Uint8Array;
      readonly nowMs: number;
    }): Promise<
      | { ok: true }
      | { ok: false; code: 'forbidden' | 'not_found' | 'validation' | 'conflict'; message: string }
    > {
      const gate = authorize(inputUpload.membership, 'upload');
      if (!gate.allow) {
        return { ok: false, code: 'forbidden', message: 'Attachment upload is not allowed' };
      }
      const intent = intents.get(inputUpload.intentId);
      if (!intent || intent.appUserId !== inputUpload.appUserId) {
        return { ok: false, code: 'not_found', message: 'Upload intent was not found' };
      }
      if (intent.expiresAtMs <= inputUpload.nowMs) {
        await input.quota.releaseReservation(intent.familyId, intent.expectedBytes);
        intents.delete(intent.intentId);
        await input.objects.deleteStaging(intent.objectKey);
        return { ok: false, code: 'conflict', message: 'Upload intent expired' };
      }
      if (inputUpload.bytes.byteLength !== intent.expectedBytes) {
        return { ok: false, code: 'validation', message: 'Uploaded byte length does not match intent' };
      }
      const put = await input.objects.putStaging({
        objectKey: intent.objectKey,
        familyId: intent.familyId,
        attachmentId: intent.attachmentId,
        role: intent.role,
        bytes: inputUpload.bytes,
        expectedSha256: intent.expectedSha256,
      });
      if (!put.ok) {
        return { ok: false, code: 'validation', message: `Upload rejected: ${put.reason}` };
      }
      intent.uploaded = true;
      return { ok: true };
    },

    async finalize(inputFinalize: {
      readonly intentId: string;
      readonly appUserId: string;
      readonly membership: AttachmentMembership;
      readonly sha256: string;
      readonly byteLength: number;
      readonly nowMs: number;
    }): Promise<
      | { ok: true; response: FamilyAttachmentFinalizeResponse }
      | { ok: false; code: 'forbidden' | 'not_found' | 'validation' | 'conflict'; message: string }
    > {
      const gate = authorize(inputFinalize.membership, 'finalize');
      if (!gate.allow) {
        return { ok: false, code: 'forbidden', message: 'Attachment finalize is not allowed' };
      }
      const intent = intents.get(inputFinalize.intentId);
      if (!intent || intent.appUserId !== inputFinalize.appUserId) {
        return { ok: false, code: 'not_found', message: 'Upload intent was not found' };
      }
      if (intent.finalized) {
        return {
          ok: true,
          response: {
            protocolVersion: LUMI_API_PROTOCOL_VERSION,
            attachmentId: intent.attachmentId,
            role: intent.role,
            objectKey: intent.objectKey,
            activated: true,
          },
        };
      }
      if (!intent.uploaded) {
        return { ok: false, code: 'conflict', message: 'Upload must complete before finalize' };
      }
      if (intent.expiresAtMs <= inputFinalize.nowMs) {
        return { ok: false, code: 'conflict', message: 'Upload intent expired' };
      }
      if (
        inputFinalize.byteLength !== intent.expectedBytes ||
        inputFinalize.sha256.toLowerCase() !== intent.expectedSha256
      ) {
        return { ok: false, code: 'validation', message: 'Finalize digest does not match intent' };
      }
      const activated = await input.objects.activate(intent.objectKey);
      if (!activated) {
        return { ok: false, code: 'conflict', message: 'Staged object could not be activated' };
      }
      await input.quota.commitReservation(intent.familyId, intent.expectedBytes);
      intent.finalized = true;
      activatedKeys.set(`${intent.familyId}:${intent.attachmentId}:${intent.role}`, {
        familyId: intent.familyId,
        attachmentId: intent.attachmentId,
        role: intent.role,
        objectKey: intent.objectKey,
        byteLength: intent.expectedBytes,
        sha256: intent.expectedSha256,
      });
      return {
        ok: true,
        response: {
          protocolVersion: LUMI_API_PROTOCOL_VERSION,
          attachmentId: intent.attachmentId,
          role: intent.role,
          objectKey: intent.objectKey,
          activated: true,
        },
      };
    },

    async read(inputRead: {
      readonly familyId: string;
      readonly attachmentId: string;
      readonly role: AttachmentRenditionRole;
      readonly membership: AttachmentMembership;
    }) {
      const gate = authorize(inputRead.membership, 'read');
      if (!gate.allow) {
        return { ok: false as const, code: 'forbidden' as const, message: 'Attachment read is not allowed' };
      }
      const meta = activatedKeys.get(
        `${inputRead.familyId}:${inputRead.attachmentId}:${inputRead.role}`,
      );
      if (!meta) {
        return { ok: false as const, code: 'not_found' as const, message: 'Attachment was not found' };
      }
      const object = await input.objects.readActivated(meta.objectKey);
      if (!object || object.familyId !== inputRead.familyId) {
        return { ok: false as const, code: 'not_found' as const, message: 'Attachment was not found' };
      }
      return {
        ok: true as const,
        meta: {
          protocolVersion: LUMI_API_PROTOCOL_VERSION,
          attachmentId: object.attachmentId,
          role: object.role,
          contentType: 'image/jpeg' as const,
          byteLength: object.bytes.byteLength,
          sha256: object.sha256,
        },
        bytes: object.bytes,
      };
    },

    async tombstone(inputTomb: {
      readonly familyId: string;
      readonly attachmentId: string;
      readonly membership: AttachmentMembership;
      readonly eraseGeneration: number;
    }) {
      const gate = authorize(inputTomb.membership, 'tombstone');
      if (!gate.allow) {
        return { ok: false as const, code: 'forbidden' as const, message: 'Attachment erase is not allowed' };
      }
      void inputTomb.eraseGeneration;
      const removed = await input.objects.tombstoneByAttachment({
        familyId: inputTomb.familyId,
        attachmentId: inputTomb.attachmentId,
      });
      for (const role of ['display', 'thumbnail'] as const) {
        const key = `${inputTomb.familyId}:${inputTomb.attachmentId}:${role}`;
        const meta = activatedKeys.get(key);
        if (meta) {
          await input.quota.releaseUsed(inputTomb.familyId, meta.byteLength);
          activatedKeys.delete(key);
        }
      }
      return { ok: true as const, removed };
    },

    async cleanupExpiredIntents(nowMs: number): Promise<number> {
      let cleaned = 0;
      for (const [intentId, intent] of intents) {
        if (intent.finalized) continue;
        if (intent.expiresAtMs > nowMs) continue;
        await input.quota.releaseReservation(intent.familyId, intent.expectedBytes);
        await input.objects.deleteStaging(intent.objectKey);
        intents.delete(intentId);
        cleaned += 1;
      }
      return cleaned;
    },
  };
}

export type FamilyAttachmentService = ReturnType<typeof createFamilyAttachmentService>;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
