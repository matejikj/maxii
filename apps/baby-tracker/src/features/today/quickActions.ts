import type { UnitOfWorkFactory } from '../../domain';

export const QUICK_ACTION_IDS = ['feeding', 'sleep', 'diaper', 'experience'] as const;

export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

export const DEFAULT_QUICK_ACTIONS: readonly QuickActionId[] = [
  'feeding',
  'sleep',
  'diaper',
  'experience',
];

const META_KEY = 'quick_actions_order_v1';

/** Stable four-slot order. Frequency never reshuffles this list. */
export function normalizeQuickActionOrder(raw: unknown): QuickActionId[] {
  const seen = new Set<QuickActionId>();
  const ordered: QuickActionId[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (
        typeof item === 'string' &&
        (QUICK_ACTION_IDS as readonly string[]).includes(item) &&
        !seen.has(item as QuickActionId)
      ) {
        seen.add(item as QuickActionId);
        ordered.push(item as QuickActionId);
      }
    }
  }
  for (const id of DEFAULT_QUICK_ACTIONS) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered.slice(0, DEFAULT_QUICK_ACTIONS.length);
}

export async function loadQuickActionOrder(
  unitOfWork: UnitOfWorkFactory,
): Promise<QuickActionId[]> {
  const raw = await unitOfWork.run((uow) => uow.meta.get(META_KEY));
  if (!raw) return [...DEFAULT_QUICK_ACTIONS];
  try {
    return normalizeQuickActionOrder(JSON.parse(raw) as unknown);
  } catch {
    return [...DEFAULT_QUICK_ACTIONS];
  }
}

export async function saveQuickActionOrder(
  unitOfWork: UnitOfWorkFactory,
  order: readonly QuickActionId[],
): Promise<QuickActionId[]> {
  const normalized = normalizeQuickActionOrder(order);
  await unitOfWork.run((uow) => uow.meta.set(META_KEY, JSON.stringify(normalized)));
  return normalized;
}

/** Move one action earlier; wraps so the four slots stay filled. */
export function moveQuickActionEarlier(
  order: readonly QuickActionId[],
  id: QuickActionId,
): QuickActionId[] {
  const next = [...normalizeQuickActionOrder(order)];
  const index = next.indexOf(id);
  if (index <= 0) return next;
  const swap = next[index - 1]!;
  next[index - 1] = id;
  next[index] = swap;
  return next;
}
