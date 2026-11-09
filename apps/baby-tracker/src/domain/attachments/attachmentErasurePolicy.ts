import { TRASH_RETENTION_MS } from '../commands/retention';
import type { LocalPhotoCopyKind } from './attachmentCachePolicy';

/** Photo trash follows the same seven-day undo window as care events. */
export const ATTACHMENT_TRASH_RETENTION_MS = TRASH_RETENTION_MS;

export function attachmentTrashRetainUntilMs(deletedAtMs: number): number {
  return deletedAtMs + ATTACHMENT_TRASH_RETENTION_MS;
}

export type AttachmentPurgeCandidate = {
  readonly attachmentId: string;
  readonly deletedAtMs: number | null;
  readonly retainUntilMs: number | null;
  /** Checkpoint recovery pins must keep referenced blobs until the pin lifts. */
  readonly referencedByCheckpoint: boolean;
  /** Open conflict branches still need both photo sets until resolved. */
  readonly referencedByConflict: boolean;
  /** Upload/download/export/recovery jobs must finish or cancel before purge. */
  readonly hasActiveTransferJob: boolean;
  readonly localCopyKinds: readonly LocalPhotoCopyKind[];
};

export type AttachmentPurgeDecision =
  | {
      readonly purge: true;
      /** Soft-delete metadata stays as a tombstone so retries cannot recreate. */
      readonly retainMetadataTombstone: true;
      readonly purgeBlobKeys: 'all_local_copies';
    }
  | {
      readonly purge: false;
      readonly reason:
        | 'still_active'
        | 'still_in_trash'
        | 'checkpoint_pin'
        | 'conflict_pin'
        | 'active_job';
    };

/**
 * Physical local purge after trash retention. Checkpoint, conflict, and active
 * jobs always win over GC — never resurrect by leaving a silent durable file.
 */
export function planAttachmentPayloadPurge(
  input: AttachmentPurgeCandidate & { readonly nowMs: number },
): AttachmentPurgeDecision {
  if (input.deletedAtMs == null) {
    return { purge: false, reason: 'still_active' };
  }
  const retainUntil =
    input.retainUntilMs ?? attachmentTrashRetainUntilMs(input.deletedAtMs);
  if (input.nowMs < retainUntil) {
    return { purge: false, reason: 'still_in_trash' };
  }
  if (input.referencedByCheckpoint) {
    return { purge: false, reason: 'checkpoint_pin' };
  }
  if (input.referencedByConflict) {
    return { purge: false, reason: 'conflict_pin' };
  }
  if (input.hasActiveTransferJob) {
    return { purge: false, reason: 'active_job' };
  }
  void input.localCopyKinds;
  return {
    purge: true,
    retainMetadataTombstone: true,
    purgeBlobKeys: 'all_local_copies',
  };
}

export type AttachmentRestoreFilterResult = {
  readonly visibleAttachmentIds: readonly string[];
  readonly blockedByErasureIds: readonly string[];
};

/**
 * When opening a restored diary or family dump, newer erase generations win
 * before any photo becomes visible again.
 */
export function filterRestoredAttachmentsAgainstErasure(input: {
  readonly restoredAttachmentIds: readonly string[];
  readonly erasureByAttachmentId: ReadonlyMap<string, { readonly eraseGeneration: number }>;
}): AttachmentRestoreFilterResult {
  const visible: string[] = [];
  const blocked: string[] = [];
  for (const id of input.restoredAttachmentIds) {
    const hit = input.erasureByAttachmentId.get(id);
    if (hit && hit.eraseGeneration > 0) {
      blocked.push(id);
      continue;
    }
    visible.push(id);
  }
  return { visibleAttachmentIds: visible, blockedByErasureIds: blocked };
}
