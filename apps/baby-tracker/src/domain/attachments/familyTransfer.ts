import { ATTACHMENT_LIMITS } from './limits';
import type { PhotoAttachment } from './types';

/**
 * Client-side labels for family photo transfer. Personal mode never claims
 * remote availability; offline work stays local until an explicit sync path.
 */
export type FamilyPhotoTransferLabel =
  | 'local_only'
  | 'waiting_to_send'
  | 'sending'
  | 'available_to_family'
  | 'missing_download'
  | 'quota_waiting';

export type FamilyPhotoConflictKind = 'over_max_photos' | 'caption_or_order';

/**
 * When two offline edits together exceed the per-event photo budget, keep both
 * valid branches for an explicit merge — never silently drop confirmed copies.
 */
export function detectFamilyPhotoCountConflict(input: {
  readonly localAttachments: readonly PhotoAttachment[];
  readonly remoteAttachments: readonly PhotoAttachment[];
}): { readonly conflict: false } | { readonly conflict: true; readonly kind: FamilyPhotoConflictKind; readonly total: number } {
  const ids = new Set<string>();
  for (const row of input.localAttachments) {
    if (row.deletedAtMs == null) ids.add(row.attachmentId);
  }
  for (const row of input.remoteAttachments) {
    if (row.deletedAtMs == null) ids.add(row.attachmentId);
  }
  if (ids.size > ATTACHMENT_LIMITS.maxPerEvent) {
    return { conflict: true, kind: 'over_max_photos', total: ids.size };
  }
  return { conflict: false };
}

/**
 * Present transfer state without inventing peer-to-peer delivery. Personal
 * builds stay on local_only until family sync is configured.
 */
export function presentFamilyPhotoTransferLabel(input: {
  readonly familySyncConfigured: boolean;
  readonly localDurable: boolean;
  readonly remoteActivated: boolean;
  readonly uploadPending: boolean;
  readonly quotaBlocked: boolean;
  readonly downloadMissing: boolean;
}): FamilyPhotoTransferLabel {
  if (!input.familySyncConfigured) return 'local_only';
  if (input.quotaBlocked) return 'quota_waiting';
  // Metadata can arrive before bytes — never claim family readiness locally.
  if (input.downloadMissing) return 'missing_download';
  if (input.remoteActivated) return 'available_to_family';
  if (input.uploadPending && input.localDurable) return 'waiting_to_send';
  if (input.uploadPending) return 'sending';
  if (input.localDurable) return 'local_only';
  return 'missing_download';
}
