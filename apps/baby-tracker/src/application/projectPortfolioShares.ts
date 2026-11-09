import {
  AppError,
  asActorId,
  asEntityId,
  assertProjectAccess,
  createPortfolioItem,
  filterProjectsForFamilyExport,
  filterSharesForRequester,
  isChildPrivateModeActive,
  planShareSnapshot,
  presentShareToRecipient,
  publishShareSnapshot,
  revokeShareSnapshot,
  type ActorId,
  type ChildId,
  type EntityId,
  type IdGenerator,
  type Instant,
  type PortfolioItem,
  type Project,
  type ShareSnapshot,
  type UnitOfWorkFactory,
} from '../domain';

function ownerAccess(project: Project, principalAppUserId: ActorId | null) {
  return {
    principalKind: 'owner' as const,
    principalAppUserId,
    childPrivateModeActive: isChildPrivateModeActive(),
    project,
  };
}

export async function addPortfolioSelection(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  projectId: EntityId;
  title: string;
  description?: string | null;
  ownerAppUserId?: ActorId | null;
}): Promise<PortfolioItem> {
  return input.unitOfWork.run(async (uow) => {
    const project = await uow.projects.getById(input.projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 'Project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    assertProjectAccess(
      'update',
      ownerAccess(project, input.ownerAppUserId ?? project.ownerAppUserId),
    );
    const item = createPortfolioItem({
      portfolioItemId: asEntityId(input.ids.createId('port')),
      project,
      title: input.title,
      description: input.description ?? null,
      ownerAppUserId: input.ownerAppUserId ?? project.ownerAppUserId,
      now: input.now,
      childPrivateModeActive: isChildPrivateModeActive(),
    });
    await uow.portfolio.save(item);
    return item;
  });
}

export async function listPortfolioSelections(
  unitOfWork: UnitOfWorkFactory,
  childId: ChildId,
): Promise<PortfolioItem[]> {
  return unitOfWork.run(async (uow) => uow.portfolio.listByChild(childId));
}

/**
 * Publish an immutable share snapshot. Child-private publishing stays gated
 * until verified child mode is active; familyGuided does not use this path.
 */
export async function publishProjectShare(input: {
  unitOfWork: UnitOfWorkFactory;
  ids: IdGenerator;
  now: Instant;
  projectId: EntityId;
  ownerAppUserId: ActorId;
  publishedTitle: string;
  publishedBody: string;
  audienceAppUserIds: readonly ActorId[];
  commentsEnabled?: boolean;
}): Promise<ShareSnapshot> {
  return input.unitOfWork.run(async (uow) => {
    const project = await uow.projects.getById(input.projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 'Project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    assertProjectAccess('share_publish', {
      ...ownerAccess(project, input.ownerAppUserId),
      childPrivateModeActive: isChildPrivateModeActive(),
    });
    const draft = planShareSnapshot({
      project,
      publishedTitle: input.publishedTitle,
      publishedBody: input.publishedBody,
      audienceAppUserIds: input.audienceAppUserIds,
      commentsEnabled: input.commentsEnabled ?? false,
      childPrivateModeActive: isChildPrivateModeActive(),
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

export async function revokeProjectShare(input: {
  unitOfWork: UnitOfWorkFactory;
  now: Instant;
  shareId: EntityId;
  ownerAppUserId: ActorId;
}): Promise<ShareSnapshot> {
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
    const project = await uow.projects.getById(share.sourceProjectId);
    if (project) {
      assertProjectAccess('share_revoke', ownerAccess(project, input.ownerAppUserId));
    }
    const revoked = revokeShareSnapshot(share, input.now);
    await uow.shares.save(revoked);
    return revoked;
  });
}

export async function readShareAsRecipient(input: {
  unitOfWork: UnitOfWorkFactory;
  shareId: EntityId;
  recipientAppUserId: ActorId;
}): Promise<{ title: string; body: string; liveProjectLeaked: false }> {
  return input.unitOfWork.run(async (uow) => {
    const share = await uow.shares.getById(input.shareId);
    if (!share) {
      throw new AppError('NOT_FOUND', 'Share was not found', {
        details: { reason: 'share_missing' },
      });
    }
    if (!share.audienceAppUserIds.includes(input.recipientAppUserId)) {
      throw new AppError('FORBIDDEN', 'Share is not addressed to this recipient', {
        details: { reason: 'not_named_recipient' },
      });
    }
    const live = await uow.projects.getById(share.sourceProjectId);
    return presentShareToRecipient(share, live);
  });
}

/** Caregiver family export helper — never includes childPrivate project rows. */
export async function exportProjectsForFamilyArchive(input: {
  unitOfWork: UnitOfWorkFactory;
  principalKind: 'other_adult_admin' | 'other_adult_caregiver';
  principalAppUserId: ActorId | null;
}): Promise<{ projects: Project[]; shares: ShareSnapshot[] }> {
  return input.unitOfWork.run(async (uow) => {
    const projects = filterProjectsForFamilyExport({
      projects: await uow.projects.listAll(),
      principalKind: input.principalKind,
      principalAppUserId: input.principalAppUserId,
      childPrivateModeActive: isChildPrivateModeActive(),
    });
    const shares = filterSharesForRequester({
      shares: await uow.shares.listAll(),
      principalKind: input.principalKind,
      principalAppUserId: input.principalAppUserId,
    });
    return { projects, shares };
  });
}

export { asActorId };
