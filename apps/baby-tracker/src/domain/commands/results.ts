import type { AppError } from '../errors';
import type { EntityId, OperationId, RevisionId } from '../ids';
import type { Instant } from '../ports/clock';

/**
 * Intent identity and captured times belong to the command. Retries must reuse
 * the same operationId and intentCapturedAt rather than minting new ones.
 */
export type CommandIntent = {
  operationId: OperationId;
  intentCapturedAt: Instant;
};

export type SavedLocallyResult = {
  ok: true;
  savedLocally: true;
  operationId: OperationId;
  entityIds: EntityId[];
  revisionIds: RevisionId[];
  completedAt: Instant;
};

export type CommandFailure = {
  ok: false;
  savedLocally: false;
  operationId: OperationId;
  error: AppError;
};

export type CommandResult = SavedLocallyResult | CommandFailure;

export function savedLocally(
  intent: CommandIntent,
  completedAt: Instant,
  entityIds: EntityId[],
  revisionIds: RevisionId[],
): SavedLocallyResult {
  return {
    ok: true,
    savedLocally: true,
    operationId: intent.operationId,
    entityIds,
    revisionIds,
    completedAt,
  };
}

export function commandFailed(intent: CommandIntent, error: AppError): CommandFailure {
  return {
    ok: false,
    savedLocally: false,
    operationId: intent.operationId,
    error,
  };
}

/** Infrastructure failures may be retried with the same intent; domain validation may not. */
export function isRetryableCommandFailure(result: CommandFailure): boolean {
  return result.error.retryable;
}
