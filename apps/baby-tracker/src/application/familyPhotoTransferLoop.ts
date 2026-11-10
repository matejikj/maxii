import type {
  AttachmentServices,
  PhotoAttachment,
} from '../domain/attachments';
import { asAttachmentId } from '../domain/attachments';
import type { FamilyPhotoUploadMetadataOutbox } from '../domain/attachments';
import type { FamilyPhotoTransferRuntime } from './familyPhotoTransferRuntime';

export type FamilyPhotoTransferLoopResult = {
  readonly started: number;
  readonly succeeded: number;
  readonly personalCold: boolean;
  /** attachment.upsert rows produced by uploads that finalized this tick. */
  readonly metadataOutbox?: readonly FamilyPhotoUploadMetadataOutbox[];
};

/** Enqueue diary outbox rows after bytes are activated on the family API. */
export type FamilyPhotoMetadataOutboxSink = (
  rows: readonly FamilyPhotoUploadMetadataOutbox[],
) => void | Promise<void>;

export type FamilyPhotoTransferLoop = {
  /** One bounded tick — no-op when family transfer session is cold. */
  readonly runOnce: () => Promise<FamilyPhotoTransferLoopResult>;
  readonly start: (intervalMs?: number) => void;
  readonly stop: () => void;
  readonly isRunning: () => boolean;
};

const DEFAULT_INTERVAL_MS = 15_000;

/**
 * Runs one transfer tick against durable local blobs. Prefetches attachment
 * metadata so the domain worker stays synchronous on resolveAttachment.
 */
export async function runFamilyPhotoTransferTickWithStore(input: {
  readonly runtime: FamilyPhotoTransferRuntime;
  readonly attachments: AttachmentServices;
  readonly onMetadataOutbox?: FamilyPhotoMetadataOutboxSink | undefined;
}): Promise<FamilyPhotoTransferLoopResult> {
  const jobs = input.runtime.getJobs();
  const cache = new Map<string, PhotoAttachment | null>();
  await Promise.all(
    [...new Set(jobs.map((job) => job.attachmentId))].map(async (attachmentId) => {
      const row = await input.attachments.repository.getById(asAttachmentId(attachmentId));
      cache.set(attachmentId, row);
    }),
  );

  const result = await input.runtime.runTick({
    resolveAttachment: (attachmentId) => cache.get(attachmentId) ?? null,
    readLocalBytes: async (job) => {
      const attachment = cache.get(job.attachmentId) ?? null;
      const rendition = attachment?.renditions.find((row) => row.renditionId === job.renditionId);
      if (!rendition) return null;
      try {
        return await input.attachments.blobs.readDurable({
          blobKey: rendition.blobKey,
          aad: rendition.blobKey,
        });
      } catch {
        return null;
      }
    },
    writeDownloadedBytes: async (job, bytes) => {
      const attachment = cache.get(job.attachmentId) ?? null;
      const existing = attachment?.renditions.find((row) => row.renditionId === job.renditionId);
      const blobKey =
        existing?.blobKey ?? `att/${job.attachmentId}/${job.role}.jpe.sealed`;
      await input.attachments.blobs.writeDurable({
        blobKey,
        bytes,
        aad: blobKey,
      });
      if (!attachment) return;
      // Mark the local copy durable so offline opens do not look missing.
      const nextRenditions = attachment.renditions.map((row) =>
        row.renditionId === job.renditionId
          ? {
              ...row,
              blobKey,
              availability: 'durable' as const,
              byteLength: bytes.byteLength,
              sha256: job.sha256,
            }
          : row,
      );
      const saved: PhotoAttachment = { ...attachment, renditions: nextRenditions };
      await input.attachments.repository.save(saved);
      cache.set(job.attachmentId, saved);
    },
  });
  if (result.metadataOutbox.length > 0) {
    await input.onMetadataOutbox?.(result.metadataOutbox);
  }
  return result;
}

/**
 * Periodic bridge from the transfer runtime to sealed local blobs. Personal
 * installs may construct it; ticks stay cold until sync + login + family.
 */
export function createFamilyPhotoTransferLoop(input: {
  readonly runtime: FamilyPhotoTransferRuntime;
  readonly attachments: AttachmentServices;
  readonly onMetadataOutbox?: FamilyPhotoMetadataOutboxSink | undefined;
  readonly setIntervalFn?: typeof setInterval;
  readonly clearIntervalFn?: typeof clearInterval;
}): FamilyPhotoTransferLoop {
  const setIntervalFn = input.setIntervalFn ?? setInterval;
  const clearIntervalFn = input.clearIntervalFn ?? clearInterval;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const loop: FamilyPhotoTransferLoop = {
    async runOnce() {
      if (inFlight) {
        return { started: 0, succeeded: 0, personalCold: true };
      }
      inFlight = true;
      try {
        return await runFamilyPhotoTransferTickWithStore({
          runtime: input.runtime,
          attachments: input.attachments,
          onMetadataOutbox: input.onMetadataOutbox,
        });
      } finally {
        inFlight = false;
      }
    },

    start(intervalMs = DEFAULT_INTERVAL_MS) {
      if (timer != null) return;
      const delay = Math.max(1_000, intervalMs);
      // Kick once immediately so queued uploads do not wait a full interval.
      void loop.runOnce();
      timer = setIntervalFn(() => {
        void loop.runOnce();
      }, delay);
    },

    stop() {
      if (timer == null) return;
      clearIntervalFn(timer);
      timer = null;
    },

    isRunning() {
      return timer != null;
    },
  };

  return loop;
}
