import type { FamilyAttachmentTransferPort } from './familyAttachmentTransferPort';
import {
  applyTransferJobState,
  buildAttachmentMetadataOutboxPayload,
  selectTransferJobsToStart,
  shouldEnqueueFamilyPhotoTransfers,
  type FamilyPhotoBlobTransferJob,
  type FamilyPhotoTransferSession,
} from './familyPhotoTransferPlanner';
import type { PhotoAttachment } from './types';

/** Metadata-only diary outbox row built after a successful blob upload. */
export type FamilyPhotoUploadMetadataOutbox = ReturnType<
  typeof buildAttachmentMetadataOutboxPayload
>;

export type FamilyPhotoTransferTickResult = {
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly started: number;
  readonly succeeded: number;
  readonly quotaHeld: number;
  /** True when the tick stayed local because family transfer is off. */
  readonly personalCold: boolean;
  /**
   * attachment.upsert rows for attachments whose upload finalized this tick
   * (one per attachment). Callers enqueue them on the diary outbox so peers
   * receive metadata after bytes are activated server-side.
   */
  readonly metadataOutbox: readonly FamilyPhotoUploadMetadataOutbox[];
};

/**
 * One bounded transfer tick against the authenticated attachment API.
 * JPEG bytes never travel through diary sync JSON — only this path.
 */
export async function runFamilyPhotoTransferTick(input: {
  readonly session: FamilyPhotoTransferSession;
  readonly jobs: readonly FamilyPhotoBlobTransferJob[];
  readonly resolveAttachment: (attachmentId: string) => PhotoAttachment | null;
  readonly readLocalBytes: (job: FamilyPhotoBlobTransferJob) => Promise<Uint8Array | null>;
  readonly writeDownloadedBytes: (
    job: FamilyPhotoBlobTransferJob,
    bytes: Uint8Array,
  ) => Promise<void>;
  readonly port: FamilyAttachmentTransferPort;
  readonly quotaBlockedAttachmentIds?: ReadonlySet<string> | undefined;
  /** Optional hook fired once per successfully finalized upload job. */
  readonly onUploadSucceeded?:
    | ((outbox: FamilyPhotoUploadMetadataOutbox, job: FamilyPhotoBlobTransferJob) => void | Promise<void>)
    | undefined;
}): Promise<FamilyPhotoTransferTickResult> {
  if (!shouldEnqueueFamilyPhotoTransfers(input.session)) {
    return {
      jobs: input.jobs,
      started: 0,
      succeeded: 0,
      quotaHeld: 0,
      personalCold: true,
      metadataOutbox: [],
    };
  }

  const familyId = input.session.activeFamilyId!;
  const selection = selectTransferJobsToStart({
    jobs: input.jobs,
    quotaBlockedAttachmentIds: input.quotaBlockedAttachmentIds,
  });

  const updates = new Map<
    string,
    Partial<Pick<FamilyPhotoBlobTransferJob, 'state' | 'attemptCount' | 'lastErrorCode'>>
  >();
  for (const jobId of selection.holdAsQuotaWaitingIds) {
    updates.set(jobId, { state: 'quota_waiting', lastErrorCode: 'quota' });
  }
  for (const jobId of selection.startJobIds) {
    const current = input.jobs.find((row) => row.jobId === jobId);
    updates.set(jobId, {
      state: 'in_flight',
      attemptCount: (current?.attemptCount ?? 0) + 1,
      lastErrorCode: null,
    });
  }

  let jobs = applyTransferJobState(input.jobs, updates);
  let succeeded = 0;
  const metadataByAttachment = new Map<string, FamilyPhotoUploadMetadataOutbox>();

  for (const jobId of selection.startJobIds) {
    const job = jobs.find((row) => row.jobId === jobId);
    if (!job || job.familyId !== familyId) {
      jobs = applyTransferJobState(
        jobs,
        new Map([[jobId, { state: 'isolated', lastErrorCode: 'session_changed' }]]),
      );
      continue;
    }

    if (job.kind === 'upload') {
      const outcome = await runUpload({
        job,
        familyId,
        resolveAttachment: input.resolveAttachment,
        readLocalBytes: input.readLocalBytes,
        port: input.port,
      });
      jobs = applyTransferJobState(jobs, new Map([[jobId, outcome]]));
      if (outcome.state === 'succeeded') {
        succeeded += 1;
        const attachment = input.resolveAttachment(job.attachmentId);
        if (attachment && attachment.deletedAtMs == null) {
          const outbox = buildAttachmentMetadataOutboxPayload({ attachment });
          metadataByAttachment.set(job.attachmentId, outbox);
          await input.onUploadSucceeded?.(outbox, job);
        }
      }
      continue;
    }

    const outcome = await runDownload({
      job,
      familyId,
      writeDownloadedBytes: input.writeDownloadedBytes,
      port: input.port,
    });
    jobs = applyTransferJobState(jobs, new Map([[jobId, outcome]]));
    if (outcome.state === 'succeeded') succeeded += 1;
  }

  return {
    jobs,
    started: selection.startJobIds.length,
    succeeded,
    quotaHeld: selection.holdAsQuotaWaitingIds.length,
    personalCold: false,
    metadataOutbox: [...metadataByAttachment.values()],
  };
}

