import {
  asAttachmentId,
  attachmentTrashRetainUntilMs,
  buildAttachmentMetadataOutboxPayload,
  planAttachmentPayloadPurge,
  type AttachmentServices,
  type FamilyPhotoBlobTransferJob,
  type PhotoAttachment,
} from '../domain/attachments';

export type SoftDeletePhotoAttachmentResult = {
  readonly attachment: PhotoAttachment;
  readonly cancelledJobIds: readonly string[];
  /** Ready for the diary outbox when family sync is configured. */
  readonly metadataOutbox: ReturnType<typeof buildAttachmentMetadataOutboxPayload>;
};

export type RestorePhotoAttachmentResult =
  | { readonly ok: true; readonly attachment: PhotoAttachment }
  | {
      readonly ok: false;
      readonly reason: 'not_found' | 'not_deleted' | 'retention_expired';
    };

export type PurgeExpiredPhotoPayloadsResult = {
  readonly purgedAttachmentIds: readonly string[];
  readonly skipped: readonly { readonly attachmentId: string; readonly reason: string }[];
};

/**
 * Cancel open blob transfers for a photo that entered trash. Succeeded and
 * already-cancelled jobs stay untouched so late acks cannot revive work.
 */
export function cancelTransferJobsForAttachment(
  jobs: readonly FamilyPhotoBlobTransferJob[],
  attachmentId: string,
): {
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly cancelledJobIds: readonly string[];
} {
  const cancelledJobIds: string[] = [];
  const next = jobs.map((job) => {
    if (job.attachmentId !== attachmentId) return job;
    if (job.state === 'succeeded' || job.state === 'cancelled' || job.state === 'isolated') {
      return job;
    }
    cancelledJobIds.push(job.jobId);
    return {
      ...job,
      state: 'cancelled' as const,
      lastErrorCode: 'attachment_soft_deleted',
    };
  });
  return { jobs: next, cancelledJobIds };
}

/**
 * Soft-delete a saved photo into the seven-day trash. Sealed bytes stay until
 * retention ends so Undo can restore; this is not a family-wide wipe.
 */
export async function softDeletePhotoAttachment(input: {
  readonly attachmentId: string;
  readonly attachments: AttachmentServices;
  readonly nowMs: number;
  readonly transferJobs?: readonly FamilyPhotoBlobTransferJob[];
  readonly replaceTransferJobs?: (next: readonly FamilyPhotoBlobTransferJob[]) => void;
}): Promise<SoftDeletePhotoAttachmentResult | null> {
  const current = await input.attachments.repository.getById(asAttachmentId(input.attachmentId));
  if (!current || current.deletedAtMs != null) return null;

  const deletedAtMs = input.nowMs;
  const retainUntilMs = attachmentTrashRetainUntilMs(deletedAtMs);
  await input.attachments.repository.softDelete({
    attachmentId: current.attachmentId,
    deletedAtMs,
    retainUntilMs,
  });
  const deleted: PhotoAttachment = {
    ...current,
    deletedAtMs,
    retainUntilMs,
  };

  const cancelled = cancelTransferJobsForAttachment(input.transferJobs ?? [], current.attachmentId);
  if (cancelled.cancelledJobIds.length > 0) {
    input.replaceTransferJobs?.(cancelled.jobs);
  }

  return {
    attachment: deleted,
    cancelledJobIds: cancelled.cancelledJobIds,
    metadataOutbox: buildAttachmentMetadataOutboxPayload({ attachment: deleted }),
  };
}

/**
 * Restore a soft-deleted photo while the trash window is open. After retention
 * expires the parent must re-import; late restore cannot revive purged bytes.
 */
export async function restorePhotoAttachment(input: {
  readonly attachmentId: string;
  readonly attachments: AttachmentServices;
  readonly nowMs: number;
}): Promise<RestorePhotoAttachmentResult> {
  const current = await input.attachments.repository.getById(asAttachmentId(input.attachmentId));
  if (!current) return { ok: false, reason: 'not_found' };
  if (current.deletedAtMs == null) return { ok: false, reason: 'not_deleted' };
  const retainUntil = current.retainUntilMs ?? attachmentTrashRetainUntilMs(current.deletedAtMs);
  if (input.nowMs >= retainUntil) {
    return { ok: false, reason: 'retention_expired' };
  }
  const restored: PhotoAttachment = {
    ...current,
    deletedAtMs: null,
    retainUntilMs: null,
  };
  await input.attachments.repository.save(restored);
  return { ok: true, attachment: restored };
}

/**
 * After trash retention, drop sealed local copies while keeping a metadata
 * tombstone so retries and old dumps cannot resurrect the photo.
 */
export async function purgeExpiredPhotoPayloads(input: {
  readonly attachments: AttachmentServices;
  readonly nowMs: number;
  readonly transferJobs?: readonly FamilyPhotoBlobTransferJob[];
  readonly referencedByCheckpointIds?: ReadonlySet<string>;
  readonly referencedByConflictIds?: ReadonlySet<string>;
}): Promise<PurgeExpiredPhotoPayloadsResult> {
  const softDeleted = await input.attachments.repository.listSoftDeleted();
  const activeJobIds = new Set(
    (input.transferJobs ?? [])
      .filter(
        (job) =>
          job.state === 'queued' || job.state === 'in_flight' || job.state === 'quota_waiting',
      )
      .map((job) => job.attachmentId),
  );
  const purgedAttachmentIds: string[] = [];
  const skipped: Array<{ attachmentId: string; reason: string }> = [];

  for (const row of softDeleted) {
    const decision = planAttachmentPayloadPurge({
      attachmentId: row.attachmentId,
      deletedAtMs: row.deletedAtMs,
      retainUntilMs: row.retainUntilMs,
      referencedByCheckpoint: input.referencedByCheckpointIds?.has(row.attachmentId) === true,
      referencedByConflict: input.referencedByConflictIds?.has(row.attachmentId) === true,
      hasActiveTransferJob: activeJobIds.has(row.attachmentId),
      localCopyKinds: [],
      nowMs: input.nowMs,
    });
    if (!decision.purge) {
      skipped.push({ attachmentId: row.attachmentId, reason: decision.reason });
      continue;
    }
    for (const rendition of row.renditions) {
      if (rendition.availability === 'missing') continue;
      if (rendition.blobKey.startsWith('missing:')) continue;
      await input.attachments.blobs.deleteDurable(rendition.blobKey);
    }
    const tombstone: PhotoAttachment = {
      ...row,
      renditions: row.renditions.map((rendition) => ({
        ...rendition,
        blobKey: `missing:${rendition.renditionId}`,
        availability: 'missing' as const,
      })),
    };
    await input.attachments.repository.save(tombstone);
    purgedAttachmentIds.push(row.attachmentId);
  }

  return { purgedAttachmentIds, skipped };
}
