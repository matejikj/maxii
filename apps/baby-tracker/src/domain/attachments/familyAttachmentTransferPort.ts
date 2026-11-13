import type { RenditionRole } from './types';

/**
 * Authenticated family attachment API. Personal mode uses the disabled
 * implementation so local diary work never requires a backend.
 */
export type FamilyAttachmentTransferResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code:
        | 'not_configured'
        | 'unauthorized'
        | 'forbidden'
        | 'not_found'
        | 'conflict'
        | 'validation'
        | 'quota'
        | 'network';
      readonly message: string;
    };

export type FamilyAttachmentUploadIntent = {
  readonly intentId: string;
  readonly objectKey: string;
  readonly expiresAt: string;
  readonly reservedBytes: number;
};

export type FamilyAttachmentTransferPort = {
  readonly getQuota: (input: { readonly familyId: string }) => Promise<
    FamilyAttachmentTransferResult<{
      readonly remainingBytes: number;
      readonly usedBytes: number;
      readonly reservedBytes: number;
      readonly budgetBytes: number;
    }>
  >;
  readonly createUploadIntent: (input: {
    readonly familyId: string;
    readonly idempotencyKey: string;
    readonly attachmentId: string;
    readonly childId: string;
    readonly eventId: string;
    readonly role: RenditionRole;
    readonly expectedBytes: number;
    readonly expectedSha256: string;
  }) => Promise<FamilyAttachmentTransferResult<FamilyAttachmentUploadIntent>>;
  readonly uploadRenditionBytes: (input: {
    readonly familyId: string;
    readonly intentId: string;
    readonly bytes: Uint8Array;
  }) => Promise<FamilyAttachmentTransferResult<{ readonly ok: true }>>;
  readonly finalizeUpload: (input: {
    readonly familyId: string;
    readonly intentId: string;
    readonly sha256: string;
    readonly byteLength: number;
  }) => Promise<FamilyAttachmentTransferResult<{ readonly activated: true }>>;
  readonly readRendition: (input: {
    readonly familyId: string;
    readonly attachmentId: string;
    readonly role: RenditionRole;
  }) => Promise<
    FamilyAttachmentTransferResult<{
      readonly bytes: Uint8Array;
      readonly sha256: string;
      readonly byteLength: number;
    }>
  >;
};

/** No remote calls — keeps personal builds offline-capable. */
export function createDisabledFamilyAttachmentTransferPort(): FamilyAttachmentTransferPort {
  const blocked = async <T>(): Promise<FamilyAttachmentTransferResult<T>> => ({
    ok: false,
    code: 'not_configured',
    message: 'Family photo transfer is not configured in personal mode.',
  });
  return {
    getQuota: () => blocked(),
    createUploadIntent: () => blocked(),
    uploadRenditionBytes: () => blocked(),
    finalizeUpload: () => blocked(),
    readRendition: () => blocked(),
  };
}