async function runUpload(input: {
  readonly job: FamilyPhotoBlobTransferJob;
  readonly familyId: string;
  readonly resolveAttachment: (attachmentId: string) => PhotoAttachment | null;
  readonly readLocalBytes: (job: FamilyPhotoBlobTransferJob) => Promise<Uint8Array | null>;
  readonly port: FamilyAttachmentTransferPort;
}): Promise<Partial<Pick<FamilyPhotoBlobTransferJob, 'state' | 'attemptCount' | 'lastErrorCode'>>> {
  const attachment = input.resolveAttachment(input.job.attachmentId);
  if (!attachment || attachment.deletedAtMs != null) {
    return { state: 'failed', lastErrorCode: 'attachment_missing' };
  }
  const bytes = await input.readLocalBytes(input.job);
  if (!bytes || bytes.byteLength !== input.job.byteLength) {
    return { state: 'failed', lastErrorCode: 'local_bytes_missing' };
  }

  const intent = await input.port.createUploadIntent({
    familyId: input.familyId,
    idempotencyKey: input.job.jobId,
    attachmentId: input.job.attachmentId,
    childId: attachment.childId,
    eventId: attachment.eventId,
    role: input.job.role,
    expectedBytes: input.job.byteLength,
    expectedSha256: input.job.sha256,
  });
  if (!intent.ok) {
    if (intent.code === 'quota') {
      return { state: 'quota_waiting', lastErrorCode: 'quota' };
    }
    if (intent.code === 'network') {
      return { state: 'queued', lastErrorCode: 'network' };
    }
    if (intent.code === 'not_configured') {
      return { state: 'isolated', lastErrorCode: 'not_configured' };
    }
    return { state: 'failed', lastErrorCode: intent.code };
  }

  const uploaded = await input.port.uploadRenditionBytes({
    familyId: input.familyId,
    intentId: intent.value.intentId,
    bytes,
  });
  if (!uploaded.ok) {
    if (uploaded.code === 'network') {
      return { state: 'queued', lastErrorCode: 'network' };
    }
    if (uploaded.code === 'quota') {
      return { state: 'quota_waiting', lastErrorCode: 'quota' };
    }
    return { state: 'failed', lastErrorCode: uploaded.code };
  }

  const finalized = await input.port.finalizeUpload({
    familyId: input.familyId,
    intentId: intent.value.intentId,
    sha256: input.job.sha256,
    byteLength: input.job.byteLength,
  });
  if (!finalized.ok) {
    if (finalized.code === 'network') {
      return { state: 'queued', lastErrorCode: 'network' };
    }
    return { state: 'failed', lastErrorCode: finalized.code };
  }
  return { state: 'succeeded', lastErrorCode: null };
}

async function runDownload(input: {
  readonly job: FamilyPhotoBlobTransferJob;
  readonly familyId: string;
  readonly writeDownloadedBytes: (
    job: FamilyPhotoBlobTransferJob,
    bytes: Uint8Array,
  ) => Promise<void>;
  readonly port: FamilyAttachmentTransferPort;
}): Promise<Partial<Pick<FamilyPhotoBlobTransferJob, 'state' | 'attemptCount' | 'lastErrorCode'>>> {
  const read = await input.port.readRendition({
    familyId: input.familyId,
    attachmentId: input.job.attachmentId,
    role: input.job.role,
  });
  if (!read.ok) {
    if (read.code === 'network') {
      return { state: 'queued', lastErrorCode: 'network' };
    }
    if (read.code === 'not_configured') {
      return { state: 'isolated', lastErrorCode: 'not_configured' };
    }
    return { state: 'failed', lastErrorCode: read.code };
  }
  if (
    read.value.sha256.toLowerCase() !== input.job.sha256.toLowerCase() ||
    read.value.byteLength !== input.job.byteLength
  ) {
    return { state: 'failed', lastErrorCode: 'digest_mismatch' };
  }
  await input.writeDownloadedBytes(input.job, read.value.bytes);
  return { state: 'succeeded', lastErrorCode: null };
}
