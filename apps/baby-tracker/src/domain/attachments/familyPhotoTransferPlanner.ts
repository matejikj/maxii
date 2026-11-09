import { ATTACHMENT_LIMITS } from './limits';
import { presentFamilyPhotoTransferLabel, type FamilyPhotoTransferLabel } from './familyTransfer';
import type { PhotoAttachment, RenditionRole } from './types';

export type FamilyPhotoBlobTransferKind = 'upload' | 'download';

export type FamilyPhotoBlobTransferState =
  | 'queued'
  | 'in_flight'
  | 'quota_waiting'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'isolated';

/**
 * Durable blob transfer job. Metadata sync stays on the diary outbox; JPEG
 * bytes use the authenticated attachment API and never embed into sync JSON.
 */
export type FamilyPhotoBlobTransferJob = {
  readonly jobId: string;
  readonly familyId: string;
  readonly attachmentId: string;
  readonly renditionId: string;
  readonly role: RenditionRole;
  readonly kind: FamilyPhotoBlobTransferKind;
  readonly sha256: string;
  readonly byteLength: number;
  readonly state: FamilyPhotoBlobTransferState;
  readonly attemptCount: number;
  readonly lastErrorCode: string | null;
};

export type FamilyPhotoTransferSession = {
  readonly familySyncConfigured: boolean;
  readonly activeFamilyId: string | null;
  readonly appUserId: string | null;
};

/**
 * Personal builds never open family photo transfers. Local durable copies stay
 * enough without an account or API URL.
 */
export function shouldEnqueueFamilyPhotoTransfers(
  session: FamilyPhotoTransferSession,
): boolean {
  return (
    session.familySyncConfigured &&
    session.activeFamilyId != null &&
    session.appUserId != null
  );
}

export function buildAttachmentMetadataOutboxPayload(input: {
  readonly attachment: PhotoAttachment;
  readonly eraseGeneration?: number | null;
}): {
  readonly commandType: 'attachment.upsert' | 'attachment.tombstone';
  readonly entityId: string;
  readonly payload: {
    readonly attachmentId: string;
    readonly childId: string;
    readonly eventId: string;
    readonly hostEventType: PhotoAttachment['hostEventType'];
    readonly orderIndex: number;
    readonly caption: string | null;
    readonly deletedAt: string | null;
    readonly eraseGeneration: number | null;
    readonly renditions: readonly {
      readonly renditionId: string;
      readonly role: RenditionRole;
      readonly mime: 'image/jpeg';
      readonly width: number;
      readonly height: number;
      readonly byteLength: number;
      readonly sha256: string;
      readonly normalizationVersion: string;
    }[];
  };
} {
  const deleted = input.attachment.deletedAtMs != null;
  return {
    commandType: deleted ? 'attachment.tombstone' : 'attachment.upsert',
    entityId: input.attachment.attachmentId,
    payload: {
      attachmentId: input.attachment.attachmentId,
      childId: input.attachment.childId,
      eventId: input.attachment.eventId,
      hostEventType: input.attachment.hostEventType,
      orderIndex: input.attachment.orderIndex,
      caption: input.attachment.caption,
      deletedAt:
        input.attachment.deletedAtMs == null
          ? null
          : new Date(input.attachment.deletedAtMs).toISOString(),
      eraseGeneration: input.eraseGeneration ?? null,
      renditions: input.attachment.renditions.map((row) => ({
        renditionId: row.renditionId,
        role: row.role,
        mime: row.mime,
        width: row.width,
        height: row.height,
        byteLength: row.byteLength,
        sha256: row.sha256,
        normalizationVersion: row.normalizationVersion,
      })),
    },
  };
}

/**
 * Queue upload jobs for durable local renditions that are not yet remote.
 * Metadata can already be on the wire while bytes wait for capacity.
 */
