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
    createdAt: input.now,
  };
}

export function listPortfolioForChild(
  items: readonly PortfolioItem[],
  childId: ChildId,
): PortfolioItem[] {
  return items.filter((item) => item.childId === childId);
}
