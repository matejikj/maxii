import type { LumiAnimal } from '../types';
import type { CharacterExpression, CharacterPose } from './blueprint';
import type { CharacterMotion } from '../motion/types';
import { CHARACTER_BLUEPRINTS } from './blueprint';
import { LUMI_ANIMALS } from '../types';

/**
 * Versioned offline character pack. Unknown or corrupted species IDs must fall
 * back to a static calm drawing — never crash the tracker.
 */
export const CHARACTER_COLLECTION_VERSION = 'lumi.characters.collection.v1' as const;
export const CHARACTER_COLLECTION_COMPAT = {
  minApp: '0.1.0',
  schema: 1,
} as const;

/**
 * Shared semantic presentation states. Apps ask for a meaning; the framework
 * maps it to pose/expression/motion without reading child health data.
 */
export const CHARACTER_SEMANTIC_STATES = [
  'calm',
  'greeting',
  'listening',
  'curiosity',
  'pointContent',
  'rest',
  'gentleJoy',
  'static',
] as const;

export type CharacterSemanticState = (typeof CHARACTER_SEMANTIC_STATES)[number];

export type SemanticPresentation = {
  readonly state: CharacterSemanticState;
  readonly pose: CharacterPose;
  readonly expression: CharacterExpression;
  readonly motion: CharacterMotion;
  readonly staticFallback: {
    readonly pose: CharacterPose;
    readonly expression: CharacterExpression;
  };
};

export const SEMANTIC_PRESENTATIONS: Readonly<
  Record<CharacterSemanticState, SemanticPresentation>
> = {
  calm: {
    state: 'calm',
    pose: 'sitting',
    expression: 'neutral',
    motion: 'idle',
    staticFallback: { pose: 'sitting', expression: 'neutral' },
  },
  greeting: {
    state: 'greeting',
    pose: 'sitting',
    expression: 'happy',
    motion: 'perk',
    staticFallback: { pose: 'sitting', expression: 'happy' },
  },
  listening: {
    state: 'listening',
    pose: 'sitting',
    expression: 'curious',
    motion: 'tilt',
    staticFallback: { pose: 'sitting', expression: 'curious' },
  },
  curiosity: {
    state: 'curiosity',
    pose: 'standing',
    expression: 'curious',
    motion: 'perk',
    staticFallback: { pose: 'standing', expression: 'curious' },
  },
  pointContent: {
    state: 'pointContent',
    pose: 'standing',
    expression: 'curious',
    motion: 'tilt',
    staticFallback: { pose: 'standing', expression: 'curious' },
  },
  rest: {
    state: 'rest',
    pose: 'sleeping',
    expression: 'sleepy',
    motion: 'sleeping',
    staticFallback: { pose: 'sleeping', expression: 'sleepy' },
  },
  gentleJoy: {
    state: 'gentleJoy',
    pose: 'sitting',
    expression: 'happy',
    motion: 'idle',
    staticFallback: { pose: 'sitting', expression: 'happy' },
  },
  static: {
    state: 'static',
    pose: 'sitting',
    expression: 'neutral',
    motion: 'still',
    staticFallback: { pose: 'sitting', expression: 'neutral' },
  },
};

/** Offline forest props plus workshop props — never remote assets. */
export const FOREST_PROP_IDS = ['book', 'blocks', 'leaf', 'scarfProp'] as const;
export const CHARACTER_PROP_IDS = [
  ...FOREST_PROP_IDS,
  'routeMap',
  'bridgePieces',
  'notebook',
  'pencil',
  'patternTiles',
  'displayStand',
] as const;
export type CharacterPropId = (typeof CHARACTER_PROP_IDS)[number];
export type ForestPropId = (typeof FOREST_PROP_IDS)[number];

export type CharacterSignatureAction = {
  readonly id: string;
  readonly labelCs: string;
  readonly prop: CharacterPropId | null;
  readonly semantic: CharacterSemanticState;
};

export type CharacterCollectionEntry = {
  readonly species: LumiAnimal;
  readonly displayName: string;
  readonly artworkRevision: string;
  readonly signatureActions: readonly [CharacterSignatureAction, CharacterSignatureAction];
  readonly supportedSemanticStates: readonly CharacterSemanticState[];
};

const ALL_STATES = CHARACTER_SEMANTIC_STATES;

