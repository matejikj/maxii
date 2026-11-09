import {
  createDisabledFamilyAttachmentTransferPort,
  isolateTransfersOnSessionChange,
  labelForAttachmentTransfer,
  planUploadJobsForLocalAttachments,
  runFamilyPhotoTransferTick,
  shouldEnqueueFamilyPhotoTransfers,
  type FamilyAttachmentTransferPort,
  type FamilyPhotoBlobTransferJob,
  type FamilyPhotoTransferLabel,
  type FamilyPhotoTransferSession,
  type PhotoAttachment,
} from '../domain/attachments';

export type FamilyPhotoTransferRuntime = {
  readonly getSession: () => FamilyPhotoTransferSession;
  readonly getJobs: () => readonly FamilyPhotoBlobTransferJob[];
  readonly setSession: (session: FamilyPhotoTransferSession) => void;
  readonly enqueueLocalUploads: (attachments: readonly PhotoAttachment[]) => void;
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
 */
export function createFamilyPhotoTransferRuntime(input?: {
  readonly session?: FamilyPhotoTransferSession;
  readonly port?: FamilyAttachmentTransferPort;
  readonly createJobId?: (seed: string) => string;
}): FamilyPhotoTransferRuntime {
  let session: FamilyPhotoTransferSession = input?.session ?? {
    familySyncConfigured: false,
    activeFamilyId: null,
    appUserId: null,
  };
  let jobs: FamilyPhotoBlobTransferJob[] = [];
  const port = input?.port ?? createDisabledFamilyAttachmentTransferPort();
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
        port,
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
