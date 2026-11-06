import type { LumiDensity, LumiScene, LumiAnimal } from '../types';
import type { CharacterAccessory, CharacterExpression, CharacterPose, CharacterProportions } from '../characters/blueprint';
import type { ViewportSize } from '../layout/viewport';
import type { SceneDocument, VectorNode } from '../vector/types';

/** All measurements are in logical DP relative to the background View, not physical pixels. */
export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface SafeZone extends Rect {
  readonly id: string;
  /** Additional clearance around content, defaults to 8dp. */
  readonly padding?: number;
}
export type ProceduralKind = 'character' | 'cloud' | 'star' | 'sprig' | 'grass' | 'flower' | 'mushroom' | 'bush' | 'stone' | 'sun' | 'moon';
export type ProceduralLayerId = 'sky' | 'plants' | 'objects' | 'microdetails' | 'character';

export interface ProceduralSceneConfig {
  readonly viewport: ViewportSize;
  /** Rectangle exclusions for decorations and character; backgrounds may flow behind content. */
  readonly safeZones?: readonly SafeZone[];
  readonly characterVisibility?: 'auto' | 'none';
  /** Reserve additional clearance around animated character (0..32dp). Default: 0, preserving v0.4 output. */
  readonly characterMotionPadding?: number;
}

export interface ProceduralSceneRequest extends ProceduralSceneConfig {
  readonly scene: LumiScene;
  readonly seed?: string;
  readonly density?: LumiDensity;
  readonly animal?: LumiAnimal;
  readonly pose?: CharacterPose;
  readonly expression?: CharacterExpression;
  readonly accessories?: readonly CharacterAccessory[];
  readonly proportions?: CharacterProportions;
}

/** Object/character collision uses conservative inflated axis-aligned bounds. */
export interface PlannedItem {
  readonly id: string;
  readonly kind: ProceduralKind;
  readonly layer: ProceduralLayerId;
  readonly bounds: Rect;
  readonly node: VectorNode;
}

export interface ScenePlan {
  readonly document: SceneDocument;
  readonly items: readonly PlannedItem[];
  /** Normalized, clipped UI exclusions. */
  readonly excluded: readonly Rect[];
  readonly omitted: Readonly<{ character: boolean; decorations: number }>;
}
