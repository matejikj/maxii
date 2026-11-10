import {
  asAttachmentId,
  buildPhotoStorageInventory,
  decideSoleOwnCopyRelease,
  planRecoverableCacheEviction,
  presentPhotoStorageSummary,
  type AttachmentServices,
  type FamilyPhotoBlobTransferJob,
  type PhotoAttachment,
  type PhotoStorageInventory,
  type SoleOwnReleaseDecision,
} from '../domain/attachments';

export type PhotoStorageSnapshot = {
  readonly inventory: PhotoStorageInventory;
  readonly protectedLabel: string;
  readonly cacheLabel: string;
};

export type ClearRecoverablePhotoCacheResult = {
  readonly clearedBlobCount: number;
  readonly freedBytes: number;
  readonly inventory: PhotoStorageInventory;
  readonly protectedLabel: string;
  readonly cacheLabel: string;
};

export type ReleaseDurablePhotoCopyReason =
  | Extract<SoleOwnReleaseDecision, { allow: false }>['reason']
  | 'not_found'
  | 'not_own_import';

export type ReleaseDurablePhotoCopyResult =
  | {
      readonly ok: true;
      readonly attachment: PhotoAttachment;
      readonly releasedBlobCount: number;
    }
  | {
      readonly ok: false;
      readonly reason: ReleaseDurablePhotoCopyReason;
    };

function markRenditionMissing(
  attachment: PhotoAttachment,
  blobKeys: ReadonlySet<string>,
): PhotoAttachment {
  return {
    ...attachment,
    renditions: attachment.renditions.map((row) => {
      if (!blobKeys.has(row.blobKey)) return row;
      return {
        ...row,
        blobKey: `missing:${row.renditionId}`,
        availability: 'missing' as const,
      };
    }),
  };
}

/**
 * Read protected vs recoverable photo space for settings without touching blobs.
 */
export async function loadPhotoStorageSnapshot(input: {
  readonly attachments: AttachmentServices;
  readonly transferJobs?: readonly FamilyPhotoBlobTransferJob[] | undefined;
  readonly nowMs?: number | undefined;
}): Promise<PhotoStorageSnapshot> {
  const rows = await input.attachments.repository.listAll();
  const inventory = buildPhotoStorageInventory({
    attachments: rows,
    transferJobs: input.transferJobs,
    nowMs: input.nowMs,
  });
  return {
    inventory,
    ...presentPhotoStorageSummary(inventory),
  };
}

/**
 * Drop only recoverable cache sealed bytes. Own imports, upload-pending, and
 * keep-offline pins stay on device; diary text is untouched.
 */
export async function clearRecoverablePhotoCache(input: {
  readonly attachments: AttachmentServices;
  readonly transferJobs?: readonly FamilyPhotoBlobTransferJob[] | undefined;
  readonly nowMs?: number | undefined;
}): Promise<ClearRecoverablePhotoCacheResult> {
  const rows = await input.attachments.repository.listAll();
  const inventory = buildPhotoStorageInventory({
    attachments: rows,
    transferJobs: input.transferJobs,
    nowMs: input.nowMs,
  });
  // Zero budget asks LRU to list every cache copy while leaving protected kinds alone.
  const plan = planRecoverableCacheEviction({
    copies: inventory.copies,
    budgetBytes: 0,
  });
  if (!plan.ok) {
    return {
      clearedBlobCount: 0,
      freedBytes: 0,
      inventory,
      ...presentPhotoStorageSummary(inventory),
    };
  }

  const evictKeys = new Set(plan.evictBlobKeys);
  let freedBytes = 0;
  for (const copy of inventory.copies) {
    if (!evictKeys.has(copy.blobKey)) continue;
    freedBytes += copy.byteLength;
  }

  for (const blobKey of plan.evictBlobKeys) {
    await input.attachments.blobs.deleteDurable(blobKey);
  }

  for (const attachment of rows) {
    const touches = attachment.renditions.some((row) => evictKeys.has(row.blobKey));
    if (!touches) continue;
    await input.attachments.repository.save(markRenditionMissing(attachment, evictKeys));
  }

  const afterRows = await input.attachments.repository.listAll();
  const after = buildPhotoStorageInventory({
    attachments: afterRows,
    transferJobs: input.transferJobs,
    nowMs: input.nowMs,
  });
  return {
    clearedBlobCount: plan.evictBlobKeys.length,
    freedBytes,
    inventory: after,
    ...presentPhotoStorageSummary(after),
  };
}

/**
 * Conscious release of the only durable own-import copy. Never runs from LRU;
 * requires verified remote recovery plus an independent backup or full archive,
 * and an explicit offline-loss confirmation from the parent.
 */
export async function releaseDurableOwnPhotoCopy(input: {
  readonly attachmentId: string;
  readonly attachments: AttachmentServices;
  readonly remoteCopyVerified: boolean;
  readonly independentBackupConfirmed: boolean;
  readonly completePortableArchiveVerified: boolean;
  readonly userConfirmedOfflineLoss: boolean;
}): Promise<ReleaseDurablePhotoCopyResult> {
  const current = await input.attachments.repository.getById(
    asAttachmentId(input.attachmentId),
  );
  if (!current || current.deletedAtMs != null) {
    return { ok: false, reason: 'not_found' };
  }
  if (current.localOrigin === 'downloaded') {
    return { ok: false, reason: 'not_own_import' };
  }

  const durableKeys = current.renditions
    .filter((row) => row.availability === 'durable' || row.availability === 'pending')
    .map((row) => row.blobKey);
  if (durableKeys.length === 0) {
    return { ok: false, reason: 'not_sole_own_copy' };
  }

  const decision = decideSoleOwnCopyRelease({
    isSoleOwnCopy: true,
    remoteCopyVerified: input.remoteCopyVerified,
    independentBackupConfirmed: input.independentBackupConfirmed,
    completePortableArchiveVerified: input.completePortableArchiveVerified,
    userConfirmedOfflineLoss: input.userConfirmedOfflineLoss,
  });
  if (!decision.allow) {
    return { ok: false, reason: decision.reason };
  }

  const keySet = new Set(durableKeys);
  for (const blobKey of durableKeys) {
    await input.attachments.blobs.deleteDurable(blobKey);
  }
  const next = markRenditionMissing(current, keySet);
  // Releasing the durable own copy also clears a keep-offline pin that no longer
  // has local bytes to protect.
  const cleared: PhotoAttachment = { ...next, offlinePinned: false };
  await input.attachments.repository.save(cleared);
  return {
    ok: true,
    attachment: cleared,
    releasedBlobCount: durableKeys.length,
  };
}
