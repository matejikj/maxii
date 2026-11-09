import type { LumiAnimal } from '../types';
import type { CharacterExpression, CharacterPose } from './blueprint';
import type { CharacterPropId } from './collection';

/**
 * First workshop expansion of the existing eight guides. Separate from the
 * forest signatureActions tuple so older readers keep their two-action API.
 */
export const STUDIO_COLLECTION_VERSION = 'lumi.characters.studio.v1' as const;
export const STUDIO_COLLECTION_COMPAT = {
  minApp: '0.1.0',
  schema: 1,
  forestCollection: 'lumi.characters.collection.v1',
} as const;

/** Look preference — never an age lock or automatic birthday switch. */
export const CHARACTER_APPEARANCE_STYLES = ['forest', 'workshop', 'restrained'] as const;
export type CharacterAppearanceStyle = (typeof CHARACTER_APPEARANCE_STYLES)[number];

export const STUDIO_PROP_IDS = [
  'routeMap',
  'bridgePieces',
  'notebook',
  'pencil',
  'patternTiles',
  'displayStand',
] as const;
export type StudioPropId = (typeof STUDIO_PROP_IDS)[number];

export const STUDIO_ACTION_IDS = [
  'planPath',
  'tryAlternatePath',
  'bridgeSpan',
  'testBridge',
  'sketchPlan',
  'compareNotes',
  'arrangePattern',
  'presentCreation',
] as const;
export type StudioActionId = (typeof STUDIO_ACTION_IDS)[number];

export type StudioActionDefinition = {
  readonly id: StudioActionId;
  readonly species: LumiAnimal;
  readonly labelCs: string;
  readonly capability: `studio.${StudioActionId}`;
  /** Props held during the static pose (at most two visible). */
  readonly props: readonly CharacterPropId[];
  readonly pose: CharacterPose;
  readonly expression: CharacterExpression;
  readonly semanticHint: 'curiosity' | 'pointContent' | 'listening' | 'gentleJoy';
  readonly durationMs: { readonly min: number; readonly max: number };
};

/**
 * Eight workshop actions for four known guides. Each entry carries a full
 * static pose plus a bounded one-shot motion recipe resolved in studioMotion.
 */
export const STUDIO_ACTIONS: Readonly<Record<StudioActionId, StudioActionDefinition>> = {
  planPath: {
    id: 'planPath',
    species: 'rabbit',
    labelCs: 'Ukázat cestu',
    capability: 'studio.planPath',
    props: ['routeMap'],
    pose: 'planPath',
    expression: 'curious',
    semanticHint: 'curiosity',
    durationMs: { min: 1600, max: 2400 },
  },
  tryAlternatePath: {
    id: 'tryAlternatePath',
    species: 'rabbit',
    labelCs: 'Nabídnout jinou cestu',
    capability: 'studio.tryAlternatePath',
    props: ['routeMap'],
    pose: 'tryAlternatePath',
    expression: 'curious',
    semanticHint: 'curiosity',
    durationMs: { min: 1600, max: 2400 },
  },
  bridgeSpan: {
    id: 'bridgeSpan',
    species: 'bear',
    labelCs: 'Položit most',
    capability: 'studio.bridgeSpan',
    props: ['bridgePieces', 'blocks'],
    pose: 'bridgeSpan',
    expression: 'curious',
    semanticHint: 'pointContent',
    durationMs: { min: 1600, max: 2400 },
  },
  testBridge: {
    id: 'testBridge',
    species: 'bear',
    labelCs: 'Porovnat most',
    capability: 'studio.testBridge',
    props: ['bridgePieces'],
    pose: 'testBridge',
    expression: 'curious',
    semanticHint: 'curiosity',
    durationMs: { min: 1600, max: 2400 },
  },
  sketchPlan: {
    id: 'sketchPlan',
    species: 'owl',
    labelCs: 'Načrtnout plán',
    capability: 'studio.sketchPlan',
    props: ['notebook', 'pencil'],
    pose: 'sketchPlan',
    expression: 'curious',
    semanticHint: 'pointContent',
    durationMs: { min: 1600, max: 2400 },
  },
  compareNotes: {
    id: 'compareNotes',
    species: 'owl',
    labelCs: 'Porovnat zápisky',
    capability: 'studio.compareNotes',
    props: ['notebook'],
    pose: 'compareNotes',
    expression: 'curious',
    semanticHint: 'listening',
    durationMs: { min: 1600, max: 2400 },
  },
  arrangePattern: {
    id: 'arrangePattern',
    species: 'squirrel',
    labelCs: 'Uspořádat vzor',
    capability: 'studio.arrangePattern',
    props: ['patternTiles'],
    pose: 'arrangePattern',
    expression: 'curious',
    semanticHint: 'pointContent',
    durationMs: { min: 1600, max: 2400 },
  },
  presentCreation: {
    id: 'presentCreation',
    species: 'squirrel',
    labelCs: 'Ukázat výtvor',
    capability: 'studio.presentCreation',
    props: ['displayStand', 'blocks'],
    pose: 'presentCreation',
    expression: 'happy',
    semanticHint: 'gentleJoy',
    durationMs: { min: 1600, max: 2400 },
  },
};

export function isStudioActionId(value: unknown): value is StudioActionId {
  return typeof value === 'string' && (STUDIO_ACTION_IDS as readonly string[]).includes(value);
}

export function isCharacterAppearanceStyle(value: unknown): value is CharacterAppearanceStyle {
  return typeof value === 'string' && (CHARACTER_APPEARANCE_STYLES as readonly string[]).includes(value);
}

/** Resolve a workshop action; unknown IDs fall back without throwing. */
export function resolveStudioAction(value: unknown): StudioActionDefinition | null {
  if (!isStudioActionId(value)) return null;
  return STUDIO_ACTIONS[value];
}

export function listStudioActionsForSpecies(species: LumiAnimal): readonly StudioActionDefinition[] {
  return STUDIO_ACTION_IDS.map((id) => STUDIO_ACTIONS[id]).filter(
    (action) => action.species === species,
  );
}

/**
 * Forest style keeps legacy props; workshop/restrained may request a studio prop.
 * Unknown props are rejected by the compiler against the full prop id list.
 */
export function primaryStudioProp(action: StudioActionDefinition): CharacterPropId {
  return action.props[0] as CharacterPropId;
}

export function summarizeStudioComplexity(): {
  readonly version: typeof STUDIO_COLLECTION_VERSION;
  readonly appearanceStyles: number;
  readonly studioActions: number;
  readonly studioProps: number;
  readonly speciesWithStudioActions: number;
} {
  const species = new Set(STUDIO_ACTION_IDS.map((id) => STUDIO_ACTIONS[id].species));
  return {
    version: STUDIO_COLLECTION_VERSION,
    appearanceStyles: CHARACTER_APPEARANCE_STYLES.length,
    studioActions: STUDIO_ACTION_IDS.length,
    studioProps: STUDIO_PROP_IDS.length,
    speciesWithStudioActions: species.size,
  };
}
