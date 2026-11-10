import {
  classifyLocalPhotoCopyKind,
  summarizeProtectedOfflineBytes,
} from './offlinePin';
import type { LocalPhotoCopyRecord } from './attachmentCachePolicy';
import type { FamilyPhotoBlobTransferJob } from './familyPhotoTransferPlanner';
import type { PhotoAttachment } from './types';

export type PhotoStorageInventory = {
  readonly copies: readonly LocalPhotoCopyRecord[];
  readonly protectedBytes: number;
  readonly cacheBytes: number;
  readonly cacheCopyCount: number;
  readonly protectedCopyCount: number;
};

/**
 * Build the local sealed-blob inventory used by cache cleanup and space labels.
 * Upload-pending and pinned/own rows stay protected; family downloads without a
 * pin count as recoverable cache.
 */
export function buildPhotoStorageInventory(input: {
  readonly attachments: readonly PhotoAttachment[];
  readonly transferJobs?: readonly FamilyPhotoBlobTransferJob[] | undefined;
  readonly nowMs?: number | undefined;
}): PhotoStorageInventory {
  const nowMs = input.nowMs ?? 0;
  const uploadPendingIds = new Set(
    (input.transferJobs ?? [])
      .filter(
        (job) =>
          job.kind === 'upload' &&
          (job.state === 'queued' ||
            job.state === 'in_flight' ||
            job.state === 'quota_waiting'),
      )
      .map((job) => job.attachmentId),
  );

  const copies: LocalPhotoCopyRecord[] = [];
  for (const attachment of input.attachments) {
    if (attachment.deletedAtMs != null) continue;
    for (const rendition of attachment.renditions) {
      const kind = classifyLocalPhotoCopyKind({
        offlinePinned: attachment.offlinePinned === true,
        ownImport: attachment.localOrigin !== 'downloaded',
        uploadPending: uploadPendingIds.has(attachment.attachmentId),
        availability: rendition.availability,
      });
      if (!kind) continue;
      copies.push({
        blobKey: rendition.blobKey,
        kind,
        byteLength: rendition.byteLength,
        lastAccessMs: nowMs,
      });
    }
  }

  const summary = summarizeProtectedOfflineBytes(copies);
  return {
    copies,
    protectedBytes: summary.protectedBytes,
    cacheBytes: summary.cacheBytes,
    cacheCopyCount: copies.filter((row) => row.kind === 'cache').length,
    protectedCopyCount: copies.filter((row) => row.kind !== 'cache').length,
  };
}

export function presentPhotoStorageSummary(inventory: PhotoStorageInventory): {
  readonly protectedLabel: string;
  readonly cacheLabel: string;
} {
  return {
    protectedLabel: `Trvalé / připnuté fotky: ${formatMiB(inventory.protectedBytes)}`,
    cacheLabel: `Obnovitelná cache: ${formatMiB(inventory.cacheBytes)}`,
  };
}

function formatMiB(bytes: number): string {
  if (bytes <= 0) return '0 MiB';
  const mib = bytes / (1024 * 1024);
  if (mib < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MiB`;
}
