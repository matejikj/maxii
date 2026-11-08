import type { DevelopmentArea } from '../entities/development';
import type { ContentDurationLike, ContentEnvironmentLike } from './candidate';

/** Versioned ranking/eligibility rules. Same inputs + version ⇒ same offers. */
export const RECOMMENDATION_RULES_VERSION = 'lumi.recommendation.rules.v1';

/**
 * Machine-readable exclusion/selection reasons. Never include child names,
 * notes, or free-text caregiver observations.
 */
export type RecommendationReasonCode =
  | 'eligible'
  | 'age_match'
  | 'interest_area'
  | 'favorite_boost'
  | 'diversity_area'
  | 'repeat_ok'
  | 'missing_birth_date'
  | 'age_out_of_content_window'
  | 'age_out_of_activity'
  | 'environment_mismatch'
  | 'materials_required'
  | 'materials_missing'
  | 'duration_mismatch'
  | 'revision_not_recommendable'
  | 'user_excluded'
  | 'unknown_required_condition'
  | 'empty_catalog'
  | 'profile_changed'
  | 'revision_withdrawn'
  | 'sleep_later'
  | 'care_only_today'
  | 'single_eligible'
  | 'no_eligible_candidates';

export type ParentRecommendationContext = {
  /** Calendar age in completed months when birth date is known; otherwise null. */
  ageMonths: number | null;
  birthDateKnown: boolean;
  /** True when the child is still inside the first published content window. */
  withinContentWindow: boolean | null;
  /** Optional caregiver filters — empty means no filter (not “unknown”). */
  environments: ContentEnvironmentLike[];
  /** Materials the caregiver says are available right now. */
  availableMaterials: string[];
  /** When true, only activities that need no materials remain. */
  withoutMaterialsOnly: boolean;
  interestAreas: DevelopmentArea[];
  favoriteActivityIds: string[];
  /** Stable activity ids the caregiver asked not to see. */
  excludedActivityIds: string[];
  /** Recent activity ids used only for soft diversity, never as a deficit. */
  recentlyTriedActivityIds: string[];
  lastPrimaryArea: DevelopmentArea | null;
  /** Active sleep session changes presentation, not eligibility. */
  sleepRunning: boolean;
  durationPreference: ContentDurationLike['kind'] | null;
};

export type EligibilityDecision = {
  activityId: string;
  revisionId: string;
  eligible: boolean;
  reasonCodes: RecommendationReasonCode[];
};

export type RankedCandidate = {
  activityId: string;
  revisionId: string;
  score: number;
  reasonCodes: RecommendationReasonCode[];
};

export type SelectionResult = {
  offers: Array<{
    activityId: string;
    activityRevisionId: string;
    reasonCodes: RecommendationReasonCode[];
  }>;
  rejected: EligibilityDecision[];
  emptyReasonCodes: RecommendationReasonCode[];
};
