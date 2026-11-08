import type { DevelopmentArea } from '../entities/development';

/** Environments mirrored from content without importing the content package. */
export type ContentEnvironmentLike = 'home' | 'outdoor' | 'travel' | 'quiet';

export type ContentDurationLike =
  | { kind: 'moment' }
  | { kind: 'minutes'; minutes: 5 | 10 | 15 };

export type ReadinessKeyLike =
  | 'grasp'
  | 'release'
  | 'rollAttempt'
  | 'floorSit'
  | 'floorMove'
  | 'gesture';

export type SuitabilityConditionLike =
  | {
      kind: 'age_months';
      fromInclusive: number;
      toInclusive: number;
    }
  | { kind: 'environment_one_of'; environments: ContentEnvironmentLike[] }
  | { kind: 'materials_none' }
  | { kind: 'materials_all_of'; materials: string[] }
  | { kind: 'requires_birth_date' }
  | { kind: 'readiness_confirmed'; key: ReadinessKeyLike };

/**
 * Minimal snapshot the selector needs. Keeps domain free of editorial package
 * imports while still enforcing published-revision hard rules.
 */
export type RecommendableCandidate = {
  activityId: string;
  revisionId: string;
  primaryArea: DevelopmentArea;
  relatedAreas: DevelopmentArea[];
  ageMonths: { fromInclusive: number; toInclusive: number };
  environments: ContentEnvironmentLike[];
  materials: string[];
  duration: ContentDurationLike;
  suitability: SuitabilityConditionLike[];
  /** False for drafts, withdrawn items, and unlabeled development fixtures. */
  recommendable: boolean;
};
