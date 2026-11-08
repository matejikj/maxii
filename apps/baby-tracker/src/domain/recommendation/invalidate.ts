import type { RecommendableCandidate } from './candidate';
import { evaluateEligibility } from './eligibility';
import type { ParentRecommendationContext, RecommendationReasonCode } from './types';
import type { RecommendationSet } from '../entities/development';

export type InvalidationCheck = {
  stillValid: boolean;
  reasonCodes: RecommendationReasonCode[];
};

/**
 * Re-check stored offers against current profile/catalog. Does not invent a new
 * set while a form is open — callers keep the open surface and surface the codes.
 */
export function checkRecommendationSetValidity(
  set: RecommendationSet,
  catalogByRevisionId: Map<string, RecommendableCandidate>,
  context: ParentRecommendationContext,
): InvalidationCheck {
  if (set.offers.length === 0) {
    return { stillValid: true, reasonCodes: [] };
  }

  const reasonCodes: RecommendationReasonCode[] = [];

  for (const offer of set.offers) {
    const candidate = catalogByRevisionId.get(offer.activityRevisionId);
    if (!candidate || !candidate.recommendable) {
      reasonCodes.push('revision_withdrawn');
      continue;
    }
    const decision = evaluateEligibility(candidate, context);
    if (!decision.eligible) {
      if (decision.reasonCodes.includes('age_out_of_activity')) {
        reasonCodes.push('profile_changed');
      } else if (decision.reasonCodes.includes('missing_birth_date')) {
        reasonCodes.push('missing_birth_date');
      } else {
        reasonCodes.push('profile_changed');
      }
    }
  }

  const unique = [...new Set(reasonCodes)];
  return {
    stillValid: unique.length === 0,
    reasonCodes: unique,
  };
}
