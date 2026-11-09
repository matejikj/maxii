import { ATTACHMENT_LIMITS } from './limits';

/**
 * Local copy kinds for photo blobs. Only `cache` may be discarded by automatic
 * LRU — own imports, pending uploads, and explicit pins stay durable.
 */
export type LocalPhotoCopyKind = 'own' | 'pending' | 'pinned' | 'cache';

export type LocalPhotoCopyRecord = {
  readonly blobKey: string;
  readonly kind: LocalPhotoCopyKind;
  readonly byteLength: number;
  /** Last access for recoverable cache copies only. */
  readonly lastAccessMs: number;
};

export type CacheEvictionPlan =
  | { readonly ok: true; readonly evictBlobKeys: readonly string[]; readonly remainingCacheBytes: number }
  | { readonly ok: false; readonly reason: 'budget_exceeds_protected_copies' };

/**
 * Plan LRU eviction inside the recoverable cache budget. Protected kinds are
 * never listed for deletion, even when the device is low on space.
 */
export function planRecoverableCacheEviction(input: {
  readonly copies: readonly LocalPhotoCopyRecord[];
  readonly budgetBytes?: number;
}): CacheEvictionPlan {
  const budget = input.budgetBytes ?? ATTACHMENT_LIMITS.recoverableCacheBudgetBytes;
  // Own, pending, and pinned copies sit outside this budget and are never listed.

  const cacheCopies = input.copies
    .filter((row) => row.kind === 'cache')
    .slice()
    .sort((a, b) => a.lastAccessMs - b.lastAccessMs);

  let cacheBytes = cacheCopies.reduce((sum, row) => sum + row.byteLength, 0);
  const evictBlobKeys: string[] = [];
  for (const row of cacheCopies) {
    if (cacheBytes <= budget) break;
    evictBlobKeys.push(row.blobKey);
    cacheBytes -= row.byteLength;
  }

  if (cacheBytes > budget) {
    return { ok: false, reason: 'budget_exceeds_protected_copies' };
  }
  return { ok: true, evictBlobKeys, remainingCacheBytes: Math.max(0, cacheBytes) };
}

export type SoleOwnReleaseDecision =
  | { readonly allow: true }
  | {
      readonly allow: false;
      readonly reason:
        | 'not_sole_own_copy'
        | 'remote_unverified'
        | 'backup_unconfirmed'
        | 'user_not_confirmed';
    };

/**
 * Releasing the only durable own copy needs a verified remote object plus an
 * independent backup or complete portable archive — never silent automation.
 */
export function decideSoleOwnCopyRelease(input: {
  readonly isSoleOwnCopy: boolean;
  readonly remoteCopyVerified: boolean;
  readonly independentBackupConfirmed: boolean;
  readonly completePortableArchiveVerified: boolean;
  readonly userConfirmedOfflineLoss: boolean;
}): SoleOwnReleaseDecision {
  if (!input.isSoleOwnCopy) {
    return { allow: false, reason: 'not_sole_own_copy' };
  }
  if (!input.remoteCopyVerified) {
    return { allow: false, reason: 'remote_unverified' };
  }
  if (!input.independentBackupConfirmed && !input.completePortableArchiveVerified) {
    return { allow: false, reason: 'backup_unconfirmed' };
  }
  if (!input.userConfirmedOfflineLoss) {
    return { allow: false, reason: 'user_not_confirmed' };
  }
  return { allow: true };
}

export type PhotoExportCompleteness =
  | { readonly complete: true; readonly label: 'full_photo_backup' }
  | {
      readonly complete: false;
      readonly label: 'incomplete_photo_export';
      readonly missingAttachmentIds: readonly string[];
    };

/**
 * Partial exports stay usable for text recovery but must never claim a full
 * photographic backup state.
 */
export function classifyPhotoExportCompleteness(input: {
  readonly expectedAttachmentIds: readonly string[];
  readonly includedAttachmentIds: readonly string[];
}): PhotoExportCompleteness {
  const included = new Set(input.includedAttachmentIds);
  const missing = input.expectedAttachmentIds.filter((id) => !included.has(id));
  if (missing.length === 0) {
    return { complete: true, label: 'full_photo_backup' };
  }
  return {
    complete: false,
    label: 'incomplete_photo_export',
    missingAttachmentIds: missing,
  };
}
