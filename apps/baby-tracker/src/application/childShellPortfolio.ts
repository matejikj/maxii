import {
  AppError,
  asEntityId,
  createPortfolioItem,
  filterPortfolioByQuery,
  listPortfolioForChild,
  movePortfolioItemEarlier,
  updatePortfolioItemDetails,
  type ActorId,
  type ChildId,
  type EntityId,
  type IdGenerator,
  type Instant,
  type PortfolioItem,
  type UnitOfWorkFactory,
} from '../domain';

export type ChildShellPortfolioCard = {
  readonly portfolioItemId: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibilityLabel: 'Soukromé';
  readonly sortIndex: number;
};

function requireActiveMode(childPrivateModeActive: boolean): void {
  if (!childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
}

function toCard(item: PortfolioItem): ChildShellPortfolioCard {
  return {
    portfolioItemId: item.portfolioItemId,
    projectId: item.projectId,
    title: item.title,
    description: item.description,
    visibilityLabel: 'Soukromé',
    sortIndex: item.sortIndex ?? item.createdAt.epochMs,
  };
}

function assertOwnedItem(
  item: PortfolioItem | null,
  ownerAppUserId: ActorId,
): PortfolioItem {
  if (!item) {
    throw new AppError('NOT_FOUND', 'Portfolio item was not found', {
      details: { reason: 'portfolio_missing' },
    });
  }
  if (item.ownerAppUserId !== ownerAppUserId) {
    throw new AppError('FORBIDDEN', 'Only the portfolio owner may change this card', {
      details: { reason: 'not_portfolio_owner' },
    });
  }
  return item;
}

/**
 * Owner-scoped portfolio cards for the child shell. Empty while mode is closed
 * so caregiver UI never sees private selection titles by probing childId.
 */
export async function listChildShellPortfolioCards(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly childId: ChildId;
  readonly ownerAppUserId: ActorId;
  readonly query?: string;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellPortfolioCard[]> {
  const active = input.childPrivateModeActive ?? false;
  if (!active) return [];
  return input.unitOfWork.run(async (uow) => {
    const mine = (await uow.portfolio.listByChild(input.childId)).filter(
      (item) => item.ownerAppUserId === input.ownerAppUserId,
    );
    const ordered = listPortfolioForChild(mine, input.childId);
    return filterPortfolioByQuery(ordered, input.query ?? '').map(toCard);
  });
}

export async function addChildShellPortfolioSelection(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly ids: IdGenerator;
  readonly now: Instant;
  readonly projectId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly title: string;
  readonly description?: string | null;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellPortfolioCard> {
  const active = input.childPrivateModeActive ?? false;
  requireActiveMode(active);
  return input.unitOfWork.run(async (uow) => {
    const project = await uow.projects.getById(input.projectId);
    if (!project || project.scope !== 'childPrivate') {
      throw new AppError('NOT_FOUND', 'Private project was not found', {
        details: { reason: 'project_missing' },
      });
    }
    if (project.ownerAppUserId !== input.ownerAppUserId) {
      throw new AppError('FORBIDDEN', 'Only the project owner may select into portfolio', {
        details: { reason: 'not_project_owner' },
      });
    }
    const item = createPortfolioItem({
      portfolioItemId: asEntityId(input.ids.createId('port')),
      project,
      title: input.title,
      description: input.description ?? null,
      ownerAppUserId: input.ownerAppUserId,
      now: input.now,
      childPrivateModeActive: true,
    });
    await uow.portfolio.save(item);
    return toCard(item);
  });
}

export async function renameChildShellPortfolioCard(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly portfolioItemId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly title: string;
  readonly description?: string | null;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellPortfolioCard> {
  const active = input.childPrivateModeActive ?? false;
  requireActiveMode(active);
  return input.unitOfWork.run(async (uow) => {
    const current = assertOwnedItem(
      await uow.portfolio.getById(input.portfolioItemId),
      input.ownerAppUserId,
    );
    const next = updatePortfolioItemDetails(current, {
      title: input.title,
      description: input.description,
    });
    await uow.portfolio.save(next);
    return toCard(next);
  });
}

export async function moveChildShellPortfolioCardEarlier(input: {
  readonly unitOfWork: UnitOfWorkFactory;
  readonly portfolioItemId: EntityId;
  readonly ownerAppUserId: ActorId;
  readonly childPrivateModeActive?: boolean;
}): Promise<ChildShellPortfolioCard[]> {
  const active = input.childPrivateModeActive ?? false;
  requireActiveMode(active);
  return input.unitOfWork.run(async (uow) => {
    const current = assertOwnedItem(
      await uow.portfolio.getById(input.portfolioItemId),
      input.ownerAppUserId,
    );
    const siblings = (await uow.portfolio.listByChild(current.childId)).filter(
      (item) => item.ownerAppUserId === input.ownerAppUserId,
    );
    const reordered = movePortfolioItemEarlier(siblings, input.portfolioItemId);
    for (const item of reordered) {
      const before = siblings.find((row) => row.portfolioItemId === item.portfolioItemId);
      if (!before || before.sortIndex !== item.sortIndex) {
        await uow.portfolio.save(item);
      }
    }
    return listPortfolioForChild(reordered, current.childId).map(toCard);
  });
}
