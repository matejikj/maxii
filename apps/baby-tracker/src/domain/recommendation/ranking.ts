import type { RecommendableCandidate } from './candidate';
import { evaluateEligibility } from './eligibility';
import type {
  EligibilityDecision,
  ParentRecommendationContext,
  RankedCandidate,
  RecommendationReasonCode,
  SelectionResult,
} from './types';

/**
 * Soft ranking over already eligible candidates. Favorites and interests never
 * revive a hard exclusion — eligibility runs first and alone decides the pool.
 */
export function selectDailyOffers(
  candidates: RecommendableCandidate[],
  context: ParentRecommendationContext,
  options: { maxOffers?: number } = {},
): SelectionResult {
  const maxOffers = options.maxOffers ?? 3;
  const rejected: EligibilityDecision[] = [];
  const eligible: RankedCandidate[] = [];

  if (candidates.length === 0) {
    return {
      offers: [],
      rejected: [],
      emptyReasonCodes: ['empty_catalog'],
    };
  }

  if (context.withinContentWindow === false) {
    return {
      offers: [],
      rejected: [],
      emptyReasonCodes: ['age_out_of_content_window'],
    };
  }

  for (const candidate of candidates) {
    const decision = evaluateEligibility(candidate, context);
    if (!decision.eligible) {
      rejected.push(decision);
      continue;
    }
    eligible.push(rankCandidate(candidate, decision.reasonCodes, context));
  }

  eligible.sort(compareRanked);

  const offers: SelectionResult['offers'] = [];
  const usedActivities = new Set<string>();
  const usedFamilies = new Set<string>();
  for (const candidate of eligible) {
    if (usedActivities.has(candidate.activityId)) continue;
    const familyId = candidate.activityFamilyId ?? null;
    // Related motifs share one daily slot so three variants are not three alternatives.
    if (familyId && usedFamilies.has(familyId)) continue;
    usedActivities.add(candidate.activityId);
    if (familyId) usedFamilies.add(familyId);
    const reasonCodes = [...candidate.reasonCodes];
    if (eligible.length === 1) reasonCodes.push('single_eligible');
    offers.push({
      activityId: candidate.activityId,
      activityRevisionId: candidate.revisionId,
      reasonCodes: unique(reasonCodes),
    });
    if (offers.length >= maxOffers) break;
  }

  return {
    offers,
    rejected,
    emptyReasonCodes:
      offers.length === 0 ? emptyReasonsFromRejected(rejected, context) : [],
  };
}

function emptyReasonsFromRejected(
  rejected: EligibilityDecision[],
  context: ParentRecommendationContext,
): RecommendationReasonCode[] {
  if (!context.birthDateKnown) return ['missing_birth_date'];
  if (rejected.every((item) => item.reasonCodes.includes('missing_birth_date'))) {
    return ['missing_birth_date'];
  }
  return ['no_eligible_candidates'];
}

function rankCandidate(
  candidate: RecommendableCandidate,
  eligibilityReasons: RecommendationReasonCode[],
  context: ParentRecommendationContext,
): RankedCandidate {
  let score = 0;
  const reasonCodes = [...eligibilityReasons];

  if (context.interestAreas.includes(candidate.primaryArea)) {
    score += 40;
    reasonCodes.push('interest_area');
  } else if (candidate.relatedAreas.some((area) => context.interestAreas.includes(area))) {
    score += 20;
    reasonCodes.push('interest_area');
  }

  if (context.favoriteActivityIds.includes(candidate.activityId)) {
    score += 25;
    reasonCodes.push('favorite_boost');
  }

  if (
    context.lastPrimaryArea != null &&
    candidate.primaryArea !== context.lastPrimaryArea
  ) {
    score += 15;
    reasonCodes.push('diversity_area');
  }

  if (context.recentlyTriedActivityIds.includes(candidate.activityId)) {
    score -= 30;
  } else {
    reasonCodes.push('repeat_ok');
  }

  // Stable secondary key lives in compareRanked; score stays preference-only.
  return {
    activityId: candidate.activityId,
    revisionId: candidate.revisionId,
    activityFamilyId: candidate.activityFamilyId ?? null,
    score,
    reasonCodes: unique(reasonCodes),
  };
}

function compareRanked(a: RankedCandidate, b: RankedCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.activityId !== b.activityId) return a.activityId < b.activityId ? -1 : 1;
  return a.revisionId < b.revisionId ? -1 : a.revisionId > b.revisionId ? 1 : 0;
}

function unique(codes: RecommendationReasonCode[]): RecommendationReasonCode[] {
  return [...new Set(codes)];
}
