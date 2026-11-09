import type { FamilyPhotoBlobTransferJob } from './familyPhotoTransferPlanner';
import type { LocalPhotoCopyKind, LocalPhotoCopyRecord } from './attachmentCachePolicy';
import type { PhotoAttachment, RenditionRole } from './types';

export type OfflinePinReadiness =
  | { readonly kind: 'unpinned'; readonly label: null }
  | {
      readonly kind: 'pending';
      readonly label: 'Uchováváme offline — fotka se stahuje';
    }
  | { readonly kind: 'ready'; readonly label: 'Uloženo offline v tomto zařízení' };

/**
 * Pin toggle is intent, not proof. Ready only after a durable display copy is
 * present on this device.
 */
export function presentOfflinePinReadiness(input: {
  readonly offlinePinned: boolean;
  readonly hasDurableDisplay: boolean;
  readonly downloadInFlightOrQueued: boolean;
}): OfflinePinReadiness {
  if (!input.offlinePinned) return { kind: 'unpinned', label: null };
  if (input.hasDurableDisplay) {
    return { kind: 'ready', label: 'Uloženo offline v tomto zařízení' };
  }
  return {
    kind: 'pending',
    label: 'Uchováváme offline — fotka se stahuje',
  };
}

export function attachmentHasDurableRole(
  attachment: PhotoAttachment,
  role: RenditionRole = 'display',
): boolean {
  return attachment.renditions.some(
    (row) => row.role === role && row.availability === 'durable',
  );
}

export function attachmentHasDownloadWork(
  attachmentId: string,
  jobs: readonly FamilyPhotoBlobTransferJob[],
): boolean {
  return jobs.some(
    (job) =>
      job.attachmentId === attachmentId &&
      job.kind === 'download' &&
      (job.state === 'queued' ||
        job.state === 'in_flight' ||
        job.state === 'quota_waiting'),
  );
}

/**
 * Turning pin on promotes cache display copies to durable and asks for download
 * jobs when bytes are still missing. Unpin only clears the flag — bytes stay
 * until a separate conscious cleanup.
 */
export function planOfflinePinChange(input: {
  readonly attachment: PhotoAttachment;
  readonly pinned: boolean;
  readonly existingJobs: readonly FamilyPhotoBlobTransferJob[];
}): {
  readonly attachment: PhotoAttachment;
  readonly needsDisplayDownload: boolean;
  readonly needsThumbnailDownload: boolean;
  readonly readiness: OfflinePinReadiness;
} {
  if (!input.pinned) {
    const next = { ...input.attachment, offlinePinned: false };
    return {
      attachment: next,
      needsDisplayDownload: false,
      needsThumbnailDownload: false,
      readiness: presentOfflinePinReadiness({
        offlinePinned: false,
        hasDurableDisplay: attachmentHasDurableRole(next),
        downloadInFlightOrQueued: false,
      }),
    };
  }

  const renditions = input.attachment.renditions.map((row) => {
    // Cached family copies become durable once the parent asks to keep them.
    if (row.availability === 'cache') {
      return { ...row, availability: 'durable' as const };
    }
    return row;
  });
  const next: PhotoAttachment = {
    ...input.attachment,
    offlinePinned: true,
    renditions,
  };
  const hasDisplay = attachmentHasDurableRole(next, 'display');
  const hasThumb = attachmentHasDurableRole(next, 'thumbnail');
  const downloadBusy = attachmentHasDownloadWork(
    next.attachmentId,
    input.existingJobs,
  );
  return {
    attachment: next,
    needsDisplayDownload: !hasDisplay,
    needsThumbnailDownload: !hasThumb,
    readiness: presentOfflinePinReadiness({
      offlinePinned: true,
      hasDurableDisplay: hasDisplay,
      downloadInFlightOrQueued: downloadBusy || !hasDisplay,
    }),
  };
}

/**
 * Map one local rendition into an LRU copy kind. Pinned and own/pending rows
 * stay outside the recoverable cache budget.
 */
export function classifyLocalPhotoCopyKind(input: {
  readonly offlinePinned: boolean;
  readonly ownImport: boolean;
  readonly uploadPending: boolean;
  readonly availability: 'durable' | 'cache' | 'pending' | 'missing';
}): LocalPhotoCopyKind | null {
  if (input.availability === 'missing') return null;
  if (input.uploadPending || input.availability === 'pending') return 'pending';
  if (input.ownImport) return 'own';
  if (input.offlinePinned) return 'pinned';
  if (input.availability === 'cache') return 'cache';
  // Family durable without an explicit pin is still treated as recoverable cache
  // for space management — pin upgrades protection.
  if (input.availability === 'durable') return 'cache';
  return 'cache';
}

export function summarizeProtectedOfflineBytes(
  copies: readonly LocalPhotoCopyRecord[],
): {
  readonly protectedBytes: number;
  readonly cacheBytes: number;
} {
  let protectedBytes = 0;
  let cacheBytes = 0;
  for (const row of copies) {
    if (row.kind === 'cache') cacheBytes += row.byteLength;
    else protectedBytes += row.byteLength;
  }
  return { protectedBytes, cacheBytes };
}

/** Legacy rows without pin/origin fields stay unpinned local imports. */
export function withOfflinePinDefault(
  attachment: Omit<PhotoAttachment, 'offlinePinned' | 'localOrigin'> & {
    readonly offlinePinned?: boolean;
    readonly localOrigin?: 'imported' | 'downloaded';
  },
): PhotoAttachment {
  return {
    ...attachment,
    offlinePinned: attachment.offlinePinned === true,
    localOrigin: attachment.localOrigin === 'downloaded' ? 'downloaded' : 'imported',
  };
}
