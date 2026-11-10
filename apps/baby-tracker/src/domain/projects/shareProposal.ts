import { AppError } from '../errors';
import type { ActorId, EntityId } from '../ids';
import type { Instant } from '../ports/clock';
import { planShareSnapshot, type ShareDraft } from './shareLifecycle';
import type { Project } from './types';

/**
 * Offline-prepared share that is not yet published. Reconnecting to the network
 * alone must never turn this into a ShareSnapshot — the owner confirms again.
 */
export type PendingShareProposal = {
  readonly proposalId: EntityId;
  readonly sourceProjectId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly publishedTitle: string;
  readonly publishedBody: string;
  readonly audienceAppUserIds: readonly ActorId[];
  readonly commentsEnabled: boolean;
  readonly preparedAt: Instant;
  /** Marker for UI/tests: publication still needs an explicit confirm action. */
  readonly awaitingExplicitConfirm: true;
};

export function planOfflineShareProposal(input: {
  readonly proposalId: EntityId;
  readonly project: Project;
  readonly ownerAppUserId: ActorId;
  readonly publishedTitle: string;
  readonly publishedBody: string;
  readonly audienceAppUserIds: readonly ActorId[];
  readonly commentsEnabled?: boolean;
  readonly now: Instant;
  readonly childPrivateModeActive: boolean;
}): PendingShareProposal {
  if (input.project.ownerAppUserId !== input.ownerAppUserId) {
    throw new AppError('FORBIDDEN', 'Only the project owner may prepare a share', {
      details: { reason: 'not_project_owner' },
    });
  }
  // Reuse publish validation (audience, size, mode gate) without creating a snapshot.
  const draft = planShareSnapshot({
    project: input.project,
    publishedTitle: input.publishedTitle,
    publishedBody: input.publishedBody,
    audienceAppUserIds: input.audienceAppUserIds,
    commentsEnabled: input.commentsEnabled ?? false,
    childPrivateModeActive: input.childPrivateModeActive,
  });
  return {
    proposalId: input.proposalId,
    sourceProjectId: draft.sourceProjectId,
    ownerAppUserId: input.ownerAppUserId,
    publishedTitle: draft.publishedTitle,
    publishedBody: draft.publishedBody,
    audienceAppUserIds: draft.audienceAppUserIds,
    commentsEnabled: draft.commentsEnabled,
    preparedAt: input.now,
    awaitingExplicitConfirm: true,
  };
}

/**
 * Explicit confirm converts a pending proposal into a publishable draft.
 * Network connectivity is intentionally not an input — reconnect is not confirm.
 */
export function confirmOfflineShareProposal(input: {
  readonly proposal: PendingShareProposal;
  readonly project: Project;
  readonly explicitConfirm: boolean;
  readonly childPrivateModeActive: boolean;
}): ShareDraft {
  if (!input.explicitConfirm) {
    throw new AppError('VALIDATION', 'Share publish requires an explicit confirmation', {
      details: { reason: 'missing_explicit_confirm' },
    });
  }
  if (input.proposal.sourceProjectId !== input.project.projectId) {
    throw new AppError('CONFLICT', 'Share proposal no longer matches the project', {
      details: { reason: 'proposal_project_mismatch' },
    });
  }
  if (input.project.ownerAppUserId !== input.proposal.ownerAppUserId) {
    throw new AppError('FORBIDDEN', 'Only the proposal owner may confirm the share', {
      details: { reason: 'not_proposal_owner' },
    });
  }
  return planShareSnapshot({
    project: input.project,
    publishedTitle: input.proposal.publishedTitle,
    publishedBody: input.proposal.publishedBody,
    audienceAppUserIds: input.proposal.audienceAppUserIds,
    commentsEnabled: input.proposal.commentsEnabled,
    childPrivateModeActive: input.childPrivateModeActive,
  });
}

/** Product invariant: coming back online never publishes a pending proposal. */
export function networkBecameOnlineMustNotAutoPublish(
  _proposal: PendingShareProposal,
): false {
  return false;
}
