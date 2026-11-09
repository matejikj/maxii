import type { LumiAnimal } from '../types';
import {
  CHARACTER_APPEARANCE_STYLES,
  STUDIO_ACTION_IDS,
  STUDIO_COLLECTION_COMPAT,
  STUDIO_COLLECTION_VERSION,
  STUDIO_PROP_IDS,
  listStudioActionsForSpecies,
  type CharacterAppearanceStyle,
  type StudioActionId,
} from './studioCollection';
import { CHARACTER_COLLECTION_VERSION, FOREST_PROP_IDS } from './collection';

/**
 * Declarative description of a published character expansion. Product screens
 * resolve style/action through shared helpers — they must not switch on each
 * new collection id individually.
 */
export type CharacterCollectionPublication = {
  readonly collectionVersion: string;
  readonly studioCollectionVersion: string | null;
  readonly compat: {
    readonly minApp: string;
    readonly schema: number;
    readonly forestCollection: string;
  };
  readonly appearanceStyles: readonly CharacterAppearanceStyle[];
  readonly studioActionIds: readonly StudioActionId[];
  readonly studioPropIds: readonly string[];
  readonly forestPropIds: readonly string[];
  readonly readerCapabilities: readonly string[];
};

export function publishCurrentCharacterCollections(): CharacterCollectionPublication {
  return {
    collectionVersion: CHARACTER_COLLECTION_VERSION,
    studioCollectionVersion: STUDIO_COLLECTION_VERSION,
    compat: { ...STUDIO_COLLECTION_COMPAT },
    appearanceStyles: CHARACTER_APPEARANCE_STYLES,
    studioActionIds: STUDIO_ACTION_IDS,
    studioPropIds: STUDIO_PROP_IDS,
    forestPropIds: FOREST_PROP_IDS,
    readerCapabilities: [
      'art.collection.v1',
      'art.studio.v1',
      'art.appearance-styles.v1',
      ...STUDIO_ACTION_IDS.map((id) => `studio.${id}` as const),
      ...STUDIO_PROP_IDS.map((id) => `art.prop.${id}` as const),
    ],
  };
}

/**
 * Future expansions append capability ids here. Unknown ids stay rejected by
 * the installed reader without touching product screen switches.
 */
export function planNextCollectionExpansion(input: {
  readonly nextCollectionVersion: string;
  readonly additionalCapabilities: readonly string[];
  readonly knownInstalled: readonly string[];
}): {
  readonly activates: false;
  readonly reason: 'requires_signed_higher_generation';
  readonly missingCapabilities: readonly string[];
  readonly keepsCurrentGuide: true;
} {
  void input.nextCollectionVersion;
  const missing = input.additionalCapabilities.filter(
    (capability) => !input.knownInstalled.includes(capability),
  );
  return {
    activates: false,
    reason: 'requires_signed_higher_generation',
    missingCapabilities: missing,
    keepsCurrentGuide: true,
  };
}

/** Stable product preference key — screens read this, not hard-coded style enums per feature. */
export function resolvePublishedAppearanceStyle(
  preferred: unknown,
  publication: CharacterCollectionPublication = publishCurrentCharacterCollections(),
): CharacterAppearanceStyle {
  if (
    typeof preferred === 'string' &&
    (publication.appearanceStyles as readonly string[]).includes(preferred)
  ) {
    return preferred as CharacterAppearanceStyle;
  }
  return 'forest';
}

export function studioActionsPublishedForSpecies(
  species: LumiAnimal,
  publication: CharacterCollectionPublication = publishCurrentCharacterCollections(),
): readonly StudioActionId[] {
  const allowed = new Set(publication.studioActionIds);
  return listStudioActionsForSpecies(species)
    .map((action) => action.id)
    .filter((id) => allowed.has(id));
}
