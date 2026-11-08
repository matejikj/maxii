import type { ActorId, DeviceId, EntityId, OperationId, RevisionId } from '../ids';
import type { Instant } from '../ports/clock';

/**
 * Immutable accepted change. Causality uses parent revision ids, never device
 * wall-clock ordering. Authorship is optional so personal offline use needs no account.
 */
export type Revision = {
  revisionId: RevisionId;
  entityId: EntityId;
  operationId: OperationId;
  parentRevisionIds: RevisionId[];
  commandType: string;
  createdAt: Instant;
  deviceId: DeviceId | null;
  actorId: ActorId | null;
  /** Validated domain snapshot after the command; never a raw DB row dump. */
  state: unknown;
};

/**
 * Local proof that an intent finished. Retry of the same operationId reuses
 * the captured intent times instead of minting new ones.
 */
export type OperationReceipt = {
  operationId: OperationId;
  commandType: string;
  intentCapturedAt: Instant;
  completedAt: Instant;
  entityIds: EntityId[];
  revisionIds: RevisionId[];
  resultCode: 'savedLocally';
};

export type DeletionMarker = {
  deletionId: EntityId;
  entityId: EntityId;
  entityType: string;
  deletedAt: Instant;
  revisionId: RevisionId;
  /** Soft-delete retention end; payload may be purged afterwards. */
  retainUntil: Instant;
  /**
   * Restorable entity snapshot while retention lasts. Cleared after purge so the
   * marker can still replay a deletion without keeping sensitive note text.
   */
  payload: unknown | null;
  payloadPurged: boolean;
};
