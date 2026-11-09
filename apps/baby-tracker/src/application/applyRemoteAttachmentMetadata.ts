import {
  attachmentTrashRetainUntilMs,
  cancelTransferJob,
  mergeRemoteAttachmentMetadata,
  parseRemoteAttachmentMetadataEntries,
  photoAttachmentFromRemoteMetadata,
  shouldEnqueueFamilyPhotoTransfers,
  type AttachmentServices,
  type FamilyPhotoBlobTransferJob,
  type FamilyPhotoTransferSession,
  type PhotoAttachment,
  type RemoteAttachmentMetadataEntry,
} from '../domain/attachments';
import { asAttachmentId } from '../domain/attachments';

export type ApplyRemoteAttachmentMetadataResult = {
  readonly appliedUpserts: number;
  readonly appliedTombstones: number;
  readonly rejected: number;
  readonly downloadJobsQueued: number;
  readonly placeholdersSaved: number;
  /** Personal/cold sessions leave family photo metadata unapplied. */
  readonly personalCold: boolean;
};

export type FamilyPhotoTransferDownloadQueue = {
  readonly getSession: () => FamilyPhotoTransferSession;
  readonly getJobs: () => readonly FamilyPhotoBlobTransferJob[];
  readonly enqueueRemoteDownloads: (input: {
    readonly remoteAttachments: readonly PhotoAttachment[];
    readonly localAttachments: readonly PhotoAttachment[];
  }) => {
    readonly queued: number;
    readonly placeholders: readonly PhotoAttachment[];
  };
  readonly replaceJobs: (jobs: readonly FamilyPhotoBlobTransferJob[]) => void;
};

/**
 * Applies attachment.upsert / attachment.tombstone metadata pulled over family
 * sync. Creates missing placeholders and queues downloads without embedding
 * JPEG bytes in the inbox payload.
 */
export async function applyRemoteAttachmentMetadata(input: {
  readonly entries: readonly RemoteAttachmentMetadataEntry[];
  readonly attachments: AttachmentServices;
  readonly transfer: FamilyPhotoTransferDownloadQueue;
  readonly nowMs: number;
  readonly erasedAttachmentIds?: ReadonlySet<string>;
}): Promise<ApplyRemoteAttachmentMetadataResult> {
  const parsed = parseRemoteAttachmentMetadataEntries(input.entries);
  const session = input.transfer.getSession();
  const personalCold = !shouldEnqueueFamilyPhotoTransfers(session);
  if (personalCold) {
    return {
      appliedUpserts: 0,
      appliedTombstones: 0,
      rejected: parsed.rejected,
      downloadJobsQueued: 0,
      placeholdersSaved: 0,
      personalCold: true,
    };
  }

  let appliedUpserts = 0;
  let appliedTombstones = 0;
  let placeholdersSaved = 0;
  let downloadJobsQueued = 0;

  for (const payload of parsed.tombstones) {
    if (input.erasedAttachmentIds?.has(payload.attachmentId)) {
      appliedTombstones += 1;
      continue;
    }
    const existing = await input.attachments.repository.getById(
      asAttachmentId(payload.attachmentId),
    );
    const deletedAtMs =
      payload.deletedAt != null && Number.isFinite(Date.parse(payload.deletedAt))
        ? Date.parse(payload.deletedAt)
        : input.nowMs;
    if (existing) {
      await input.attachments.repository.softDelete({
        attachmentId: existing.attachmentId,
        deletedAtMs,
        retainUntilMs: attachmentTrashRetainUntilMs(deletedAtMs),
      });
    } else {
      const placeholder = photoAttachmentFromRemoteMetadata({
        ...payload,
        deletedAt: new Date(deletedAtMs).toISOString(),
      });
      await input.attachments.repository.save({
        ...placeholder,
        deletedAtMs,
        retainUntilMs: attachmentTrashRetainUntilMs(deletedAtMs),
      });
    }
    let jobs = input.transfer.getJobs();
    for (const job of input.transfer.getJobs()) {
      if (job.attachmentId === payload.attachmentId) {
        jobs = cancelTransferJob(jobs, job.jobId);
      }
    }
    input.transfer.replaceJobs(jobs);
    appliedTombstones += 1;
  }

  const remoteLive: PhotoAttachment[] = [];
  const localForPlan: PhotoAttachment[] = [];

  for (const payload of parsed.upserts) {
    if (input.erasedAttachmentIds?.has(payload.attachmentId)) {
      // Newer erase wins — do not resurrect the photo from stale metadata.
      continue;
    }
    const remote = photoAttachmentFromRemoteMetadata(payload);
    const local = await input.attachments.repository.getById(remote.attachmentId);
    const merged = mergeRemoteAttachmentMetadata({ remote, local });
    await input.attachments.repository.save(merged);
    appliedUpserts += 1;
    remoteLive.push(remote);
    localForPlan.push(merged);
    if (!local) placeholdersSaved += 1;
  }

  if (remoteLive.length > 0) {
    const queued = input.transfer.enqueueRemoteDownloads({
      remoteAttachments: remoteLive,
      localAttachments: localForPlan,
    });
    downloadJobsQueued = queued.queued;
    for (const placeholder of queued.placeholders) {
      const current = await input.attachments.repository.getById(placeholder.attachmentId);
      if (!current) {
        await input.attachments.repository.save(placeholder);
        placeholdersSaved += 1;
      }
    }
  }

  return {
    appliedUpserts,
    appliedTombstones,
    rejected: parsed.rejected,
    downloadJobsQueued,
    placeholdersSaved,
    personalCold: false,
  };
}

/**
 * Map a sync inbox page into attachment metadata entries. Unknown kinds are
 * ignored so care/profile ops can share the same pull stream.
 */
export function attachmentEntriesFromSyncInbox(
  entries: readonly {
    readonly kind: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }[],
): RemoteAttachmentMetadataEntry[] {
  const next: RemoteAttachmentMetadataEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === 'attachment.upsert' || entry.kind === 'attachment.tombstone') {
      next.push({ kind: entry.kind, payload: entry.payload });
    }
  }
  return next;
}