export function planUploadJobsForLocalAttachments(input: {
  readonly session: FamilyPhotoTransferSession;
  readonly attachments: readonly PhotoAttachment[];
  readonly existingJobs: readonly FamilyPhotoBlobTransferJob[];
  readonly createJobId: (seed: string) => string;
}): readonly FamilyPhotoBlobTransferJob[] {
  if (!shouldEnqueueFamilyPhotoTransfers(input.session)) return [];
  const familyId = input.session.activeFamilyId!;
  const existingKeys = new Set(
    input.existingJobs
      .filter((job) => job.kind === 'upload' && job.state !== 'cancelled' && job.state !== 'isolated')
      .map((job) => `${job.attachmentId}:${job.renditionId}`),
  );
  const next: FamilyPhotoBlobTransferJob[] = [];
  for (const attachment of input.attachments) {
    if (attachment.deletedAtMs != null) continue;
    for (const rendition of attachment.renditions) {
      if (rendition.availability !== 'durable') continue;
      const key = `${attachment.attachmentId}:${rendition.renditionId}`;
      if (existingKeys.has(key)) continue;
      next.push({
        jobId: input.createJobId(`up_${key}`),
        familyId,
        attachmentId: attachment.attachmentId,
        renditionId: rendition.renditionId,
        role: rendition.role,
        kind: 'upload',
        sha256: rendition.sha256,
        byteLength: rendition.byteLength,
        state: 'queued',
        attemptCount: 0,
        lastErrorCode: null,
      });
    }
  }
  return next;
}

/**
 * Remote metadata without local bytes becomes a download job and a truthful
 * missing label — the care text remains usable meanwhile.
 */
export function planDownloadJobsForRemoteMetadata(input: {
  readonly session: FamilyPhotoTransferSession;
  readonly remoteAttachments: readonly PhotoAttachment[];
  readonly localAttachments: readonly PhotoAttachment[];
  readonly existingJobs: readonly FamilyPhotoBlobTransferJob[];
  readonly createJobId: (seed: string) => string;
}): {
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly placeholders: readonly PhotoAttachment[];
} {
  if (!shouldEnqueueFamilyPhotoTransfers(input.session)) {
    return { jobs: [], placeholders: [] };
  }
  const familyId = input.session.activeFamilyId!;
  const localById = new Map(input.localAttachments.map((row) => [row.attachmentId, row]));
  const existingKeys = new Set(
    input.existingJobs
      .filter((job) => job.kind === 'download' && job.state !== 'cancelled' && job.state !== 'isolated')
      .map((job) => `${job.attachmentId}:${job.renditionId}`),
  );
  const jobs: FamilyPhotoBlobTransferJob[] = [];
  const placeholders: PhotoAttachment[] = [];

  for (const remote of input.remoteAttachments) {
    if (remote.deletedAtMs != null) continue;
    const local = localById.get(remote.attachmentId);
    const needsPlaceholder = !local;
    const base: PhotoAttachment = local
      ? local
      : {
          ...remote,
          renditions: remote.renditions.map((row) => ({
            ...row,
            availability: 'missing' as const,
            blobKey: `missing:${row.renditionId}`,
          })),
        };
    if (needsPlaceholder) placeholders.push(base);

    for (const rendition of base.renditions) {
      const localRendition = local?.renditions.find((row) => row.renditionId === rendition.renditionId);
      const hasBytes =
        localRendition?.availability === 'durable' ||
        localRendition?.availability === 'cache' ||
        localRendition?.availability === 'pending';
      if (hasBytes) continue;
      const key = `${remote.attachmentId}:${rendition.renditionId}`;
      if (existingKeys.has(key)) continue;
      jobs.push({
        jobId: input.createJobId(`dl_${key}`),
        familyId,
        attachmentId: remote.attachmentId,
        renditionId: rendition.renditionId,
        role: rendition.role,
        kind: 'download',
        sha256: rendition.sha256,
        byteLength: rendition.byteLength,
        state: 'queued',
        attemptCount: 0,
        lastErrorCode: null,
      });
    }
  }
  return { jobs, placeholders };
}

/**
 * Start at most two transfers. Quota-blocked uploads stay queued locally and
 * never delete the durable photo while waiting for remote capacity.
 */
