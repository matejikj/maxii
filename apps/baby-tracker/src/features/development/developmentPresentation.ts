import type { ActivityRevision } from '../../content';
import type { DevelopmentArea } from '../../domain';

export type LibrarySelection = {
  query: string;
  area: DevelopmentArea | null;
  favoritesOnly: boolean;
};

function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs-CZ');
}

/** Search only published library metadata, never a child's diary. All criteria intersect. */
export function selectLibraryActivities(
  library: readonly ActivityRevision[],
  selection: LibrarySelection,
  favoriteIds: ReadonlySet<string>,
): ActivityRevision[] {
  const words = searchable(selection.query.trim()).split(/\s+/).filter(Boolean);
  return library.filter((revision) => {
    if (selection.area && revision.primaryArea !== selection.area) return false;
    if (selection.favoritesOnly && !favoriteIds.has(revision.activityId)) return false;
    const text = searchable([revision.title, ...revision.materials].join(' '));
    return words.every((word) => text.includes(word));
  });
}

export function activityDurationLabel(revision: ActivityRevision): string {
  return revision.duration.kind === 'moment' ? 'Chvilka' : `${revision.duration.minutes} min`;
}

export function activityAgeLabel(revision: ActivityRevision): string {
  const { fromInclusive, toInclusive } = revision.ageMonths;
  return `${fromInclusive}–${toInclusive} měsíců`;
}

export function activityCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'aktivita' : count >= 2 && count <= 4 ? 'aktivity' : 'aktivit'}`;
}
