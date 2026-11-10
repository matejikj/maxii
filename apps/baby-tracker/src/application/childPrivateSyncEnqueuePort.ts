import { AppError } from '../domain/errors';
import { asOperationId, type OperationId } from '../domain/ids';
import type { Instant } from '../domain/ports/clock';
import type { PortfolioItem, Project, ShareSnapshot } from '../domain/projects/types';
import type { ChildPrivateSyncStateStore } from '../domain/sync/childPrivateSyncStateStore';
import {
  enqueueChildPrivatePortfolioUpsert,
  enqueueChildPrivateProjectUpsert,
  enqueueChildPrivateSharePublish,
  enqueueChildPrivateShareRevoke,
} from './enqueueChildPrivateSyncChange';

/**
 * Optional durable sync enqueue after a local child-private commit.
 * Omitted in pure UI tests; personal cold still saves entities without a network.
 */
export type ChildPrivateSyncEnqueuePort = {
  readonly store: ChildPrivateSyncStateStore;
};

function requireOk(
  result: { readonly ok: true } | { readonly ok: false; readonly reason: string },
  label: string,
): void {
  if (!result.ok) {
    throw new AppError(
      'INTERNAL',
      `Failed to enqueue ${label} onto the child-private outbox`,
      { details: { reason: result.reason } },
    );
  }
}

export function operationIdOrFallback(
  operationId: OperationId | undefined,
  seed: string,
): OperationId {
  return operationId ?? asOperationId(seed);
}

/** After a private project save — no-op when sync enqueue is not bound. */
export async function enqueueAfterChildPrivateProjectSave(input: {
  readonly syncEnqueue?: ChildPrivateSyncEnqueuePort | undefined;
  readonly project: Project;
  readonly operationId: OperationId;
  readonly now: Instant;
}): Promise<void> {
  if (!input.syncEnqueue) return;
  const result = await enqueueChildPrivateProjectUpsert({
    store: input.syncEnqueue.store,
    project: input.project,
    operationId: input.operationId,
    enqueuedAt: input.now,
  });
  requireOk(result, 'project');
}

export async function enqueueAfterChildPrivatePortfolioSave(input: {
  readonly syncEnqueue?: ChildPrivateSyncEnqueuePort | undefined;
  readonly item: PortfolioItem;
  readonly operationId: OperationId;
  readonly now: Instant;
}): Promise<void> {
  if (!input.syncEnqueue) return;
  const result = await enqueueChildPrivatePortfolioUpsert({
    store: input.syncEnqueue.store,
    item: input.item,
    operationId: input.operationId,
    enqueuedAt: input.now,
  });
  requireOk(result, 'portfolio');
}

export async function enqueueAfterChildPrivateSharePublish(input: {
  readonly syncEnqueue?: ChildPrivateSyncEnqueuePort | undefined;
  readonly share: ShareSnapshot;
  readonly operationId: OperationId;
  readonly now: Instant;
}): Promise<void> {
  if (!input.syncEnqueue) return;
  const result = await enqueueChildPrivateSharePublish({
    store: input.syncEnqueue.store,
    share: input.share,
    operationId: input.operationId,
    enqueuedAt: input.now,
  });
  requireOk(result, 'share publish');
}

export async function enqueueAfterChildPrivateShareRevoke(input: {
  readonly syncEnqueue?: ChildPrivateSyncEnqueuePort | undefined;
  readonly share: ShareSnapshot;
  readonly operationId: OperationId;
  readonly now: Instant;
}): Promise<void> {
  if (!input.syncEnqueue) return;
  const result = await enqueueChildPrivateShareRevoke({
    store: input.syncEnqueue.store,
    share: input.share,
    operationId: input.operationId,
    enqueuedAt: input.now,
  });
  requireOk(result, 'share revoke');
}
