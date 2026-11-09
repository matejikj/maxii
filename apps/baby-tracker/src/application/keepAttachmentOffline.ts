import {
  asAttachmentId,
  planOfflinePinChange,
  presentOfflinePinReadiness,
  type AttachmentServices,
  type FamilyPhotoBlobTransferJob,
  type FamilyPhotoTransferSession,
  type OfflinePinReadiness,
  type PhotoAttachment,
} from '../domain/attachments';

export type KeepAttachmentOfflineResult = {
  readonly attachment: PhotoAttachment;
  readonly readiness: OfflinePinReadiness;
  readonly downloadJobsQueued: number;
  readonly personalColdDownloadsSkipped: boolean;
};

export type FamilyPhotoTransferPinQueue = {
  readonly getSession: () => FamilyPhotoTransferSession;
  readonly getJobs: () => readonly FamilyPhotoBlobTransferJob[];
  readonly enqueueRemoteDownloads: (input: {
    readonly remoteAttachments: readonly PhotoAttachment[];
    readonly localAttachments: readonly PhotoAttachment[];
  }) => {
    readonly queued: number;
    readonly placeholders: readonly PhotoAttachment[];
  };
};

/**
 * Applies the parent "keep offline" intent. Already-local copies are pinned
 * immediately; missing bytes enqueue downloads only when family transfer is on.
 * Clearing the pin never deletes sealed bytes by itself.
 */
export async function setAttachmentOfflinePin(input: {
  readonly attachmentId: string;
  readonly pinned: boolean;
  readonly attachments: AttachmentServices;
  readonly transfer?: FamilyPhotoTransferPinQueue | null;
}): Promise<KeepAttachmentOfflineResult | null> {
  const current = await input.attachments.repository.getById(
    asAttachmentId(input.attachmentId),
  );
  if (!current || current.deletedAtMs != null) return null;

  const existingJobs = input.transfer?.getJobs() ?? [];
  const planned = planOfflinePinChange({
    attachment: current,
    pinned: input.pinned,
    existingJobs,
  });
  await input.attachments.repository.save(planned.attachment);

  let downloadJobsQueued = 0;
  let personalColdDownloadsSkipped = false;
  if (
    input.pinned &&
    (planned.needsDisplayDownload || planned.needsThumbnailDownload)
  ) {
    const transfer = input.transfer;
    if (!transfer || !transfer.getSession().familySyncConfigured) {
      personalColdDownloadsSkipped = true;
    } else {
      const queued = transfer.enqueueRemoteDownloads({
        remoteAttachments: [planned.attachment],
        localAttachments: [planned.attachment],
      });
      downloadJobsQueued = queued.queued;
    }
  }

  const readiness = presentOfflinePinReadiness({
    offlinePinned: planned.attachment.offlinePinned,
    hasDurableDisplay: planned.attachment.renditions.some(
      (row) => row.role === 'display' && row.availability === 'durable',
    ),
    downloadInFlightOrQueued:
      downloadJobsQueued > 0 ||
      planned.readiness.kind === 'pending',
  });

  return {
    attachment: planned.attachment,
    readiness,
    downloadJobsQueued,
    personalColdDownloadsSkipped,
  };
}
