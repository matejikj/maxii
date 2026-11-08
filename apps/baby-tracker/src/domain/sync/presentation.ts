/**
 * Separate local save from transfer so UI never claims offline phones already
 * received a change just because this device finished a push.
 */
export type SyncTransferPresentation = {
  readonly savedLocally: true;
  readonly pendingTransferCount: number;
  readonly lastSuccessfulSyncAt: string | null;
  readonly transferState: 'idle' | 'pending' | 'in_flight' | 'blocked' | 'resync_required';
  readonly claimsOtherDevicesSynced: false;
};

export function buildSyncTransferPresentation(input: {
  readonly pendingTransferCount: number;
  readonly inFlight: boolean;
  readonly lastSuccessfulSyncAt: string | null;
  readonly blocked?: boolean;
  readonly resyncRequired?: boolean;
}): SyncTransferPresentation {
  let transferState: SyncTransferPresentation['transferState'] = 'idle';
  if (input.resyncRequired) transferState = 'resync_required';
  else if (input.blocked) transferState = 'blocked';
  else if (input.inFlight) transferState = 'in_flight';
  else if (input.pendingTransferCount > 0) transferState = 'pending';
  return {
    savedLocally: true,
    pendingTransferCount: input.pendingTransferCount,
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
    transferState,
    claimsOtherDevicesSynced: false,
  };
}
