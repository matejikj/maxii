import { AppError } from '../errors.ts';
import type { OperationId, RevisionId } from '../ids.ts';
import type { Instant } from '../ports/clock.ts';
import type { PortfolioItem, Project, ShareSnapshot } from '../projects/types.ts';
import {
  type ChildPrivateSyncOperationKind,
} from './childPrivateKinds.ts';
import {
  enqueueChildPrivateOutbox,
  type LocalChildPrivateSyncState,
} from './childPrivateTransport.ts';

export type ChildPrivateOutboxPlan =
  | {
      readonly ok: true;
      readonly kind: ChildPrivateSyncOperationKind;
      readonly entityId: string;
      readonly revisionId: string;
      readonly parentRevisionIds: readonly string[];
      readonly payload: Readonly<Record<string, unknown>>;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'not_child_private'
        | 'missing_owner'
        | 'already_revoked'
        | 'not_revoked';
    };

/**
 * Map a local child-private project commit onto the owner-scoped outbox.
 * Family-guided projects stay off this stream entirely.
 */
export function planChildPrivateProjectUpsert(
  project: Project,
): ChildPrivateOutboxPlan {
  if (project.scope !== 'childPrivate') {
    return { ok: false, reason: 'not_child_private' };
  }
  if (!project.ownerAppUserId) {
    return { ok: false, reason: 'missing_owner' };
  }
  return {
    ok: true,
    kind: 'child_private.project.upsert',
    entityId: project.projectId,
    revisionId: project.revisionId,
    parentRevisionIds: [],
    payload: {
      projectId: project.projectId,
      childId: project.childId,
      title: project.title,
      intent: project.intent,
      status: project.status,
      reflection: project.reflection,
      steps: project.steps.map((step) => ({
        stepId: step.stepId,
        order: step.order,
        text: step.text,
        status: step.status,
      })),
      variantNotes: project.variantNotes,
      sourceNotes: project.sourceNotes,
      templateRevisionId: project.templateRevisionId,
    },
  };
}

export function planChildPrivateProjectDelete(input: {
  readonly project: Project;
  readonly revisionId: RevisionId;
}): ChildPrivateOutboxPlan {
  if (input.project.scope !== 'childPrivate') {
    return { ok: false, reason: 'not_child_private' };
  }
  if (!input.project.ownerAppUserId) {
    return { ok: false, reason: 'missing_owner' };
  }
  return {
    ok: true,
    kind: 'child_private.project.delete',
    entityId: input.project.projectId,
    revisionId: input.revisionId,
    parentRevisionIds: [input.project.revisionId],
    payload: { projectId: input.project.projectId },
  };
}

export function planChildPrivatePortfolioUpsert(
  item: PortfolioItem,
): ChildPrivateOutboxPlan {
  if (!item.ownerAppUserId) {
    return { ok: false, reason: 'missing_owner' };
  }
  return {
    ok: true,
    kind: 'child_private.portfolio.upsert',
    entityId: item.portfolioItemId,
    revisionId: item.portfolioItemId,
    parentRevisionIds: [],
    payload: {
      portfolioItemId: item.portfolioItemId,
      projectId: item.projectId,
      childId: item.childId,
      title: item.title,
      description: item.description,
      visibility: item.visibility,
      sortIndex: item.sortIndex ?? null,
    },
  };
}

export function planChildPrivatePortfolioDelete(input: {
  readonly item: PortfolioItem;
  readonly revisionId: RevisionId;
}): ChildPrivateOutboxPlan {
  if (!input.item.ownerAppUserId) {
    return { ok: false, reason: 'missing_owner' };
  }
  return {
    ok: true,
    kind: 'child_private.portfolio.delete',
    entityId: input.item.portfolioItemId,
    revisionId: input.revisionId,
    parentRevisionIds: [],
    payload: { portfolioItemId: input.item.portfolioItemId },
  };
}

/**
 * Frozen share only — live project reflection/intent never enter this payload.
 */
export function planChildPrivateSharePublish(
  share: ShareSnapshot,
): ChildPrivateOutboxPlan {
  if (share.revokedAt != null) {
    return { ok: false, reason: 'already_revoked' };
  }
  return {
    ok: true,
    kind: 'child_private.share.publish',
    entityId: share.shareId,
    revisionId: share.sourceRevisionId,
    parentRevisionIds: [],
    payload: {
      shareId: share.shareId,
      sourceProjectId: share.sourceProjectId,
      sourceRevisionId: share.sourceRevisionId,
      // Recipients materialize the share under the publisher, not themselves.
      ownerAppUserId: share.ownerAppUserId,
      publishedTitle: share.publishedTitle,
      publishedBody: share.publishedBody,
      audienceAppUserIds: [...share.audienceAppUserIds],
      commentsEnabled: share.commentsEnabled,
    },
  };
}

export function planChildPrivateShareRevoke(
  share: ShareSnapshot,
): ChildPrivateOutboxPlan {
  if (share.revokedAt == null) {
    // Caller must revoke first so the outbox carries a concrete timestamp.
    return { ok: false, reason: 'not_revoked' };
  }
  return {
    ok: true,
    kind: 'child_private.share.revoke',
    entityId: share.shareId,
    revisionId: `${share.shareId}:revoke`,
    parentRevisionIds: [share.sourceRevisionId],
    payload: {
      shareId: share.shareId,
      sourceProjectId: share.sourceProjectId,
      ownerAppUserId: share.ownerAppUserId,
      revokedAt: share.revokedAt,
    },
  };
}

/**
 * Apply a planned private change onto the local outbox. Network is not required
 * — personal builds keep durable unsent rows until a sync gate opens later.
 */
export function enqueuePlannedChildPrivateChange(input: {
  readonly state: LocalChildPrivateSyncState;
  readonly plan: Extract<ChildPrivateOutboxPlan, { ok: true }>;
  readonly ownerAppUserId: string;
  readonly operationId: OperationId;
  readonly enqueuedAt: Instant;
}): LocalChildPrivateSyncState {
  return enqueueChildPrivateOutbox(input.state, {
    ownerAppUserId: input.ownerAppUserId,
    operationId: input.operationId,
    commandType: input.plan.kind,
    entityId: input.plan.entityId,
    revisionId: input.plan.revisionId,
    parentRevisionIds: input.plan.parentRevisionIds,
    payload: input.plan.payload,
    enqueuedAt: input.enqueuedAt,
  });
}

export function requireChildPrivateOutboxPlan(
  plan: ChildPrivateOutboxPlan,
): Extract<ChildPrivateOutboxPlan, { ok: true }> {
  if (!plan.ok) {
    throw new AppError(
      'FORBIDDEN',
      'Change is not eligible for the child-private outbox',
      { details: { reason: plan.reason } },
    );
  }
  return plan;
}
