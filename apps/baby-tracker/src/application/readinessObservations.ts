import type { ChildId, UnitOfWorkFactory } from '../domain';
import type { ReadinessKey, ReadinessState } from '../content/model/types';
import { READINESS_KEYS } from '../content/model/types';

export const META_READINESS_PREFIX = 'readiness_v1:';

type StoredReadiness = Partial<Record<ReadinessKey, 'yes' | 'no'>>;

function metaKey(childId: ChildId): string {
  return `${META_READINESS_PREFIX}${childId}`;
}

function parseMap(raw: string | null): StoredReadiness {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed == null || typeof parsed !== 'object') return {};
    const out: StoredReadiness = {};
    for (const key of READINESS_KEYS) {
      const value = parsed[key];
      if (value === 'yes' || value === 'no') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Load caregiver readiness observations for recommendation context. */
export async function loadReadinessByKey(
  unitOfWork: UnitOfWorkFactory,
  childId: ChildId,
): Promise<Partial<Record<string, ReadinessState>>> {
  return unitOfWork.run(async (uow) => parseMap(await uow.meta.get(metaKey(childId))));
}

/**
 * Persist an explicit yes/no observation. Clearing restores unknown and must
 * immediately keep readiness-gated activities out of auto-recommendation.
 */
export async function setReadinessObservation(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; key: ReadinessKey; state: 'yes' | 'no' },
): Promise<Partial<Record<string, ReadinessState>>> {
  return unitOfWork.run(async (uow) => {
    const key = metaKey(input.childId);
    const current = parseMap(await uow.meta.get(key));
    const next: StoredReadiness = { ...current, [input.key]: input.state };
    await uow.meta.set(key, JSON.stringify(next));
    return next;
  });
}

export async function clearReadinessObservation(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; key: ReadinessKey },
): Promise<Partial<Record<string, ReadinessState>>> {
  return unitOfWork.run(async (uow) => {
    const key = metaKey(input.childId);
    const current = parseMap(await uow.meta.get(key));
    const next: StoredReadiness = { ...current };
    delete next[input.key];
    await uow.meta.set(key, JSON.stringify(next));
    return next;
  });
}
