/**
 * Family photo attachment wire shapes. Normalized JPEG renditions only —
 * picker originals never leave the device. Object keys stay opaque.
 */

export const FAMILY_ATTACHMENT_QUOTA = {
  /** Default remote budget for one family (primary copies + thumbs + trash + intents). */
  familyBudgetBytes: 1 * 1024 * 1024 * 1024,
  /** Pending upload reservations counted inside the family budget. */
  pendingReservationBudgetBytes: 64 * 1024 * 1024,
  /** Inactive intents older than this are cleaned without activating objects. */
  intentTtlMs: 24 * 60 * 60 * 1000,
  maxPerEvent: 6,
  displayMaxBytes: 3 * 1024 * 1024,
  thumbnailMaxBytes: 160 * 1024,
} as const;

export type AttachmentRenditionRole = 'display' | 'thumbnail';

export type FamilyAttachmentUploadIntentRequest = {
  readonly protocolVersion: number;
  readonly idempotencyKey: string;
  readonly attachmentId: string;
  readonly childId: string;
  readonly eventId: string;
  readonly role: AttachmentRenditionRole;
  readonly expectedBytes: number;
  readonly expectedSha256: string;
  readonly contentType: 'image/jpeg';
};

export type FamilyAttachmentUploadIntentResponse = {
  readonly protocolVersion: number;
  readonly intentId: string;
  readonly familyId: string;
  readonly attachmentId: string;
  readonly role: AttachmentRenditionRole;
  readonly reservedBytes: number;
  readonly expiresAt: string;
  /** Opaque object key — never a public CDN URL. */
  readonly objectKey: string;
};

export type FamilyAttachmentFinalizeRequest = {
  readonly protocolVersion: number;
  readonly intentId: string;
  readonly sha256: string;
  readonly byteLength: number;
};

export type FamilyAttachmentFinalizeResponse = {
  readonly protocolVersion: number;
  readonly attachmentId: string;
  readonly role: AttachmentRenditionRole;
  readonly objectKey: string;
  readonly activated: true;
};

export type FamilyAttachmentReadResponse = {
  readonly protocolVersion: number;
  readonly attachmentId: string;
  readonly role: AttachmentRenditionRole;
  readonly contentType: 'image/jpeg';
  readonly byteLength: number;
  readonly sha256: string;
};

export type FamilyAttachmentTombstoneRequest = {
  readonly protocolVersion: number;
  readonly attachmentId: string;
  readonly eraseGeneration: number;
};

export type FamilyAttachmentQuotaView = {
  readonly familyId: string;
  readonly budgetBytes: number;
  readonly usedBytes: number;
  readonly reservedBytes: number;
  readonly remainingBytes: number;
};

/**
 * Atomically decide whether a reservation fits. Callers must apply the result
 * under the same lock that reads used/reserved — never a plain check-then-write.
 */
export function planFamilyAttachmentReservation(input: {
  readonly budgetBytes: number;
  readonly usedBytes: number;
  readonly reservedBytes: number;
  readonly pendingReservationBudgetBytes: number;
  readonly requestBytes: number;
}):
  | { readonly ok: true; readonly nextReservedBytes: number }
  | { readonly ok: false; readonly reason: 'quota_exceeded' | 'pending_budget_exceeded' | 'invalid_size' } {
  if (!Number.isFinite(input.requestBytes) || input.requestBytes <= 0) {
    return { ok: false, reason: 'invalid_size' };
  }
  if (input.reservedBytes + input.requestBytes > input.pendingReservationBudgetBytes) {
    return { ok: false, reason: 'pending_budget_exceeded' };
  }
  if (input.usedBytes + input.reservedBytes + input.requestBytes > input.budgetBytes) {
    return { ok: false, reason: 'quota_exceeded' };
  }
  return { ok: true, nextReservedBytes: input.reservedBytes + input.requestBytes };
}

/** Own / pending / pinned copies must never be treated as disposable LRU cache. */
export function isDisposableAttachmentCopy(kind: 'own' | 'pending' | 'pinned' | 'cache'): boolean {
  return kind === 'cache';
}

/**
 * Caregivers may upload/read for records they can already access. Admins manage
 * family-wide erase; membership alone never opens another family's objects.
 */
export function authorizeFamilyAttachmentAction(input: {
  readonly membershipActive: boolean;
  readonly role: 'admin' | 'caregiver' | null;
  readonly action: 'upload' | 'read' | 'finalize' | 'tombstone';
}): { readonly allow: true } | { readonly allow: false; readonly reason: 'not_member' | 'role_denied' } {
  if (!input.membershipActive || input.role == null) {
    return { allow: false, reason: 'not_member' };
  }
  if (input.action === 'tombstone' && input.role !== 'admin') {
    return { allow: false, reason: 'role_denied' };
  }
  return { allow: true };
}
