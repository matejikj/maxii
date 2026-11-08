import type {
  CalendarDate,
  ChildId,
  EntityId,
  ParentRecommendationContext,
  RecommendableCandidate,
  RecommendationReasonCode,
  RecommendationSet,
  UnitOfWork,
  UnitOfWorkFactory,
} from '../../domain';
import {
  RECOMMENDATION_RULES_VERSION,
  asEntityId,
  checkRecommendationSetValidity,
  createRecommendationSet,
  formatCalendarDate,
  markRecommendationHidden,
  markRecommendationOpened,
  markRecommendationReplaced,
  offerPresentation,
  selectDailyOffers,
  withInvalidation,
} from '../../domain';
import type { OfferPresentation } from '../../domain';

export const META_RECOMMENDATION_SET_PREFIX = 'recommendation_set_v1:';

export type DailyRecommendationView = {
  set: RecommendationSet;
  presentation: OfferPresentation;
  /** True when stored offers no longer pass hard checks; UI must not auto-swap open forms. */
  stale: boolean;
  staleReasonCodes: RecommendationReasonCode[];
  emptyReasonCodes: RecommendationReasonCode[];
};

export type RecommendationCatalogInput = {
  contentVersion: string;
  candidates: RecommendableCandidate[];
};

function metaKey(childId: ChildId, localDay: CalendarDate): string {
  return `${META_RECOMMENDATION_SET_PREFIX}${childId}:${formatCalendarDate(localDay)}`;
}

function parseStored(raw: string | null): RecommendationSet | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RecommendationSet;
    if (!parsed?.recommendationSetId || !Array.isArray(parsed.offers)) return null;
    return {
      ...parsed,
      status: parsed.status ?? 'prepared',
      replacedBySetId: parsed.replacedBySetId ?? null,
      invalidationReasonCodes: parsed.invalidationReasonCodes ?? [],
    };
  } catch {
    return null;
  }
}

async function saveSet(uow: UnitOfWork, set: RecommendationSet): Promise<void> {
  await uow.meta.set(metaKey(set.childId, set.localDay), JSON.stringify(set));
}

function newSetId(seed: string): EntityId {
  return asEntityId(`recset_${seed}`);
}

function buildSet(input: {
  setId: EntityId;
  childId: ChildId;
  localDay: CalendarDate;
  contentVersion: string;
  context: ParentRecommendationContext;
  candidates: RecommendableCandidate[];
}): { set: RecommendationSet; emptyReasonCodes: RecommendationReasonCode[] } {
  const selected = selectDailyOffers(input.candidates, input.context);
  const set = createRecommendationSet({
    recommendationSetId: input.setId,
    childId: input.childId,
    localDay: input.localDay,
    rulesVersion: RECOMMENDATION_RULES_VERSION,
    contentVersion: input.contentVersion,
    offers: selected.offers,
  });
  return { set, emptyReasonCodes: selected.emptyReasonCodes };
}

/**
 * Load the durable daily set shared by Today and Development. Reopening the
 * screen must not reshuffle; only explicit replace or invalidation rebuilds.
 */
