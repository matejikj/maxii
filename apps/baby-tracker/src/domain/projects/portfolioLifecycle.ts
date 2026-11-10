import { AppError } from '../errors';
import type { ActorId, ChildId, EntityId } from '../ids';
import type { Instant } from '../ports/clock';
import { PROJECT_LIMITS, type PortfolioItem, type Project } from './types';

/**
 * Portfolio cards are an explicit selection — never an automatic performance
 * history. Visibility stays private until a separate share snapshot is published.
 */
export function createPortfolioItem(input: {
  portfolioItemId: EntityId;
  project: Project;
  title: string;
  description?: string | null;
  ownerAppUserId: ActorId | null;
  now: Instant;
  childPrivateModeActive: boolean;
}): PortfolioItem {
  if (input.project.scope === 'childPrivate' && !input.childPrivateModeActive) {
    throw new AppError('UNAVAILABLE', 'Child private workspace is not activated', {
      details: { reason: 'child_mode_inactive' },
    });
  }
  const title = input.title.trim();
  if (!title) {
    throw new AppError('VALIDATION', 'Portfolio title is required', {
      details: { reason: 'empty_portfolio_title' },
    });
  }
  if (title.length > PROJECT_LIMITS.portfolioTitleMaxChars) {
    throw new AppError('VALIDATION', 'Portfolio title is too long', {
      details: { reason: 'portfolio_title_length' },
    });
  }
  const description = input.description?.trim() || null;
  if (
    description != null &&
    description.length > PROJECT_LIMITS.portfolioDescriptionMaxChars
  ) {
    throw new AppError('VALIDATION', 'Portfolio description is too long', {
      details: { reason: 'portfolio_description_length' },
    });
  }
  return {
    portfolioItemId: input.portfolioItemId,
    projectId: input.project.projectId,
    childId: input.project.childId,
    ownerAppUserId: input.ownerAppUserId,
    title,
    description,
    visibility: 'private',
    // New selections append after existing cards; the owner can move them later.
    sortIndex: input.now.epochMs,
    createdAt: input.now,
  };
}

export function portfolioSortKey(item: PortfolioItem): number {
  return item.sortIndex ?? item.createdAt.epochMs;
}

export function listPortfolioForChild(
  items: readonly PortfolioItem[],
  childId: ChildId,
): PortfolioItem[] {
  return items
    .filter((item) => item.childId === childId)
    .slice()
    .sort((a, b) => portfolioSortKey(a) - portfolioSortKey(b));
}

/** Local title/description filter — never a ranking of children. */
export function filterPortfolioByQuery(
  items: readonly PortfolioItem[],
  query: string,
): PortfolioItem[] {
  const needle = query.trim().toLocaleLowerCase('cs');
  if (!needle) return [...items];
  return items.filter((item) => {
    const haystack = `${item.title} ${item.description ?? ''}`.toLocaleLowerCase('cs');
    return haystack.includes(needle);
  });
}

export function updatePortfolioItemDetails(
  item: PortfolioItem,
  input: { title: string; description?: string | null | undefined },
): PortfolioItem {
  const title = input.title.trim();
  if (!title) {
    throw new AppError('VALIDATION', 'Portfolio title is required', {
      details: { reason: 'empty_portfolio_title' },
    });
  }
  if (title.length > PROJECT_LIMITS.portfolioTitleMaxChars) {
    throw new AppError('VALIDATION', 'Portfolio title is too long', {
      details: { reason: 'portfolio_title_length' },
    });
  }
  const description =
    input.description === undefined
      ? item.description
      : input.description?.trim() || null;
  if (
    description != null &&
    description.length > PROJECT_LIMITS.portfolioDescriptionMaxChars
  ) {
    throw new AppError('VALIDATION', 'Portfolio description is too long', {
      details: { reason: 'portfolio_description_length' },
    });
  }
  return { ...item, title, description };
}

/**
 * Move one card earlier in the owner's ordered list by swapping sort keys with
 * the previous neighbour. No-op when already first or missing.
 */
export function movePortfolioItemEarlier(
  items: readonly PortfolioItem[],
  portfolioItemId: EntityId,
): PortfolioItem[] {
  const target = items.find((row) => row.portfolioItemId === portfolioItemId);
  if (!target) return items.map((row) => ({ ...row }));
  const ordered = listPortfolioForChild(items, target.childId);
  const index = ordered.findIndex((row) => row.portfolioItemId === portfolioItemId);
  if (index <= 0) return items.map((row) => ({ ...row }));
  const current = ordered[index]!;
  const previous = ordered[index - 1]!;
  const currentKey = portfolioSortKey(current);
  const previousKey = portfolioSortKey(previous);
  return items.map((row) => {
    if (row.portfolioItemId === current.portfolioItemId) {
      return { ...row, sortIndex: previousKey };
    }
    if (row.portfolioItemId === previous.portfolioItemId) {
      return { ...row, sortIndex: currentKey };
    }
    return row;
  });
}