export function selectTransferJobsToStart(input: {
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly quotaBlockedAttachmentIds?: ReadonlySet<string>;
  readonly maxConcurrent?: number;
}): {
  readonly startJobIds: readonly string[];
  readonly holdAsQuotaWaitingIds: readonly string[];
} {
  const max = input.maxConcurrent ?? ATTACHMENT_LIMITS.maxConcurrentTransfers;
  const inFlight = input.jobs.filter((job) => job.state === 'in_flight').length;
  const slots = Math.max(0, max - inFlight);
  const startJobIds: string[] = [];
  const holdAsQuotaWaitingIds: string[] = [];
  for (const job of input.jobs) {
    if (job.state !== 'queued') continue;
    if (job.kind === 'upload' && input.quotaBlockedAttachmentIds?.has(job.attachmentId)) {
      holdAsQuotaWaitingIds.push(job.jobId);
      continue;
    }
    if (startJobIds.length >= slots) break;
    startJobIds.push(job.jobId);
  }
  return { startJobIds, holdAsQuotaWaitingIds };
}

export function applyTransferJobState(
  jobs: readonly FamilyPhotoBlobTransferJob[],
  updates: ReadonlyMap<string, Partial<Pick<FamilyPhotoBlobTransferJob, 'state' | 'attemptCount' | 'lastErrorCode'>>>,
): readonly FamilyPhotoBlobTransferJob[] {
  return jobs.map((job) => {
    const patch = updates.get(job.jobId);
    if (!patch) return job;
    return { ...job, ...patch };
  });
}

/**
 * Logout, family switch, or revoke must not silently delete local durable
 * photos or continue uploading into another family context.
 */
export function isolateTransfersOnSessionChange(input: {
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly previousFamilyId: string | null;
  readonly nextSession: FamilyPhotoTransferSession;
}): {
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly preservedLocalDurable: true;
} {
  const nextFamily = input.nextSession.activeFamilyId;
  const keepFamilyTransfers =
    shouldEnqueueFamilyPhotoTransfers(input.nextSession) &&
    nextFamily != null &&
    nextFamily === input.previousFamilyId;

  if (keepFamilyTransfers) {
    return { jobs: input.jobs, preservedLocalDurable: true };
  }

  return {
    jobs: input.jobs.map((job) => {
      if (job.state === 'succeeded' || job.state === 'cancelled' || job.state === 'isolated') {
        return job;
      }
      return {
        ...job,
        state: 'isolated',
        lastErrorCode: 'session_changed',
      };
    }),
    preservedLocalDurable: true,
  };
}

export function cancelTransferJob(
  jobs: readonly FamilyPhotoBlobTransferJob[],
  jobId: string,
): readonly FamilyPhotoBlobTransferJob[] {
  return jobs.map((job) => {
    if (job.jobId !== jobId) return job;
    if (
      job.state === 'succeeded' ||
      job.state === 'cancelled' ||
      job.state === 'isolated'
    ) {
      return job;
    }
    return { ...job, state: 'cancelled' as const, lastErrorCode: 'user_cancelled' };
  });
}

export function labelForAttachmentTransfer(input: {
  readonly session: FamilyPhotoTransferSession;
  readonly attachment: PhotoAttachment;
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly remoteActivated: boolean;
}): FamilyPhotoTransferLabel {
  const attachmentJobs = input.jobs.filter(
    (job) => job.attachmentId === input.attachment.attachmentId,
  );
  const quotaBlocked = attachmentJobs.some((job) => job.state === 'quota_waiting');
  const uploadPending = attachmentJobs.some(
    (job) =>
      job.kind === 'upload' &&
      (job.state === 'queued' || job.state === 'in_flight' || job.state === 'quota_waiting'),
  );
  const downloadMissing = input.attachment.renditions.some(
    (row) => row.availability === 'missing',
  );
  const localDurable = input.attachment.renditions.some(
    (row) => row.availability === 'durable',
  );
  return presentFamilyPhotoTransferLabel({
    familySyncConfigured: shouldEnqueueFamilyPhotoTransfers(input.session),
    localDurable,
    remoteActivated: input.remoteActivated,
    uploadPending,
    quotaBlocked,
    downloadMissing,
  });
}
