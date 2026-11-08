import type { OperationId } from '../ids';
import type { Instant } from './clock';

/**
 * Personal mode leaves outbox empty. Family sync will append in the same
 * UnitOfWork as entity + revision + receipt without changing command results.
 */
export type OutboxEntry = {
  operationId: OperationId;
  commandType: string;
  enqueuedAt: Instant;
  payload: unknown;
};

export type OutboxPort = {
  append?(entry: OutboxEntry): Promise<void>;
};
