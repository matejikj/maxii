/**
 * Opening an old personal/family archive must stay in an isolated workspace.
 * Live sync cursors and durable outbox entries are never rewritten by preview.
 */

export type IsolatedRestorePlan = {
  readonly workspaceId: string;
  readonly rewritesLiveCursor: false;
  readonly enqueuesArchiveEntitiesAsNew: false;
  readonly comparesAgainstLive: true;
  readonly appliesTombstonesBeforeMerge: true;
  readonly requiresAdminConfirmation: boolean;
};

export function planIsolatedArchiveRestore(input: {
  readonly archiveId: string;
  readonly isFamilyAdmin: boolean;
  readonly liveCursorToken: string | null;
  readonly liveOutboxCount: number;
}): IsolatedRestorePlan {
  void input.archiveId;
  void input.liveCursorToken;
  void input.liveOutboxCount;
  return {
    workspaceId: `isolated:${input.archiveId}`,
    rewritesLiveCursor: false,
    enqueuesArchiveEntitiesAsNew: false,
    comparesAgainstLive: true,
    appliesTombstonesBeforeMerge: true,
    requiresAdminConfirmation: input.isFamilyAdmin,
  };
}

/**
 * Logout / device revoke must keep unsent local work visible. Remote copies
 * already off-device are outside app control and are reported honestly.
 */
export function describeCopiesAfterLogout(input: {
  readonly localUnsentCount: number;
  readonly remoteBackupControlledByApp: false;
}): {
  readonly keepLocalUnsent: true;
  readonly localUnsentCount: number;
  readonly remoteCopiesStillExistOutsideApp: true;
  readonly remoteBackupControlledByApp: false;
} {
  return {
    keepLocalUnsent: true,
    localUnsentCount: input.localUnsentCount,
    remoteCopiesStillExistOutsideApp: true,
    remoteBackupControlledByApp: false,
  };
}
