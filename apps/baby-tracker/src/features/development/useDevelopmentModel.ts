import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ChildId,
  ContentDurationLike,
  ContentEnvironmentLike,
  ExperienceCareEvent,
  Favorite,
  TimeZoneId,
  WeeklyDevelopmentGlance,
} from '../../domain';
import { asTimeZoneId, todayInZone } from '../../domain';
import type { DailyRecommendationView } from '../../application';
import {
  addFavorite,
  buildParentRecommendationContext,
  candidatesFromRevisions,
  ensureDailyRecommendationSet,
  findTodaysExperienceForActivity,
  hideDailyRecommendationForCare,
  listFavorites,
  loadWeeklyDevelopmentGlance,
  removeFavorite,
  replaceDailyRecommendationSet,
} from '../../application';
import type { ActivityRevision } from '../../content';
import {
  LOCAL_LIBRARY_CONTENT_VERSION,
  LOCAL_LIBRARY_REVISIONS,
} from '../../content';
import { useCompositionRoot } from '../../app/providers';
import { useBootstrap, usePersonalRuntime } from '../../app/session/BootstrapContext';

export type SituationFilters = {
  duration: ContentDurationLike['kind'] | null;
  environments: ContentEnvironmentLike[];
  withoutMaterialsOnly: boolean;
};

const EMPTY_FILTERS: SituationFilters = {
  duration: null,
  environments: [],
  withoutMaterialsOnly: false,
};

export function useDevelopmentModel() {
  const { profile } = useBootstrap();
  const { services } = useCompositionRoot();
  const runtime = usePersonalRuntime();
  const childId = profile?.childId ?? null;
  const zone = asTimeZoneId(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const [filters, setFilters] = useState<SituationFilters>(EMPTY_FILTERS);
  const [recommendation, setRecommendation] = useState<DailyRecommendationView | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [glance, setGlance] = useState<WeeklyDevelopmentGlance | null>(null);
  const [todayByActivity, setTodayByActivity] = useState<Record<string, ExperienceCareEvent | null>>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const library = useMemo(() => LOCAL_LIBRARY_REVISIONS, []);
  const catalog = useMemo(
    () => ({
      contentVersion: LOCAL_LIBRARY_CONTENT_VERSION,
      candidates: candidatesFromRevisions(library),
    }),
    [library],
  );

  const localDay = useMemo(() => todayInZone(services.clock.now(), zone), [services.clock, zone]);

  const revisionById = useMemo(() => {
    const map = new Map<string, ActivityRevision>();
    for (const revision of library) map.set(revision.revisionId, revision);
    return map;
  }, [library]);

  const activityById = useMemo(() => {
    const map = new Map<string, ActivityRevision>();
    for (const revision of library) map.set(revision.activityId, revision);
    return map;
  }, [library]);

  const filteredLibrary = useMemo(() => {
    return library.filter((revision) => matchesLibraryFilters(revision, filters));
  }, [filters, library]);

  const reload = useCallback(async () => {
    if (!childId || !profile || !runtime.unitOfWork) return;
    setBusy(true);
    setError(null);
    try {
      const existingFavorites = await listFavorites(runtime.unitOfWork, childId);
      const context = buildParentRecommendationContext(profile, localDay, {
        environments: filters.environments,
        withoutMaterialsOnly: filters.withoutMaterialsOnly,
        durationPreference: filters.duration,
        favoriteActivityIds: existingFavorites.map((favorite) => favorite.activityId),
        sleepRunning: false,
      });
      const [rec, week] = await Promise.all([
        ensureDailyRecommendationSet(runtime.unitOfWork, {
          childId,
          localDay,
          context,
          catalog,
          nowSeed: `dev-${localDay.year}${localDay.month}${localDay.day}`,
        }),
        loadWeeklyDevelopmentGlance(runtime.unitOfWork, {
          childId,
          endDay: localDay,
          summaryTimeZone: zone,
        }),
      ]);
      setRecommendation(rec);
      setFavorites(existingFavorites);
      setGlance(week);

      const experienceMap: Record<string, ExperienceCareEvent | null> = {};
      for (const offer of rec.set.offers) {
        experienceMap[offer.activityId] = await findTodaysExperienceForActivity(
          runtime.unitOfWork,
          {
            childId,
            activityId: offer.activityId,
            day: localDay,
            summaryTimeZone: zone,
          },
        );
      }
      setTodayByActivity(experienceMap);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nepodařilo se načíst Rozvoj.');
    } finally {
      setBusy(false);
    }
  }, [catalog, childId, filters, localDay, profile, runtime.unitOfWork, zone]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function replaceOffer() {
    if (!childId || !profile || !runtime.unitOfWork) return;
    const context = buildParentRecommendationContext(profile, localDay, {
      environments: filters.environments,
      withoutMaterialsOnly: filters.withoutMaterialsOnly,
      durationPreference: filters.duration,
      favoriteActivityIds: favorites.map((favorite) => favorite.activityId),
    });
    const next = await replaceDailyRecommendationSet(runtime.unitOfWork, {
      childId,
      localDay,
      context,
      catalog,
      nowSeed: `replace-${services.clock.now().epochMs}`,
    });
    setRecommendation(next);
  }

  async function hideForCare() {
    if (!childId || !runtime.unitOfWork) return;
    const hidden = await hideDailyRecommendationForCare(runtime.unitOfWork, {
      childId,
      localDay,
    });
    if (hidden) setRecommendation(hidden);
  }

  async function toggleFavorite(activityId: string) {
    if (!childId || !runtime.unitOfWork) return;
    const exists = favorites.some((favorite) => favorite.activityId === activityId);
    const next = exists
      ? await removeFavorite(runtime.unitOfWork, { childId, activityId })
      : await addFavorite(runtime.unitOfWork, {
          childId,
          activityId,
          nowMs: services.clock.now().epochMs,
        });
    setFavorites(next);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return {
    childId: childId as ChildId | null,
    zone: zone as TimeZoneId,
    localDay,
    filters,
    setFilters,
    clearFilters,
    recommendation,
    favorites,
    glance,
    todayByActivity,
    setTodayByActivity,
    filteredLibrary,
    revisionById,
    activityById,
    library,
    busy,
    error,
    reload,
    replaceOffer,
    hideForCare,
    toggleFavorite,
  };
}

function matchesLibraryFilters(revision: ActivityRevision, filters: SituationFilters): boolean {
  if (filters.withoutMaterialsOnly && revision.materials.length > 0) return false;
  if (filters.duration != null && revision.duration.kind !== filters.duration) return false;
  if (filters.environments.length > 0) {
    const overlap = revision.environments.some((environment) =>
      filters.environments.includes(environment),
    );
    if (!overlap) return false;
  }
  return true;
}
