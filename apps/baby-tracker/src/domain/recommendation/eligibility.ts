import type { RecommendableCandidate, SuitabilityConditionLike } from './candidate';
import type {
  EligibilityDecision,
  ParentRecommendationContext,
  RecommendationReasonCode,
} from './types';

/**
 * Hard eligibility first. An unknown required fact is never treated as true —
 * missing birth date fails `requires_birth_date` instead of inventing an age.
 */
export function evaluateEligibility(
  candidate: RecommendableCandidate,
  context: ParentRecommendationContext,
): EligibilityDecision {
  const reasonCodes: RecommendationReasonCode[] = [];

  if (!candidate.recommendable) {
    return {
      activityId: candidate.activityId,
      revisionId: candidate.revisionId,
      eligible: false,
      reasonCodes: ['revision_not_recommendable'],
    };
  }

  if (context.excludedActivityIds.includes(candidate.activityId)) {
    return {
      activityId: candidate.activityId,
      revisionId: candidate.revisionId,
      eligible: false,
      reasonCodes: ['user_excluded'],
    };
  }

  for (const condition of candidate.suitability) {
    const result = evaluateCondition(condition, candidate, context);
    if (!result.ok) {
      return {
        activityId: candidate.activityId,
        revisionId: candidate.revisionId,
        eligible: false,
        reasonCodes: result.reasonCodes,
      };
    }
    reasonCodes.push(...result.reasonCodes);
  }

  // Editorial age window is also a hard bound even when suitability omits it.
  if (context.birthDateKnown && context.ageMonths != null) {
    if (
      context.ageMonths < candidate.ageMonths.fromInclusive ||
      context.ageMonths > candidate.ageMonths.toInclusive
    ) {
      return {
        activityId: candidate.activityId,
        revisionId: candidate.revisionId,
        eligible: false,
        reasonCodes: ['age_out_of_activity'],
      };
    }
    if (!reasonCodes.includes('age_match')) reasonCodes.push('age_match');
  }

  if (context.withoutMaterialsOnly && candidate.materials.length > 0) {
    return {
      activityId: candidate.activityId,
      revisionId: candidate.revisionId,
      eligible: false,
      reasonCodes: ['materials_required'],
    };
  }

  if (context.environments.length > 0) {
    const overlap = candidate.environments.some((environment) =>
      context.environments.includes(environment),
    );
    if (!overlap) {
      return {
        activityId: candidate.activityId,
        revisionId: candidate.revisionId,
        eligible: false,
        reasonCodes: ['environment_mismatch'],
      };
    }
  }

  if (
    context.durationPreference != null &&
    candidate.duration.kind !== context.durationPreference
  ) {
    return {
      activityId: candidate.activityId,
      revisionId: candidate.revisionId,
      eligible: false,
      reasonCodes: ['duration_mismatch'],
    };
  }

  reasonCodes.push('eligible');
  return {
    activityId: candidate.activityId,
    revisionId: candidate.revisionId,
    eligible: true,
    reasonCodes: unique(reasonCodes),
  };
}

function evaluateCondition(
  condition: SuitabilityConditionLike,
  candidate: RecommendableCandidate,
  context: ParentRecommendationContext,
): { ok: boolean; reasonCodes: RecommendationReasonCode[] } {
  switch (condition.kind) {
    case 'requires_birth_date':
      if (!context.birthDateKnown || context.ageMonths == null) {
        return { ok: false, reasonCodes: ['missing_birth_date'] };
      }
      return { ok: true, reasonCodes: [] };
    case 'age_months': {
      if (!context.birthDateKnown || context.ageMonths == null) {
        return { ok: false, reasonCodes: ['missing_birth_date'] };
      }
      if (
        context.ageMonths < condition.fromInclusive ||
        context.ageMonths > condition.toInclusive
      ) {
        return { ok: false, reasonCodes: ['age_out_of_activity'] };
      }
      return { ok: true, reasonCodes: ['age_match'] };
    }
    case 'environment_one_of': {
      if (context.environments.length === 0) {
        // No caregiver filter means the activity's declared environments stand.
        return { ok: true, reasonCodes: [] };
      }
      const overlap = condition.environments.some((environment) =>
        context.environments.includes(environment),
      );
      return overlap
        ? { ok: true, reasonCodes: [] }
        : { ok: false, reasonCodes: ['environment_mismatch'] };
    }
    case 'materials_none':
      if (candidate.materials.length > 0) {
        return { ok: false, reasonCodes: ['materials_required'] };
      }
      return { ok: true, reasonCodes: [] };
    case 'materials_all_of': {
      const missing = condition.materials.some(
        (material) => !context.availableMaterials.includes(material),
      );
      if (missing) {
        return { ok: false, reasonCodes: ['materials_missing'] };
      }
      return { ok: true, reasonCodes: [] };
    }
    case 'readiness_confirmed': {
      const state = context.readinessByKey[condition.key] ?? 'unknown';
      if (state === 'yes') {
        return { ok: true, reasonCodes: [] };
      }
      if (state === 'no') {
        return { ok: false, reasonCodes: ['readiness_not_confirmed'] };
      }
      return { ok: false, reasonCodes: ['readiness_unknown'] };
    }
    default: {
      // Exhaustiveness: unknown condition kinds must fail closed.
      const _exhaustive: never = condition;
      void _exhaustive;
      return { ok: false, reasonCodes: ['unknown_required_condition'] };
    }
  }
}

function unique(codes: RecommendationReasonCode[]): RecommendationReasonCode[] {
  return [...new Set(codes)];
}
