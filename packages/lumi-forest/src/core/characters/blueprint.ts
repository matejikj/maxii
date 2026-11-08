import type { LumiAnimal } from '../types';
import type { VectorNode } from '../vector/types';
import { CHARACTER_ANATOMY } from './anatomy';
import type { CharacterPropId } from './collection';
import type { CharacterAppearanceStyle } from './studioCollection';
import { RABBIT_ARTWORK_REVISION } from './rabbitArtDirection';

/** Painter-stable, named anatomy. IDs are authoring identifiers, not SVG IDs. */
export type CharacterPartRole =
  | 'shadow' | 'tail' | 'body' | 'belly' | 'paw' | 'head' | 'ear'
  | 'eye' | 'nose' | 'mouth' | 'cheek' | 'muzzle' | 'spines'
  | 'face' | 'mark' | 'accessory'; // `face` remains for v1 consumers.
export type CharacterForestPose = 'default' | 'sitting' | 'standing' | 'sleeping';
/** Static workshop action poses — additive; forest poses stay unchanged. */
export type CharacterStudioPose =
  | 'planPath'
  | 'tryAlternatePath'
  | 'bridgeSpan'
  | 'testBridge'
  | 'sketchPlan'
  | 'compareNotes'
  | 'arrangePattern'
  | 'presentCreation';
export type CharacterPose = CharacterForestPose | CharacterStudioPose;
export type CharacterExpression = 'neutral' | 'happy' | 'curious' | 'sleepy';
export type CharacterAccessory = 'bow' | 'flower' | 'scarf' | 'star';
export type ProportionChannel = 'body' | 'head' | 'ears' | 'paws';
export type CharacterProportions = Readonly<Partial<Record<ProportionChannel, number>>>;
export interface Point { readonly x: number; readonly y: number }

export interface CharacterPart {
  readonly id: string;
  readonly role: CharacterPartRole;
  /** Lower numbers paint first; ties preserve authored order. */
  readonly order: number;
  readonly geometry: VectorNode;
  readonly transform?: string;
  readonly opacity?: number;
}

export type CharacterComposition =
  | { readonly kind: 'legacy'; readonly geometry: VectorNode }
  | { readonly kind: 'parts'; readonly parts: readonly CharacterPart[] };

export interface CharacterVariant {
  readonly pose: CharacterPose;
  readonly expression: CharacterExpression;
  readonly composition: CharacterComposition;
}

/** v0.2.1 blueprints remain accepted, with their exact old semantics. */
export interface CharacterBlueprintV1 {
  readonly schemaVersion: 1;
  readonly species: LumiAnimal;
  readonly displayName: string;
  readonly base: CharacterComposition;
  readonly variants?: readonly CharacterVariant[];
  readonly anchor?: Point;
}

/** Anchors and colors are authored semantic metadata, not screen positions. */
export interface CharacterRig {
  readonly leftEye: Point;
  readonly rightEye: Point;
  readonly mouth: Point;
  readonly pivots: Readonly<{ body: Point; head: Point; paws: Point; leftEar: Point; rightEar: Point }>;
  readonly accessoryAnchors: Readonly<{ head: Point; neck: Point; hand: Point }>;
  readonly ink: string;
  readonly blush: string;
  readonly soft: string;
}

/**
 * v0.3 blueprint schema. Anatomy is the single source of vectors. Expression,
 * pose and proportion changes are applied by generic pure compilation passes.
 * No full variant artwork is required for each combination.
 */
export interface CharacterBlueprintV2 {
  readonly schemaVersion: 2;
  readonly species: LumiAnimal;
  readonly displayName: string;
  readonly base: { readonly kind: 'parts'; readonly parts: readonly CharacterPart[] };
  readonly rig: CharacterRig;
  readonly supportedPoses: readonly Exclude<CharacterPose, 'default'>[];
  readonly supportedExpressions: readonly CharacterExpression[];
  readonly supportedAccessories: readonly CharacterAccessory[];
  /**
   * Optional graphic revision for the shipped artwork. Independent from
   * schemaVersion so art refreshes do not force blueprint migrations.
   */
  readonly artworkRevision?: string;
}

export type CharacterBlueprint = CharacterBlueprintV1 | CharacterBlueprintV2;
export interface CharacterCompileOptions {
  readonly pose?: CharacterPose;
  readonly expression?: CharacterExpression;
  readonly accessories?: readonly CharacterAccessory[];
  readonly proportions?: CharacterProportions;
  /** Offline signature or workshop prop — never a remote asset. */
  readonly prop?: CharacterPropId | null;
  /** Additional offline props (e.g. pencil beside notebook); max two total. */
  readonly props?: readonly CharacterPropId[];
  /** Forest / workshop / restrained look preference. */
  readonly appearanceStyle?: CharacterAppearanceStyle;
}

const P = (x: number, y: number): Point => ({ x, y });
const COMMON = {
  supportedPoses: [
    'sitting',
    'standing',
    'sleeping',
    'planPath',
    'tryAlternatePath',
    'bridgeSpan',
    'testBridge',
    'sketchPlan',
    'compareNotes',
    'arrangePattern',
    'presentCreation',
  ],
  supportedExpressions: ['neutral', 'happy', 'curious', 'sleepy'],
  supportedAccessories: ['bow', 'flower', 'scarf', 'star'],
} as const;
const pivots = (leftEarX: number, rightEarX: number, earY: number) => ({
  body: P(0, 78), head: P(0, -3), paws: P(0, 98),
  leftEar: P(leftEarX, earY), rightEar: P(rightEarX, earY),
});

