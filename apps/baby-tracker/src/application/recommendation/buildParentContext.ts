import type {
  CalendarDate,
  ChildProfile,
  DevelopmentArea,
  ParentRecommendationContext,
} from '../../domain';
import { calendarAgeOn, isWithinPublishedContentWindow } from '../../domain';
import type { ContentDurationLike, ContentEnvironmentLike } from '../../domain';

export type RecommendationFilterInput = {
  environments?: ContentEnvironmentLike[];
  availableMaterials?: string[];
  withoutMaterialsOnly?: boolean;
  interestAreas?: DevelopmentArea[];
  favoriteActivityIds?: string[];
  excludedActivityIds?: string[];
  recentlyTriedActivityIds?: string[];
  lastPrimaryArea?: DevelopmentArea | null;
  sleepRunning?: boolean;
  durationPreference?: ContentDurationLike['kind'] | null;
  readinessByKey?: Partial<Record<string, 'yes' | 'no' | 'unknown'>>;
};

/**
 * Derive hard age facts from the profile calendar date — never invent a DOB or
 * clamp older children into the first content window.
 */
export function buildParentRecommendationContext(
  profile: ChildProfile,
  onLocalDay: CalendarDate,
  filters: RecommendationFilterInput = {},
): ParentRecommendationContext {
  const birthDate = profile.birthDate;
  if (!birthDate) {
    return {
      ageMonths: null,
      birthDateKnown: false,
      withinContentWindow: null,
      environments: filters.environments ?? [],
      availableMaterials: filters.availableMaterials ?? [],
      withoutMaterialsOnly: filters.withoutMaterialsOnly ?? false,
      interestAreas: filters.interestAreas ?? [],
      favoriteActivityIds: filters.favoriteActivityIds ?? [],
      excludedActivityIds: filters.excludedActivityIds ?? [],
      recentlyTriedActivityIds: filters.recentlyTriedActivityIds ?? [],
      lastPrimaryArea: filters.lastPrimaryArea ?? null,
      sleepRunning: filters.sleepRunning ?? false,
      durationPreference: filters.durationPreference ?? null,
      readinessByKey: filters.readinessByKey ?? {},
    };
  }

  const age = calendarAgeOn(birthDate, onLocalDay);
  return {
    ageMonths: age.totalMonths,
    birthDateKnown: true,
    withinContentWindow: isWithinPublishedContentWindow(birthDate, onLocalDay),
    environments: filters.environments ?? [],
    availableMaterials: filters.availableMaterials ?? [],
    withoutMaterialsOnly: filters.withoutMaterialsOnly ?? false,
    interestAreas: filters.interestAreas ?? [],
    favoriteActivityIds: filters.favoriteActivityIds ?? [],
    excludedActivityIds: filters.excludedActivityIds ?? [],
    recentlyTriedActivityIds: filters.recentlyTriedActivityIds ?? [],
    lastPrimaryArea: filters.lastPrimaryArea ?? null,
    sleepRunning: filters.sleepRunning ?? false,
    durationPreference: filters.durationPreference ?? null,
    readinessByKey: filters.readinessByKey ?? {},
  };
}
