import { AppError } from '../errors';
import type { ChildId, EntityId } from '../ids';
import type { CalendarDate, ZonedInstant } from '../time';

export type DevelopmentArea =
  | 'relationship'
  | 'speech'
  | 'movement'
  | 'senses'
  | 'attention'
  | 'spaceQuantity'
  | 'creationRhythm'
  | 'autonomy';

export type Experience = {
  experienceId: EntityId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  activityId: string | null;
  activityRevisionId: string | null;
  title: string | null;
  area: DevelopmentArea | null;
  note: string | null;
};

export type Observation = {
  observationId: EntityId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  body: string;
};

export type RecommendationOffer = {
  activityId: string;
  activityRevisionId: string;
  reasonCodes: string[];
};

/**
 * At most three distinct offers for one child and local calendar day. Offers
 * are not tasks with deadlines.
 */
export type RecommendationSet = {
  recommendationSetId: EntityId;
  childId: ChildId;
  localDay: CalendarDate;
  rulesVersion: string;
  contentVersion: string;
  offers: RecommendationOffer[];
};

export type Favorite = {
  favoriteId: EntityId;
  childId: ChildId;
  activityId: string;
  createdAt: ZonedInstant;
};

export function createRecommendationSet(input: {
  recommendationSetId: EntityId;
  childId: ChildId;
  localDay: CalendarDate;
  rulesVersion: string;
  contentVersion: string;
  offers: RecommendationOffer[];
}): RecommendationSet {
  if (input.offers.length > 3) {
    throw new AppError('VALIDATION', 'Recommendation set allows at most three offers', {
      details: { reason: 'offer_limit' },
    });
  }
  const ids = new Set(input.offers.map((offer) => offer.activityId));
  if (ids.size !== input.offers.length) {
    throw new AppError('VALIDATION', 'Recommendation offers must be distinct activities', {
      details: { reason: 'duplicate_offer' },
    });
  }
  return {
    recommendationSetId: input.recommendationSetId,
    childId: input.childId,
    localDay: input.localDay,
    rulesVersion: input.rulesVersion,
    contentVersion: input.contentVersion,
    offers: input.offers,
  };
}

export function createObservation(input: {
  observationId: EntityId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  body: string;
}): Observation {
  const body = input.body.trim();
  if (body.length === 0) {
    throw new AppError('VALIDATION', 'Observation needs a short description', {
      details: { reason: 'empty_observation' },
    });
  }
  return {
    observationId: input.observationId,
    childId: input.childId,
    occurredAt: input.occurredAt,
    body,
  };
}

export function createFavorite(input: {
  favoriteId: EntityId;
  childId: ChildId;
  activityId: string;
  createdAt: ZonedInstant;
}): Favorite {
  if (!input.activityId.trim()) {
    throw new AppError('VALIDATION', 'Favorite requires a stable activity id', {
      details: { reason: 'favorite_activity' },
    });
  }
  return {
    favoriteId: input.favoriteId,
    childId: input.childId,
    activityId: input.activityId,
    createdAt: input.createdAt,
  };
}
