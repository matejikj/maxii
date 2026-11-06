export { composeScene } from './scenes/compose';
export { SCENE_CATALOG } from './scenes/catalog';
export { CHARACTER_CATALOG, CHARACTER_BLUEPRINTS, CHARACTER_ANATOMY, compileCharacter, ACCESSORY_SLOTS, PROPORTION_LIMITS } from './characters';
export type { CharacterBlueprint, CharacterBlueprintV1, CharacterBlueprintV2, CharacterPart, CharacterPartRole, CharacterPose, CharacterExpression, CharacterAccessory, CharacterProportions, CharacterRig, CharacterComposition, CharacterVariant, CharacterCompileOptions } from './characters';
export { CHARACTER_ARTWORK } from './characters/artwork';
export { planDecorations, DECORATION_SLOTS } from './engine/decorations';
export { seededRandom } from './engine/random';
export { serializeScene, serializeVectorNode, escapeSvgAttribute } from './vector/serialize';
export { seedMark, sparkle, sprig } from './scenes/primitives';
export { lumi } from './theme/tokens';
export { LUMI_SCENES, LUMI_ANIMALS, LUMI_DENSITIES } from './types';
export type { LumiAnimal, LumiDensity, LumiScene, SceneOptions, Palette, SceneDefinition } from './types';
export type { VectorNode, VectorProps, SceneLayer, SceneDocument, LayerId } from './vector/types';

import type { SceneOptions, LumiScene } from './types';
import { composeScene } from './scenes/compose';
import { serializeScene } from './vector/serialize';
import { SCENE_CATALOG } from './scenes/catalog';

/** Backward-compatible export helper. The native renderer never parses this XML. */
export const createLumiSvg = (options: SceneOptions): string => serializeScene(composeScene(options));

/** Compatibility view for users of v0.1's LUMI_PALETTES export. */
export const LUMI_PALETTES = Object.fromEntries(
  Object.entries(SCENE_CATALOG).map(([scene, def]) => [scene, { ...def.palette, animal: def.defaultAnimal }]),
) as Record<LumiScene, typeof SCENE_CATALOG[LumiScene]['palette'] & { animal: typeof SCENE_CATALOG[LumiScene]['defaultAnimal'] }>;
export { resolveAspectMode, computeViewportLayout, LUMI_VIEWPORT_FIXTURES } from './layout/viewport';
export type { AspectMode, ResolvedAspectMode, ViewportSize, ViewportLayout } from './layout/viewport';
export { LUMI_PERFORMANCE_BUDGETS, countVectorNodes } from './perf/budgets';

// v0.4 Procedural Scene Engine; platform-independent public API.
export { planProceduralScene, composeProceduralScene } from './procedural/compiler';
export { normalizeSafeZones, intersect, contains, inflate, OccupancyGrid } from './procedural/geometry';
export { compileTerrain } from './procedural/terrain';
export type { Rect, SafeZone, ProceduralSceneConfig, ProceduralSceneRequest, ProceduralKind, PlannedItem, ScenePlan } from './procedural/types';

// v0.5 renderer-independent semantic UI system.
export * from './ui';

// v0.6 renderer-agnostic animation recipes and motion topology.
export * from './motion';

// v1.0 persistence boundary: opt-in schemas and migrations, not frame-loop work.
export * from './versioning';