export const CHARACTER_COLLECTION: Readonly<Record<LumiAnimal, CharacterCollectionEntry>> = {
  tiger: {
    species: 'tiger', displayName: 'Timi', artworkRevision: CHARACTER_BLUEPRINTS.tiger.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'tigerWave', labelCs: 'Jemně pozdravit', prop: null, semantic: 'greeting' },
      { id: 'tigerExplore', labelCs: 'Prozkoumat hračku', prop: 'blocks', semantic: 'curiosity' },
    ],
  },
  hippo: {
    species: 'hippo', displayName: 'Hugo', artworkRevision: CHARACTER_BLUEPRINTS.hippo.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'hippoListen', labelCs: 'Naslouchat', prop: null, semantic: 'listening' },
      { id: 'hippoSmile', labelCs: 'Usmát se', prop: null, semantic: 'gentleJoy' },
    ],
  },
  rabbit: {
    species: 'rabbit',
    displayName: 'Lumi',
    artworkRevision: CHARACTER_BLUEPRINTS.rabbit.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'earPerk', labelCs: 'Nastražit uši', prop: null, semantic: 'curiosity' },
      { id: 'headTilt', labelCs: 'Naklonit hlavu', prop: null, semantic: 'listening' },
    ],
  },
  bear: {
    species: 'bear',
    displayName: 'Momo',
    artworkRevision: CHARACTER_BLUEPRINTS.bear.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'alignBlocks', labelCs: 'Srovnat tvary', prop: 'blocks', semantic: 'pointContent' },
      { id: 'patientWait', labelCs: 'Trpělivé čekání', prop: null, semantic: 'calm' },
    ],
  },
  fox: {
    species: 'fox',
    displayName: 'Nori',
    artworkRevision: CHARACTER_BLUEPRINTS.fox.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'curlRest', labelCs: 'Uvelebit se', prop: 'scarfProp', semantic: 'rest' },
      { id: 'quietYawn', labelCs: 'Tiché zívnutí', prop: null, semantic: 'rest' },
    ],
  },
  otter: {
    species: 'otter',
    displayName: 'Kiko',
    artworkRevision: CHARACTER_BLUEPRINTS.otter.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'offerExplore', labelCs: 'Nabídnout k prozkoumání', prop: 'blocks', semantic: 'pointContent' },
      { id: 'playfulLean', labelCs: 'Hravé naklonění', prop: null, semantic: 'gentleJoy' },
    ],
  },
  hedgehog: {
    species: 'hedgehog',
    displayName: 'Piko',
    artworkRevision: CHARACTER_BLUEPRINTS.hedgehog.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'softGlance', labelCs: 'Jemné rozhlédnutí', prop: null, semantic: 'curiosity' },
      { id: 'quietSmile', labelCs: 'Tichý úsměv', prop: null, semantic: 'gentleJoy' },
    ],
  },
  owl: {
    species: 'owl',
    displayName: 'Eli',
    artworkRevision: CHARACTER_BLUEPRINTS.owl.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'turnPage', labelCs: 'Otočit stránku', prop: 'book', semantic: 'pointContent' },
      { id: 'lookToParent', labelCs: 'Podívat se na rodiče', prop: 'book', semantic: 'listening' },
    ],
  },
  squirrel: {
    species: 'squirrel',
    displayName: 'Tili',
    artworkRevision: CHARACTER_BLUEPRINTS.squirrel.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'stackShapes', labelCs: 'Skládat tvary', prop: 'blocks', semantic: 'pointContent' },
      { id: 'softRhythm', labelCs: 'Jemný rytmus', prop: 'blocks', semantic: 'gentleJoy' },
    ],
  },
  fawn: {
    species: 'fawn',
    displayName: 'Runi',
    artworkRevision: CHARACTER_BLUEPRINTS.fawn.artworkRevision!,
    supportedSemanticStates: ALL_STATES,
    signatureActions: [
      { id: 'pauseAtLeaf', labelCs: 'Zastavit u lístku', prop: 'leaf', semantic: 'curiosity' },
      { id: 'lookAround', labelCs: 'Rozhlédnout se', prop: 'leaf', semantic: 'listening' },
    ],
  },
};

export const DEFAULT_GUIDE_SPECIES: LumiAnimal = 'rabbit';

/** Resolve a stored or remote species id without throwing on unknown values. */
export function resolveCollectionSpecies(value: unknown): LumiAnimal {
  if (typeof value === 'string' && (LUMI_ANIMALS as readonly string[]).includes(value)) {
    return value as LumiAnimal;
  }
  return DEFAULT_GUIDE_SPECIES;
}

export function resolveSemanticPresentation(
  state: CharacterSemanticState,
  animate: boolean,
): { pose: CharacterPose; expression: CharacterExpression; motion: CharacterMotion } {
  const presentation = SEMANTIC_PRESENTATIONS[state];
  if (!animate || state === 'static') {
    return {
      pose: presentation.staticFallback.pose,
      expression: presentation.staticFallback.expression,
      motion: 'still',
    };
  }
  return {
    pose: presentation.pose,
    expression: presentation.expression,
    motion: presentation.motion,
  };
}

export function listCollectionEntries(): readonly CharacterCollectionEntry[] {
  return LUMI_ANIMALS.map((species) => CHARACTER_COLLECTION[species]);
}

/** Complexity snapshot for install-budget review — no remote download required. */
export function summarizeCollectionComplexity(): {
  readonly version: typeof CHARACTER_COLLECTION_VERSION;
  readonly speciesCount: number;
  readonly semanticStates: number;
  readonly signatureActions: number;
  readonly blueprintRevisions: Readonly<Record<LumiAnimal, string | undefined>>;
} {
  let signatureActions = 0;
  const blueprintRevisions = {} as Record<LumiAnimal, string | undefined>;
  for (const species of LUMI_ANIMALS) {
    signatureActions += CHARACTER_COLLECTION[species].signatureActions.length;
    blueprintRevisions[species] = CHARACTER_BLUEPRINTS[species].artworkRevision;
  }
  return {
    version: CHARACTER_COLLECTION_VERSION,
    speciesCount: LUMI_ANIMALS.length,
    semanticStates: CHARACTER_SEMANTIC_STATES.length,
    signatureActions,
    blueprintRevisions,
  };
}