export const CHARACTER_BLUEPRINTS: Readonly<Record<LumiAnimal, CharacterBlueprintV2>> = {
  rabbit: {
    schemaVersion: 2, species: 'rabbit', displayName: 'Lumi',
    artworkRevision: RABBIT_ARTWORK_REVISION,
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.rabbit }, ...COMMON,
    // Soft-compact pilot: ear pivots sit slightly lower/wider with shorter ears.
    rig: { leftEye: P(-30, 7), rightEye: P(30, 7), mouth: P(0, 25),
      pivots: pivots(-46, 34, -46), accessoryAnchors: { head: P(52, -98), neck: P(0, 55), hand: P(84, 92) },
      ink: '#5A5550', blush: '#EAB8B0', soft: '#F4E9DF' },
  },
  bear: {
    schemaVersion: 2, species: 'bear', displayName: 'Momo',
    artworkRevision: 'lumi.bear.art.c1',
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.bear }, ...COMMON,
    rig: { leftEye: P(-31, 2), rightEye: P(31, 2), mouth: P(0, 32),
      pivots: pivots(-68, 68, -49), accessoryAnchors: { head: P(63, -66), neck: P(0, 53), hand: P(85, 97) },
      ink: '#66544B', blush: '#ECAFA0', soft: '#E1C19B' },
  },
  fox: {
    schemaVersion: 2, species: 'fox', displayName: 'Nori',
    artworkRevision: 'lumi.fox.art.c1',
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.fox }, ...COMMON,
    rig: { leftEye: P(-31, 4), rightEye: P(31, 4), mouth: P(0, 39),
      pivots: pivots(-70, 70, -60), accessoryAnchors: { head: P(69, -96), neck: P(0, 68), hand: P(87, 94) },
      ink: '#705B58', blush: '#E8B0A2', soft: '#EBAF89' },
  },
  otter: {
    schemaVersion: 2, species: 'otter', displayName: 'Kiko',
    artworkRevision: 'lumi.otter.art.c1',
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.otter }, ...COMMON,
    rig: { leftEye: P(-31, 0), rightEye: P(31, 0), mouth: P(0, 30),
      pivots: pivots(-74, 74, -51), accessoryAnchors: { head: P(63, -58), neck: P(0, 58), hand: P(88, 104) },
      ink: '#594D4A', blush: '#E8ADA2', soft: '#D3AD96' },
  },
  hedgehog: {
    schemaVersion: 2, species: 'hedgehog', displayName: 'Piko',
    artworkRevision: 'lumi.hedgehog.art.c1',
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.hedgehog }, ...COMMON,
    rig: { leftEye: P(-28, 2), rightEye: P(28, 2), mouth: P(0, 36),
      pivots: pivots(-68, 68, -51), accessoryAnchors: { head: P(49, -54), neck: P(0, 60), hand: P(80, 98) },
      ink: '#5D514D', blush: '#E8B1A8', soft: '#F0D5BF' },
  },
  owl: {
    schemaVersion: 2, species: 'owl', displayName: 'Eli',
    artworkRevision: 'lumi.owl.art.c1',
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.owl }, ...COMMON,
    rig: { leftEye: P(-30, 6), rightEye: P(30, 6), mouth: P(0, 38),
      pivots: pivots(-72, 72, -80), accessoryAnchors: { head: P(58, -88), neck: P(0, 52), hand: P(86, 88) },
      ink: '#5A4F55', blush: '#E6B3B0', soft: '#C9B8B0' },
  },
  squirrel: {
    schemaVersion: 2, species: 'squirrel', displayName: 'Tili',
    artworkRevision: 'lumi.squirrel.art.c1',
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.squirrel }, ...COMMON,
    rig: { leftEye: P(-28, 4), rightEye: P(28, 4), mouth: P(0, 30),
      pivots: pivots(-58, 58, -78), accessoryAnchors: { head: P(54, -92), neck: P(0, 50), hand: P(82, 90) },
      ink: '#5E4639', blush: '#E8B0A2', soft: '#E0A878' },
  },
  fawn: {
    schemaVersion: 2, species: 'fawn', displayName: 'Runi',
    artworkRevision: 'lumi.fawn.art.c1',
    base: { kind: 'parts', parts: CHARACTER_ANATOMY.fawn }, ...COMMON,
    rig: { leftEye: P(-29, 5), rightEye: P(29, 5), mouth: P(0, 32),
      pivots: pivots(-48, 48, -90), accessoryAnchors: { head: P(50, -100), neck: P(0, 48), hand: P(80, 96) },
      ink: '#5B4A3F', blush: '#E8B1A8', soft: '#F2E4D4' },
  },
};

const VALID_ROLES: readonly string[] = [
  'shadow', 'tail', 'body', 'belly', 'paw', 'head', 'ear', 'eye',
  'nose', 'mouth', 'cheek', 'muzzle', 'spines', 'face', 'mark', 'accessory',
];
export function isCharacterRole(value: string): value is CharacterPartRole {
  return VALID_ROLES.includes(value);
}
