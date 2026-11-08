import type { OperationId } from '../ids';
import type { Instant } from './clock';

/**
 * Personal mode may append durable outbox rows without a family/server. Sync
 * transport only starts when the remote boundary is explicitly configured.
 */
export type OutboxEntry = {
  operationId: OperationId;
  commandType: string;
  enqueuedAt: Instant;
  payload: unknown;
  entityId?: string;
  revisionId?: string;
  parentRevisionIds?: readonly string[];
  schemaVersion?: 1;
  payloadHash?: string;
};

export type OutboxPort = {
  append?(entry: OutboxEntry): Promise<void>;
};
