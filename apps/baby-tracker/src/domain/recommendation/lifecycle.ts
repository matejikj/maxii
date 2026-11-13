import type { EntityId } from '../ids';
import type { RecommendationSet, RecommendationSetStatus } from '../entities/development';
import { createRecommendationSet } from '../entities/development';
import type { RecommendationReasonCode } from './types';

export type OfferPresentation = 'now' | 'later';

/**
 * Opening a card marks interest in reading the activity. It must never mint an
 * experience or mark a skill as mastered.
 */
export function markRecommendationOpened(set: RecommendationSet): RecommendationSet {
  if (set.status === 'hidden' || set.status === 'replaced') return set;
  return { ...set, status: 'opened' };
}

/** “Dnes jen péče” — hide for today without deleting experiences or favorites. */
export function markRecommendationHidden(set: RecommendationSet): RecommendationSet {
  if (set.status === 'replaced') return set;
  return {
    ...set,
    status: 'hidden',
    invalidationReasonCodes: uniqueCodes([...set.invalidationReasonCodes, 'care_only_today']),
  };
}

export function markRecommendationReplaced(
  previous: RecommendationSet,
  nextSetId: EntityId,
): RecommendationSet {
  return {
    ...previous,
    status: 'replaced',
    replacedBySetId: nextSetId,
  };
}

export function withInvalidation(
  set: RecommendationSet,
  reasonCodes: RecommendationReasonCode[],
): RecommendationSet {
  return createRecommendationSet({
    ...set,
    offers: [],
    status: set.status === 'hidden' ? 'hidden' : 'prepared',
    invalidationReasonCodes: uniqueCodes([...set.invalidationReasonCodes, ...reasonCodes]),
  });
}

export function offerPresentation(
  set: RecommendationSet,
  sleepRunning: boolean,
): OfferPresentation {
  if (set.status === 'hidden') return 'later';
  return sleepRunning ? 'later' : 'now';
}

export function isActiveDailySet(status: RecommendationSetStatus): boolean {
  return status === 'prepared' || status === 'opened' || status === 'hidden';
}

function uniqueCodes(codes: string[]): string[] {
  return [...new Set(codes)];
}
