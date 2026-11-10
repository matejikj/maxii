import {
  asAttachmentId,
  attachmentNeedsConsciousDisplayDownload,
  planConsciousDisplayDownload,
  type AttachmentServices,
  type FamilyPhotoBlobTransferJob,
  type FamilyPhotoTransferSession,
  type PhotoAttachment,
} from '../domain/attachments';

export type RequestAttachmentDisplayDownloadResult =
  | {
      readonly ok: true;
      readonly attachment: PhotoAttachment;
      readonly downloadJobsQueued: number;
      readonly outcome: 'queued' | 'already_local' | 'personal_cold' | 'deleted' | 'already_queued';
    }
  | {
      readonly ok: false;
      readonly attachment: null;
      readonly downloadJobsQueued: 0;
      readonly outcome: 'not_found';
    };

export type FamilyPhotoTransferDisplayQueue = {
  readonly getSession: () => FamilyPhotoTransferSession;
  readonly getJobs: () => readonly FamilyPhotoBlobTransferJob[];
  readonly enqueueRemoteDownloads: (input: {
    readonly remoteAttachments: readonly PhotoAttachment[];
    readonly localAttachments: readonly PhotoAttachment[];
    readonly roles?: readonly ('display' | 'thumbnail')[];
  }) => {
    readonly queued: number;
    readonly placeholders: readonly PhotoAttachment[];
  };
};

/**
 * Parent opened a photo that is not local yet. Queue only the display rendition
 * for this one attachment — never the rest of the family album.
 */
export async function requestAttachmentDisplayDownload(input: {
  readonly attachmentId: string;
  readonly attachments: AttachmentServices;
  readonly transfer?: FamilyPhotoTransferDisplayQueue | null;
}): Promise<RequestAttachmentDisplayDownloadResult> {
  const current = await input.attachments.repository.getById(
    asAttachmentId(input.attachmentId),
  );
  if (!current) {
    return {
      ok: false,
      attachment: null,
      downloadJobsQueued: 0,
      outcome: 'not_found',
    };
  }
  if (current.deletedAtMs != null) {
    return {
      ok: true,
      attachment: current,
      downloadJobsQueued: 0,
      outcome: 'deleted',
    };
  }

  const transfer = input.transfer;
  if (!transfer) {
    return {
      ok: true,
      attachment: current,
      downloadJobsQueued: 0,
      outcome: attachmentNeedsConsciousDisplayDownload(current)
        ? 'personal_cold'
        : 'already_local',
    };
  }

  const planned = planConsciousDisplayDownload({
    session: transfer.getSession(),
    attachment: current,
    existingJobs: transfer.getJobs(),
    createJobId: (seed) => seed,
  });
  if (planned.outcome !== 'queued') {
    return {
      ok: true,
      attachment: current,
      downloadJobsQueued: 0,
      outcome: planned.outcome,
    };
  }

  const queued = transfer.enqueueRemoteDownloads({
    remoteAttachments: [current],
    localAttachments: [current],
    roles: ['display'],
  });
  return {
    ok: true,
    attachment: current,
    downloadJobsQueued: queued.queued,
    outcome: queued.queued > 0 ? 'queued' : 'already_queued',
  };
}