export async function ensureDailyRecommendationSet(
  unitOfWork: UnitOfWorkFactory,
  input: {
    childId: ChildId;
    localDay: CalendarDate;
    context: ParentRecommendationContext;
    catalog: RecommendationCatalogInput;
    /** When true, keep a stale opened set instead of rebuilding underneath a form. */
    formOpen?: boolean;
    nowSeed?: string;
  },
): Promise<DailyRecommendationView> {
  return unitOfWork.run(async (uow) => {
    const existing = parseStored(await uow.meta.get(metaKey(input.childId, input.localDay)));
    const catalogMap = new Map(
      input.catalog.candidates.map((candidate) => [candidate.revisionId, candidate]),
    );

    if (
      existing &&
      existing.rulesVersion === RECOMMENDATION_RULES_VERSION &&
      existing.contentVersion === input.catalog.contentVersion &&
      (existing.status === 'prepared' ||
        existing.status === 'opened' ||
        existing.status === 'hidden')
    ) {
      const validity = checkRecommendationSetValidity(existing, catalogMap, input.context);
      if (!validity.stillValid) {
        if (input.formOpen || existing.status === 'opened') {
          return {
            set: existing,
            presentation: offerPresentation(existing, input.context.sleepRunning),
            stale: true,
            staleReasonCodes: validity.reasonCodes,
            emptyReasonCodes: [],
          };
        }
        const rebuilt = buildSet({
          setId: newSetId(input.nowSeed ?? `${Date.now()}`),
          childId: input.childId,
          localDay: input.localDay,
          contentVersion: input.catalog.contentVersion,
          context: input.context,
          candidates: input.catalog.candidates,
        });
        const invalidated = withInvalidation(existing, validity.reasonCodes);
        await saveSet(uow, invalidated);
        await saveSet(uow, rebuilt.set);
        // Keep only the latest active payload under the day key.
        await saveSet(uow, rebuilt.set);
        return {
          set: rebuilt.set,
          presentation: offerPresentation(rebuilt.set, input.context.sleepRunning),
          stale: false,
          staleReasonCodes: [],
          emptyReasonCodes: rebuilt.emptyReasonCodes,
        };
      }

      return {
        set: existing,
        presentation: offerPresentation(existing, input.context.sleepRunning),
        stale: false,
        staleReasonCodes: [],
        emptyReasonCodes:
          existing.offers.length === 0
            ? (existing.invalidationReasonCodes as RecommendationReasonCode[])
            : [],
      };
    }

    const created = buildSet({
      setId: newSetId(input.nowSeed ?? `${Date.now()}`),
      childId: input.childId,
      localDay: input.localDay,
      contentVersion: input.catalog.contentVersion,
      context: input.context,
      candidates: input.catalog.candidates,
    });
    await saveSet(uow, created.set);
    return {
      set: created.set,
      presentation: offerPresentation(created.set, input.context.sleepRunning),
      stale: false,
      staleReasonCodes: [],
      emptyReasonCodes: created.emptyReasonCodes,
    };
  });
}

/** Parent-triggered swap; previous set becomes replaced and is no longer active. */
export async function replaceDailyRecommendationSet(
  unitOfWork: UnitOfWorkFactory,
  input: {
    childId: ChildId;
    localDay: CalendarDate;
    context: ParentRecommendationContext;
    catalog: RecommendationCatalogInput;
    nowSeed?: string;
  },
): Promise<DailyRecommendationView> {
  return unitOfWork.run(async (uow) => {
    const key = metaKey(input.childId, input.localDay);
    const existing = parseStored(await uow.meta.get(key));
    const nextId = newSetId(input.nowSeed ?? `${Date.now()}`);
    const created = buildSet({
      setId: nextId,
      childId: input.childId,
      localDay: input.localDay,
      contentVersion: input.catalog.contentVersion,
      context: input.context,
      candidates: input.catalog.candidates,
    });
    if (existing) {
      await saveSet(uow, markRecommendationReplaced(existing, nextId));
    }
    await saveSet(uow, created.set);
    return {
      set: created.set,
      presentation: offerPresentation(created.set, input.context.sleepRunning),
      stale: false,
      staleReasonCodes: [],
      emptyReasonCodes: created.emptyReasonCodes,
    };
  });
}

export async function openDailyRecommendation(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; localDay: CalendarDate; sleepRunning?: boolean },
): Promise<DailyRecommendationView | null> {
  return unitOfWork.run(async (uow) => {
    const existing = parseStored(await uow.meta.get(metaKey(input.childId, input.localDay)));
    if (!existing) return null;
    const opened = markRecommendationOpened(existing);
    await saveSet(uow, opened);
    return {
      set: opened,
      presentation: offerPresentation(opened, input.sleepRunning ?? false),
      stale: false,
      staleReasonCodes: [],
      emptyReasonCodes: [],
    };
  });
}

export async function hideDailyRecommendationForCare(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; localDay: CalendarDate },
): Promise<DailyRecommendationView | null> {
  return unitOfWork.run(async (uow) => {
    const existing = parseStored(await uow.meta.get(metaKey(input.childId, input.localDay)));
    if (!existing) return null;
    const hidden = markRecommendationHidden(existing);
    await saveSet(uow, hidden);
    return {
      set: hidden,
      presentation: offerPresentation(hidden, false),
      stale: false,
      staleReasonCodes: [],
      emptyReasonCodes: [],
    };
  });
}

/** Shared read for Today and Development — never rolls a second independent pick. */
export async function readDailyRecommendationSet(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; localDay: CalendarDate; sleepRunning?: boolean },
): Promise<DailyRecommendationView | null> {
  return unitOfWork.run(async (uow) => {
    const existing = parseStored(await uow.meta.get(metaKey(input.childId, input.localDay)));
    if (!existing) return null;
    return {
      set: existing,
      presentation: offerPresentation(existing, input.sleepRunning ?? false),
      stale: false,
      staleReasonCodes: [],
      emptyReasonCodes: [],
    };
  });
}
