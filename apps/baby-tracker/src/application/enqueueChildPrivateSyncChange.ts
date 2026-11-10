import type { OperationId } from '../domain/ids';
import type { Instant } from '../domain/ports/clock';
import type { PortfolioItem, Project, ShareSnapshot } from '../domain/projects/types';
import {
  enqueuePlannedChildPrivateChange,
  planChildPrivatePortfolioDelete,
  planChildPrivatePortfolioUpsert,
  planChildPrivateProjectDelete,
  planChildPrivateProjectUpsert,
  planChildPrivateSharePublish,
  planChildPrivateShareRevoke,
  requireChildPrivateOutboxPlan,
  type ChildPrivateOutboxPlan,
} from '../domain/sync/childPrivateOutboxPlanner';
import type { LocalChildPrivateSyncState } from '../domain/sync/childPrivateTransport';
import type { ChildPrivateSyncStateStore } from '../domain/sync/childPrivateSyncStateStore';

export type EnqueueChildPrivateSyncChangeResult =
  | {
      readonly ok: true;
      readonly state: LocalChildPrivateSyncState;
      readonly plan: Extract<ChildPrivateOutboxPlan, { ok: true }>;
    }
  | {
      readonly ok: false;
      readonly state: LocalChildPrivateSyncState;
      readonly reason: Extract<ChildPrivateOutboxPlan, { ok: false }>['reason'];
    };

async function commitPlan(input: {
  readonly store: ChildPrivateSyncStateStore;
  readonly plan: ChildPrivateOutboxPlan;
  readonly ownerAppUserId: string;
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): Promise<EnqueueChildPrivateSyncChangeResult> {
  const state = await input.store.load();
  if (!input.plan.ok) {
    return { ok: false, state, reason: input.plan.reason };
  }
  const next = enqueuePlannedChildPrivateChange({
    state,
    plan: input.plan,
    ownerAppUserId: input.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
  await input.store.save(next);
  return { ok: true, state: next, plan: input.plan };
}

/** Local project save → durable private outbox row (no network). */
export async function enqueueChildPrivateProjectUpsert(input: {
  readonly store: ChildPrivateSyncStateStore;
  readonly project: Project;
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): Promise<EnqueueChildPrivateSyncChangeResult> {
  const plan = planChildPrivateProjectUpsert(input.project);
  if (!plan.ok) {
    const state = await input.store.load();
    return { ok: false, state, reason: plan.reason };
  }
  if (!input.project.ownerAppUserId) {
    const state = await input.store.load();
    return { ok: false, state, reason: 'missing_owner' };
  }
  return commitPlan({
    store: input.store,
    plan,
    ownerAppUserId: input.project.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
}

export async function enqueueChildPrivateProjectDelete(input: {
  readonly store: ChildPrivateSyncStateStore;
  readonly project: Project;
  readonly revisionId: Parameters<typeof planChildPrivateProjectDelete>[0]['revisionId'];
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): Promise<EnqueueChildPrivateSyncChangeResult> {
  const plan = planChildPrivateProjectDelete({
    project: input.project,
    revisionId: input.revisionId,
  });
  if (!plan.ok || !input.project.ownerAppUserId) {
    const state = await input.store.load();
    return {
      ok: false,
      state,
      reason: !plan.ok ? plan.reason : 'missing_owner',
    };
  }
  return commitPlan({
    store: input.store,
    plan,
    ownerAppUserId: input.project.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
}

export async function enqueueChildPrivatePortfolioUpsert(input: {
  readonly store: ChildPrivateSyncStateStore;
  readonly item: PortfolioItem;
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): Promise<EnqueueChildPrivateSyncChangeResult> {
  const plan = planChildPrivatePortfolioUpsert(input.item);
  if (!plan.ok || !input.item.ownerAppUserId) {
    const state = await input.store.load();
    return {
      ok: false,
      state,
      reason: !plan.ok ? plan.reason : 'missing_owner',
    };
  }
  return commitPlan({
    store: input.store,
    plan,
    ownerAppUserId: input.item.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
}

export async function enqueueChildPrivatePortfolioDelete(input: {
  readonly store: ChildPrivateSyncStateStore;
  readonly item: PortfolioItem;
  readonly revisionId: Parameters<typeof planChildPrivatePortfolioDelete>[0]['revisionId'];
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): Promise<EnqueueChildPrivateSyncChangeResult> {
  const plan = planChildPrivatePortfolioDelete({
    item: input.item,
    revisionId: input.revisionId,
  });
  if (!plan.ok || !input.item.ownerAppUserId) {
    const state = await input.store.load();
    return {
      ok: false,
      state,
      reason: !plan.ok ? plan.reason : 'missing_owner',
    };
  }
  return commitPlan({
    store: input.store,
    plan,
    ownerAppUserId: input.item.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
}

export async function enqueueChildPrivateSharePublish(input: {
  readonly store: ChildPrivateSyncStateStore;
  readonly share: ShareSnapshot;
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): Promise<EnqueueChildPrivateSyncChangeResult> {
  const plan = planChildPrivateSharePublish(input.share);
  if (!plan.ok) {
    const state = await input.store.load();
    return { ok: false, state, reason: plan.reason };
  }
  return commitPlan({
    store: input.store,
    plan,
    ownerAppUserId: input.share.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
}

export async function enqueueChildPrivateShareRevoke(input: {
  readonly store: ChildPrivateSyncStateStore;
  readonly share: ShareSnapshot;
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): Promise<EnqueueChildPrivateSyncChangeResult> {
  const plan = planChildPrivateShareRevoke(input.share);
  if (!plan.ok) {
    const state = await input.store.load();
    return { ok: false, state, reason: plan.reason };
  }
  return commitPlan({
    store: input.store,
    plan,
    ownerAppUserId: input.share.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
}

/** Strict helper for callers that already validated eligibility. */
export function enqueueRequiredChildPrivatePlan(input: {
  readonly state: LocalChildPrivateSyncState;
  readonly plan: ChildPrivateOutboxPlan;
  readonly ownerAppUserId: string;
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): LocalChildPrivateSyncState {
  const plan = requireChildPrivateOutboxPlan(input.plan);
  return enqueuePlannedChildPrivateChange({
    state: input.state,
    plan,
    ownerAppUserId: input.ownerAppUserId,
    operationId: input.operationId,
    enqueuedAt: input.enqueuedAt,
  });
}
