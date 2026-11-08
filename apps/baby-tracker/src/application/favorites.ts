import type { ChildId, EntityId, Favorite, UnitOfWorkFactory } from '../domain';
import { asEntityId, asTimeZoneId, createFavorite, zonedInstant } from '../domain';

export const META_FAVORITES_PREFIX = 'favorites_v1:';

type StoredFavorite = {
  favoriteId: string;
  activityId: string;
  createdAtMs: number;
};

function metaKey(childId: ChildId): string {
  return `${META_FAVORITES_PREFIX}${childId}`;
}

function parseList(raw: string | null): StoredFavorite[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredFavorite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toFavorite(childId: ChildId, row: StoredFavorite): Favorite {
  return createFavorite({
    favoriteId: asEntityId(row.favoriteId),
    childId,
    activityId: row.activityId,
    createdAt: zonedInstant({ epochMs: row.createdAtMs }, asTimeZoneId('UTC')),
  });
}

export async function listFavorites(
  unitOfWork: UnitOfWorkFactory,
  childId: ChildId,
): Promise<Favorite[]> {
  return unitOfWork.run(async (uow) => {
    return parseList(await uow.meta.get(metaKey(childId))).map((row) => toFavorite(childId, row));
  });
}

/**
 * Bookmark without a due date. Favorites never force an activity into today's
 * recommendation when hard eligibility fails.
 */
export async function addFavorite(
  unitOfWork: UnitOfWorkFactory,
  input: {
    childId: ChildId;
    activityId: string;
    favoriteId?: EntityId;
    nowMs: number;
  },
): Promise<Favorite[]> {
  return unitOfWork.run(async (uow) => {
    const key = metaKey(input.childId);
    const rows = parseList(await uow.meta.get(key));
    if (rows.some((row) => row.activityId === input.activityId)) {
      return rows.map((row) => toFavorite(input.childId, row));
    }
    const next: StoredFavorite[] = [
      {
        favoriteId: String(input.favoriteId ?? `fav_${input.nowMs}`),
        activityId: input.activityId,
        createdAtMs: input.nowMs,
      },
      ...rows,
    ];
    await uow.meta.set(key, JSON.stringify(next));
    return next.map((row) => toFavorite(input.childId, row));
  });
}

export async function removeFavorite(
  unitOfWork: UnitOfWorkFactory,
  input: { childId: ChildId; activityId: string },
): Promise<Favorite[]> {
  return unitOfWork.run(async (uow) => {
    const key = metaKey(input.childId);
    const rows = parseList(await uow.meta.get(key)).filter(
      (row) => row.activityId !== input.activityId,
    );
    await uow.meta.set(key, JSON.stringify(rows));
    return rows.map((row) => toFavorite(input.childId, row));
  });
}
