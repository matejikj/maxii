import type { AppUserId, DeviceId, FamilyId } from './ids.ts';
import { LUMI_API_PROTOCOL_VERSION } from './protocol.ts';

/** Opaque family pull cursor — clients must not invent or increment it. */
export type SyncCursor = string & { readonly __brand: 'SyncCursor' };

export type SyncOperationKind =
  | 'care.record'
  | 'care.update'
  | 'care.delete'
  | 'profile.update'
  | 'ops.noop';

export type SyncOperation = {
  readonly schemaVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly operationId: string;
  readonly deviceId: DeviceId | string;
  readonly actorAppUserId: AppUserId | string;
  readonly kind: SyncOperationKind | string;
  readonly entityId: string;
  readonly revisionId: string;
  readonly parentRevisionIds: readonly string[];
  /** SHA-256 hex of canonical operation body used for idempotent retries. */
  readonly payloadHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type SyncPushRequest = {
  readonly protocolVersion: typeof LUMI_API_PROTOCOL_VERSION;
  readonly attemptId: string;
  readonly operations: readonly SyncOperation[];
};

export type SyncOperationReceipt = {
  readonly operationId: string;
  readonly status:
    | 'accepted'
    | 'accepted_with_conflict'
    | 'duplicate'
    | 'rejected';
  readonly reason?:
    | 'hash_mismatch'
    | 'unknown_parents'
    | 'forbidden'
    | 'validation'
    | 'unsupported_schema'
    | 'revoked';
  readonly revisionId?: string;
  readonly heads?: readonly string[];
  readonly changelogSeq?: number;
};

export type SyncPushResponse = {
  readonly familyId: FamilyId;
  readonly attemptId: string;
  readonly epoch: number;
  readonly receipts: readonly SyncOperationReceipt[];
};

export type SyncPullQuery = {
  readonly cursor: SyncCursor | null;
  readonly limit?: number;
};

export type SyncChangelogEntry = {
  readonly changelogSeq: number;
  readonly operationId: string;
  readonly revisionId: string;
  readonly entityId: string;
  readonly kind: string;
  readonly payloadHash: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly acceptedAt: string;
  readonly heads: readonly string[];
};

export type SyncPullResponse = {
  readonly familyId: FamilyId;
  readonly epoch: number;
  readonly entries: readonly SyncChangelogEntry[];
  readonly nextCursor: SyncCursor | null;
  readonly resyncRequired: boolean;
};

/**
 * Honest sync presentation. Local save and device-to-device delivery are
 * separate — never claim offline phones already received a change.
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
