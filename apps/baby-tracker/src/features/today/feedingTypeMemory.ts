import type { UnitOfWorkFactory } from '../../domain';

export type FeedingKind = 'nursing' | 'bottle' | 'food';

const META_KEY = 'last_feeding_kind_v1';
const KINDS: readonly FeedingKind[] = ['nursing', 'bottle', 'food'];

/** Remembers which feeding form to open next — never prefills amounts or times. */
export function normalizeFeedingKind(raw: unknown): FeedingKind {
  if (typeof raw === 'string' && (KINDS as readonly string[]).includes(raw)) {
    return raw as FeedingKind;
  }
  return 'nursing';
}

export async function loadLastFeedingKind(unitOfWork: UnitOfWorkFactory): Promise<FeedingKind> {
  const raw = await unitOfWork.run((uow) => uow.meta.get(META_KEY));
  if (!raw) return 'nursing';
  try {
    return normalizeFeedingKind(JSON.parse(raw) as unknown);
  } catch {
    return normalizeFeedingKind(raw);
  }
}

export async function saveLastFeedingKind(
  unitOfWork: UnitOfWorkFactory,
  kind: FeedingKind,
): Promise<FeedingKind> {
  const normalized = normalizeFeedingKind(kind);
  await unitOfWork.run((uow) => uow.meta.set(META_KEY, JSON.stringify(normalized)));
  return normalized;
}
