import type { ProceduralSceneConfig } from './procedural/types';
import type { CharacterPose, CharacterExpression, CharacterAccessory, CharacterProportions } from './characters/blueprint';
/** Stable public identifiers. A breaking change requires a new scene document version. */
export const LUMI_SCENES = ['home', 'growth', 'sleep', 'feeding', 'milestones'] as const;
export const LUMI_ANIMALS = [
  'rabbit',
  'bear',
  'fox',
  'otter',
  'hedgehog',
  'owl',
  'squirrel',
  'fawn',
  'tiger',
  'hippo',
] as const;
export const LUMI_DENSITIES = ['quiet', 'regular', 'playful'] as const;

export type LumiScene = (typeof LUMI_SCENES)[number];
export type LumiAnimal = (typeof LUMI_ANIMALS)[number];
export type LumiDensity = (typeof LUMI_DENSITIES)[number];

export interface SceneOptions {
  readonly scene: LumiScene;
  /** Opt-in to v0.4 viewport-aware procedural generation. Legacy output remains byte-compatible. */
  readonly procedural?: ProceduralSceneConfig;
  /** Non-identifying, local deterministic seed; never store personal details in it. */
  readonly seed?: string;
  readonly animal?: LumiAnimal;
  readonly density?: LumiDensity;
  readonly pose?: CharacterPose;
  readonly expression?: CharacterExpression;
  readonly accessories?: readonly CharacterAccessory[];
  readonly proportions?: CharacterProportions;
}

export interface Palette {
  readonly bg: string;
  readonly mid: string;
  readonly hill: string;
  readonly hill2: string;
  readonly sun: string;
  readonly accent: string;
  readonly accentText: string;
  readonly ink: string;
}

export interface SceneDefinition {
  readonly id: LumiScene;
  readonly palette: Palette;
  readonly defaultAnimal: LumiAnimal;
  readonly sky: 'sun' | 'moon' | 'celebration';
  readonly showGrowthRuler?: boolean;
}
