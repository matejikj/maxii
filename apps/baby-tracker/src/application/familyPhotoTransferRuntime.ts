import {
  createDisabledFamilyAttachmentTransferPort,
  isolateTransfersOnSessionChange,
  labelForAttachmentTransfer,
  planDownloadJobsForRemoteMetadata,
  planThumbnailPrefetchJobs,
  planUploadJobsForLocalAttachments,
  runFamilyPhotoTransferTick,
  shouldEnqueueFamilyPhotoTransfers,
  type FamilyAttachmentTransferPort,
  type FamilyPhotoBlobTransferJob,
  type FamilyPhotoTransferLabel,
  type FamilyPhotoTransferSession,
  type PhotoAttachment,
  type RenditionRole,
  type ThumbnailPrefetchCandidate,
} from '../domain/attachments';

export type FamilyPhotoTransferRuntime = {
  readonly getSession: () => FamilyPhotoTransferSession;
  readonly getJobs: () => readonly FamilyPhotoBlobTransferJob[];
  readonly setSession: (session: FamilyPhotoTransferSession) => void;
  readonly enqueueLocalUploads: (attachments: readonly PhotoAttachment[]) => void;
  /**
   * Queue missing downloads for keep-offline or a conscious full-photo fetch.
   * Pass `roles: ['display']` for open/download-one; default is both roles.
   */
  readonly enqueueRemoteDownloads: (input: {
    readonly remoteAttachments: readonly PhotoAttachment[];
    readonly localAttachments: readonly PhotoAttachment[];
    readonly roles?: readonly RenditionRole[];
  }) => {
    readonly queued: number;
    readonly placeholders: readonly PhotoAttachment[];
  };
  /**
   * Prefetch recent thumbnails within the dedicated cache budget. Never queues
   * full display copies — those stay on open/pin/conscious download.
   */
  readonly enqueueThumbnailPrefetch: (input: {
    readonly candidates: readonly ThumbnailPrefetchCandidate[];
    readonly localAttachments: readonly PhotoAttachment[];
    readonly nowMs: number;
  }) => {
    readonly queued: number;
    readonly plannedBytes: number;
  };
  /** Replace the in-memory job list after cancel/isolation updates. */
  readonly replaceJobs: (next: readonly FamilyPhotoBlobTransferJob[]) => void;
  readonly labelFor: (input: {
    readonly attachment: PhotoAttachment;
    readonly remoteActivated?: boolean;
  }) => FamilyPhotoTransferLabel;
  readonly runTick: (input: {
    readonly resolveAttachment: (attachmentId: string) => PhotoAttachment | null;
    readonly readLocalBytes: (job: FamilyPhotoBlobTransferJob) => Promise<Uint8Array | null>;
    readonly writeDownloadedBytes: (
      job: FamilyPhotoBlobTransferJob,
      bytes: Uint8Array,
    ) => Promise<void>;
  }) => Promise<{
    readonly started: number;
    readonly succeeded: number;
    readonly personalCold: boolean;
  }>;
};

/**
 * In-process photo transfer queue. Personal mode keeps the disabled port and
 * never opens family uploads without an explicit sync session.
 *
 * `getPort` may change after login so the same runtime can switch from cold
 * personal mode to an authenticated HTTP client without rebuilding UI state.
 */
export function createFamilyPhotoTransferRuntime(input?: {
  readonly session?: FamilyPhotoTransferSession;
  readonly port?: FamilyAttachmentTransferPort;
  readonly getPort?: () => FamilyAttachmentTransferPort;
  readonly createJobId?: (seed: string) => string;
}): FamilyPhotoTransferRuntime {
  let session: FamilyPhotoTransferSession = input?.session ?? {
    familySyncConfigured: false,
    activeFamilyId: null,
    appUserId: null,
  };
  let jobs: FamilyPhotoBlobTransferJob[] = [];
  const fixedPort = input?.port;
  const getPort =
    input?.getPort ??
    (() => fixedPort ?? createDisabledFamilyAttachmentTransferPort());
  const createJobId = input?.createJobId ?? ((seed: string) => seed);

  return {
    getSession: () => session,
    getJobs: () => jobs,
    setSession(next) {
      const previousFamilyId = session.activeFamilyId;
      const isolated = isolateTransfersOnSessionChange({
        jobs,
        previousFamilyId,
        nextSession: next,
      });
      jobs = [...isolated.jobs];
      session = next;
    },
    enqueueLocalUploads(attachments) {
      if (!shouldEnqueueFamilyPhotoTransfers(session)) return;
      const created = planUploadJobsForLocalAttachments({
        session,
        attachments,
        existingJobs: jobs,
        createJobId,
      });
      if (created.length === 0) return;
      jobs = [...jobs, ...created];
    },
    enqueueRemoteDownloads({ remoteAttachments, localAttachments, roles }) {
      if (!shouldEnqueueFamilyPhotoTransfers(session)) {
        return { queued: 0, placeholders: [] };
      }
      const planned = planDownloadJobsForRemoteMetadata({
        session,
        remoteAttachments,
        localAttachments,
        existingJobs: jobs,
        createJobId,
        roles,
      });
      if (planned.jobs.length > 0) {
        jobs = [...jobs, ...planned.jobs];
      }
      return { queued: planned.jobs.length, placeholders: planned.placeholders };
    },
    enqueueThumbnailPrefetch({ candidates, localAttachments, nowMs }) {
      if (!shouldEnqueueFamilyPhotoTransfers(session)) {
        return { queued: 0, plannedBytes: 0 };
      }
      const planned = planThumbnailPrefetchJobs({
        session,
        candidates,
        localAttachments,
        existingJobs: jobs,
        createJobId,
        nowMs,
      });
      if (planned.jobs.length > 0) {
        jobs = [...jobs, ...planned.jobs];
      }
      return { queued: planned.jobs.length, plannedBytes: planned.plannedBytes };
    },
    replaceJobs(next) {
      jobs = [...next];
    },
    labelFor({ attachment, remoteActivated = false }) {
      return labelForAttachmentTransfer({
        session,
        attachment,
        jobs,
        remoteActivated,
      });
    },
    async runTick(tickInput) {
      const result = await runFamilyPhotoTransferTick({
        session,
        jobs,
        resolveAttachment: tickInput.resolveAttachment,
        readLocalBytes: tickInput.readLocalBytes,
        writeDownloadedBytes: tickInput.writeDownloadedBytes,
        port: getPort(),
      });
      jobs = [...result.jobs];
      return {
        started: result.started,
        succeeded: result.succeeded,
        personalCold: result.personalCold,
      };
    },
  };
}
