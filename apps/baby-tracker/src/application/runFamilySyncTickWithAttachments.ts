import {
  runSyncTick,
  type SyncTransportPort,
  type SyncWorkerResult,
} from '../domain/sync/worker';
import type { LocalSyncState } from '../domain/sync/transport';
import type { AttachmentServices } from '../domain/attachments';
import {
  applyRemoteAttachmentMetadata,
  attachmentEntriesFromSyncInbox,
  type ApplyRemoteAttachmentMetadataResult,
  type FamilyPhotoTransferDownloadQueue,
} from './applyRemoteAttachmentMetadata';

/**
 * One family sync tick that also materializes attachment metadata into local
 * placeholders and download jobs. Care payloads stay on the normal inbox path;
 * JPEG bytes never ride inside sync JSON.
 */
export async function runFamilySyncTickWithAttachments(input: {
  readonly state: LocalSyncState;
  readonly familyId: string;
  readonly transport: SyncTransportPort;
  readonly attemptId: string;
  readonly nowIso: string;
  readonly nowMs: number;
  readonly attachments: AttachmentServices;
  readonly transfer: FamilyPhotoTransferDownloadQueue;
  readonly erasedAttachmentIds?: ReadonlySet<string> | undefined;
  readonly afterDownloadsQueued?: () => Promise<void> | void;
}): Promise<{
  readonly sync: SyncWorkerResult;
  readonly attachments: ApplyRemoteAttachmentMetadataResult;
}> {
  const previousInboxIds = new Set(
    input.state.inbox.map((entry) => `${entry.changelogSeq}:${entry.operationId}`),
  );
  const sync = await runSyncTick({
    state: input.state,
    familyId: input.familyId,
    transport: input.transport,
    attemptId: input.attemptId,
    now: input.nowIso,
  });

  const fresh = sync.state.inbox.filter(
    (entry) => !previousInboxIds.has(`${entry.changelogSeq}:${entry.operationId}`),
  );
  const attachmentEntries = attachmentEntriesFromSyncInbox(
    fresh.map((entry) => ({
      kind: entry.kind,
      payload: entry.payload,
    })),
  );
  const applied = await applyRemoteAttachmentMetadata({
    entries: attachmentEntries,
    attachments: input.attachments,
    transfer: input.transfer,
    nowMs: input.nowMs,
    erasedAttachmentIds: input.erasedAttachmentIds,
  });
  if (applied.downloadJobsQueued > 0 && input.afterDownloadsQueued) {
    await input.afterDownloadsQueued();
  }
  return { sync, attachments: applied };
}
