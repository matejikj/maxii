import {
  AppError,
  asEntityId,
  confirmOfflineShareProposal,
  isChildPrivateModeActive,
  networkBecameOnlineMustNotAutoPublish,
  planOfflineShareProposal,
  publishShareSnapshot,
  revokeShareSnapshot,
  type ActorId,
  type EntityId,
  type IdGenerator,
  type Instant,
  type PendingShareProposal,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../domain';

export type ChildShellShareCard = {
  readonly shareId: string;
  readonly publishedTitle: string;
  readonly audienceCount: number;
  readonly statusLabel: 'Aktivní ukázka' | 'Odvoláno';
  readonly revoked: boolean;
};

/**
 * Prepare an offline share proposal. Does not write a ShareSnapshot — the owner
 * must confirm later; reconnect alone never publishes.
 */
export function prepareChildShellShareProposal(input: {
  readonly proposalId?: EntityId;
  readonly project: Parameters<typeof planOfflineShareProposal>[0]['project'];
  readonly ownerAppUserId: ActorId;
  readonly publishedTitle: string;
  readonly publishedBody: string;
  readonly audienceAppUserIds: readonly ActorId[];
  readonly now: Instant;
  readonly commentsEnabled?: boolean;
  readonly childPrivateModeActive?: boolean;
}): PendingShareProposal {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  return planOfflineShareProposal({
    proposalId: input.proposalId ?? asEntityId(`share_prop_${input.now.epochMs}`),
    project: input.project,
    ownerAppUserId: input.ownerAppUserId,
    publishedTitle: input.publishedTitle,
    publishedBody: input.publishedBody,
    audienceAppUserIds: input.audienceAppUserIds,
    commentsEnabled: input.commentsEnabled ?? false,
    now: input.now,
    childPrivateModeActive: true,
  });
}

/**
 * Confirm a pending proposal and persist an immutable share snapshot.
 * Pass explicitConfirm=true only from a deliberate UI action.
 */
export async function confirmAndPublishChildShellShare(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ids: IdGenerator;
  readonly now: Instant;
  readonly proposal: PendingShareProposal;
  readonly ownerAppUserId: ActorId;
  readonly explicitConfirm: boolean;
  readonly childPrivateModeActive?: boolean;
  /** When true, simulates reconnect before confirm — must still refuse without confirm. */
  readonly networkBecameOnline?: boolean;
}): Promise<ShareSnapshot> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  if (input.networkBecameOnline) {
    const auto = networkBecameOnlineMustNotAutoPublish(input.proposal);
    if (auto !== false) {
      throw new AppError('CONFLICT', 'Network reconnect must not auto-publish shares', {
        details: { reason: 'auto_publish_forbidden' },
      });
    }
  }
  if (input.proposal.ownerAppUserId !== input.ownerAppUserId) {
    throw new AppError('FORBIDDEN', 'Only the share owner may confirm publication', {
      details: { reason: 'not_proposal_owner' },
    });
  }

  return input.unitOfWork.run(async (uow) => {
    const project = await uow.projects.getById(input.proposal.sourceProjectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 'Project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    const draft = confirmOfflineShareProposal({
      proposal: input.proposal,
      project,
      explicitConfirm: input.explicitConfirm,
      childPrivateModeActive: true,
    });
    const share = publishShareSnapshot({
      shareId: asEntityId(input.ids.createId('share')),
      draft,
      ownerAppUserId: input.ownerAppUserId,
      now: input.now,
    });
    await uow.shares.save(share);
    return share;
  });
}

export async function listChildShellShareCards(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellShareCard[]> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) return [];
  return input.unitOfWork.run(async (uow) => {
    const shares = await uow.shares.listByOwner(input.ownerAppUserId);
    return shares.map((share) => ({
      shareId: share.shareId,
      publishedTitle: share.publishedTitle,
      audienceCount: share.audienceAppUserIds.length,
      revoked: share.revokedAt != null,
      statusLabel: share.revokedAt != null ? 'Odvoláno' : 'Aktivní ukázka',
    }));
  });
}

export async function revokeChildShellShare(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly now: Instant;
  readonly shareId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ShareSnapshot> {
  const active = input.childPrivateModeActive ?? isChildPrivateModeActive();
  if (!active) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  return input.unitOfWork.run(async (uow) => {
    const share = await uow.shares.getById(input.shareId);
    if (!share) {
      throw new AppError('NOT_FOUND', 'Share was not found', {
        details: { reason: 'share_missing' },
      });
    }
    if (share.ownerAppUserId !== input.ownerAppUserId) {
      throw new AppError('FORBIDDEN', 'Only the share owner may revoke it', {
        details: { reason: 'not_share_owner' },
      });
    }
    const revoked = revokeShareSnapshot(share, input.now);
    await uow.shares.save(revoked);
    return revoked;
  });
}
