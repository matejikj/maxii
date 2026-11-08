/** Persistent scene recipes. Separate from the renderer-facing SceneDocument v1 IR.
 * A stored preset is user-authored configuration, not an SVG document.
 */
import { SCENE_CATALOG } from '../scenes/catalog';
import { CHARACTER_BLUEPRINTS } from '../characters/blueprint';
import { compileCharacter } from '../characters/compiler';
import { composeScene } from '../scenes/compose';
import type { SceneOptions, LumiAnimal, LumiDensity, LumiScene } from '../types';
import { LUMI_ANIMALS } from '../types';
import type { CharacterAccessory, CharacterExpression, CharacterPose, CharacterProportions } from '../characters/blueprint';
import type { SceneDocument } from '../vector/types';
import type { ProceduralSceneConfig, SafeZone } from '../procedural/types';

export const LATEST_SCENE_RECIPE_VERSION = 2 as const;
export const SUPPORTED_SCENE_RECIPE_VERSIONS = [1, 2] as const;

/** Pre-1.0 persisted scene configuration, independent of SceneDocument schemaVersion. */
export type StoredSceneRecipeV1 = Readonly<{ schemaVersion: 1 } & SceneOptions>;

/** Stable v1.0 persisted representation. Keys are explicit for forward migrations. */
export interface StoredSceneRecipeV2 {
  readonly kind: 'lumi.scene.recipe';
  readonly schemaVersion: 2;
  readonly id: string;
  readonly scene: LumiScene;
  readonly seed: string;
  readonly density: LumiDensity;
  readonly character: Readonly<{
    species: LumiAnimal;
    pose: CharacterPose;
    expression: CharacterExpression;
    accessories: readonly CharacterAccessory[];
    proportions?: CharacterProportions;
  }>;
  readonly layout: Readonly<
    | { mode: 'static' }
    | { mode: 'procedural'; viewport: Readonly<{ width: number; height: number }>;
        safeZones: readonly SafeZone[]; characterVisibility: 'auto' | 'none'; characterMotionPadding: number }
  >;
}
export type StoredSceneRecipe = StoredSceneRecipeV1 | StoredSceneRecipeV2;

export class SceneRecipeMigrationError extends Error {
  constructor(message: string) { super(message); this.name = 'SceneRecipeMigrationError'; }
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SceneRecipeMigrationError(message);
}
const allowed = (value: unknown, options: readonly string[], field: string): void => {
  assert(typeof value === 'string' && options.includes(value), `Invalid ${field}`);
};
const finite = (value: unknown, min: number, max: number, field: string): void => {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `Invalid ${field}`);
};
function keysOnly(value: Record<string, unknown>, names: readonly string[], field: string): void {
  for (const key of Object.keys(value)) assert(names.includes(key), `Unexpected ${field}.${key}`);
}
const SCENES = Object.keys(SCENE_CATALOG);
const DENSITIES = ['quiet', 'regular', 'playful'];
const ANIMALS = [...LUMI_ANIMALS];
const POSES = ['default', 'sitting', 'standing', 'sleeping'];
const EXPRESSIONS = ['neutral', 'happy', 'curious', 'sleepy'];
const ACCESSORIES = ['bow', 'flower', 'scarf', 'star'];

function checkedZones(value: unknown): readonly SafeZone[] {
  assert(Array.isArray(value) && value.length <= 32, 'safeZones must be an array with <=32 items');
  const seen = new Set<string>();
  return value.map((v: unknown) => {
    assert(record(v), 'Invalid safeZone');
    keysOnly(v, ['id','x','y','width','height','padding'], 'safeZone');
    assert(typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 64 && !seen.has(v.id), 'Invalid/duplicate safeZone ID');
    seen.add(v.id);
    finite(v.x, -8192, 8192, 'safeZone.x'); finite(v.y, -8192, 8192, 'safeZone.y');
    finite(v.width, 0, 8192, 'safeZone.width'); finite(v.height, 0, 8192, 'safeZone.height');
    if (v.padding !== undefined) finite(v.padding, 0, 128, 'safeZone.padding');
    return { id: v.id as string, x: v.x as number, y: v.y as number,
      width: v.width as number, height: v.height as number,
      ...(v.padding === undefined ? {} : { padding: v.padding as number }) };
  });
}
function checkedProportions(value: unknown): CharacterProportions | undefined {
  if (value === undefined) return undefined;
  assert(record(value), 'proportions must be an object');
  const result: Record<string, number> = {};
  for (const [key, v] of Object.entries(value)) {
    assert(['body', 'head', 'ears', 'paws'].includes(key), `Unknown proportion ${key}`);
    finite(v, 0.5, 1.5, `proportions.${key}`);
    result[key] = v as number;
  }
  return result;
}
function checkedCharacter(value: unknown, scene: LumiScene): StoredSceneRecipeV2['character'] {
  assert(record(value), 'character must be an object');
  keysOnly(value, ['species','pose','expression','accessories','proportions'], 'character');
  const species = value.species ?? SCENE_CATALOG[scene].defaultAnimal;
  const pose = value.pose ?? 'sitting';
  const expression = value.expression ?? 'neutral';
  const accessories = value.accessories ?? [];
  allowed(species, ANIMALS, 'character.species');
  allowed(pose, POSES, 'character.pose');
  allowed(expression, EXPRESSIONS, 'character.expression');
  assert(Array.isArray(accessories) && accessories.length <= 3, 'Invalid accessories');
  accessories.forEach(v => allowed(v, ACCESSORIES, 'character.accessories'));
  assert(new Set(accessories).size === accessories.length, 'Duplicate accessories');
  const proportions = checkedProportions(value.proportions);
  try { compileCharacter(CHARACTER_BLUEPRINTS[species as LumiAnimal], {
    pose: pose as CharacterPose, expression: expression as CharacterExpression,
    accessories: [...accessories] as CharacterAccessory[], ...(proportions ? { proportions } : {}),
  }); } catch (error) { throw new SceneRecipeMigrationError(`Unsupported character configuration: ${error instanceof Error ? error.message : 'invalid'}`); }
  return { species: species as LumiAnimal, pose: pose as CharacterPose, expression: expression as CharacterExpression,
    accessories: [...accessories] as CharacterAccessory[], ...(proportions ? { proportions } : {}) };
}
function checkedLayout(value: unknown): StoredSceneRecipeV2['layout'] {
  assert(record(value), 'layout must be an object');
  keysOnly(value, ['mode','viewport','safeZones','characterVisibility','characterMotionPadding'], 'layout');
  allowed(value.mode, ['static', 'procedural'], 'layout.mode');
  if (value.mode === 'static') return { mode: 'static' };
  assert(record(value.viewport), 'procedural layout requires viewport');
  keysOnly(value.viewport, ['width','height'], 'viewport');
  finite(value.viewport.width, 1, 8192, 'viewport.width');
  finite(value.viewport.height, 1, 8192, 'viewport.height');
  const characterVisibility = value.characterVisibility ?? 'auto';
  allowed(characterVisibility, ['auto', 'none'], 'characterVisibility');
  const characterMotionPadding = value.characterMotionPadding ?? 0;
  finite(characterMotionPadding, 0, 32, 'characterMotionPadding');
  return { mode: 'procedural', viewport: { width: value.viewport.width as number, height: value.viewport.height as number },
    safeZones: checkedZones(value.safeZones ?? []), characterVisibility: characterVisibility as 'auto'|'none',
    characterMotionPadding: characterMotionPadding as number };
}

/** Strict boundary validation + copying. No caller-owned mutable object is returned. */
export function readSceneRecipe(input: unknown): StoredSceneRecipeV2 {
  assert(record(input), 'Scene recipe must be an object');
  assert(input.schemaVersion === 2 && input.kind === 'lumi.scene.recipe', 'Expected scene recipe v2');
  keysOnly(input, ['kind','schemaVersion','id','scene','seed','density','character','layout'], 'recipe');
  assert(typeof input.id === 'string' && /^[a-zA-Z0-9_.:-]{1,96}$/.test(input.id), 'Invalid recipe ID');
  allowed(input.scene, SCENES, 'scene'); allowed(input.density, DENSITIES, 'density');
  assert(typeof input.seed === 'string' && input.seed.length <= 256, 'Invalid seed');
  const scene = input.scene as LumiScene;
  return { kind: 'lumi.scene.recipe', schemaVersion: 2, id: input.id as string,
    scene, seed: input.seed as string, density: input.density as LumiDensity,
    character: checkedCharacter(input.character, scene), layout: checkedLayout(input.layout) };
}

/** Only migration v1 -> v2 is supported. Unknown future versions fail closed. */
export function migrateSceneRecipe(input: unknown, id = 'imported-scene'): StoredSceneRecipeV2 {
  assert(record(input), 'Scene recipe must be an object');
  if (input.schemaVersion === 2) return readSceneRecipe(input);
  assert(input.schemaVersion === 1, `Unsupported scene recipe schemaVersion: ${String(input.schemaVersion)}`);
  keysOnly(input, ['schemaVersion','scene','seed','density','animal','pose','expression','accessories','proportions','procedural'], 'legacy recipe');
  allowed(input.scene, SCENES, 'scene');
  const scene = input.scene as LumiScene;
  const procedural = input.procedural;
  let layout: StoredSceneRecipeV2['layout'] = { mode: 'static' };
  if (procedural !== undefined) {
    assert(record(procedural), 'procedural must be an object');
    keysOnly(procedural, ['viewport','safeZones','characterVisibility','characterMotionPadding'], 'legacy procedural');
    layout = checkedLayout({ ...procedural, mode: 'procedural' });
  }
  const candidate = {
    kind: 'lumi.scene.recipe', schemaVersion: 2, id, scene,
    seed: input.seed ?? 'lumi-default', density: input.density ?? 'regular',
    character: { species: input.animal ?? SCENE_CATALOG[scene].defaultAnimal,
      pose: input.pose ?? 'sitting', expression: input.expression ?? (input.pose === 'sleeping' ? 'sleepy' : 'neutral'),
      accessories: input.accessories ?? [], proportions: input.proportions },
    layout,
  };
  return readSceneRecipe(candidate);
}

/** Deterministic, no runtime XML parsing or file IO; accepts only validated recipes. */
export function compileSceneRecipe(input: unknown): SceneDocument {
  const recipe = migrateSceneRecipe(input);
  const c = recipe.character;
  const procedural: ProceduralSceneConfig | undefined = recipe.layout.mode === 'procedural'
    ? { viewport: recipe.layout.viewport, safeZones: recipe.layout.safeZones,
      characterVisibility: recipe.layout.characterVisibility,
      characterMotionPadding: recipe.layout.characterMotionPadding } : undefined;
  const options: SceneOptions = { scene: recipe.scene, seed: recipe.seed, density: recipe.density,
    animal: c.species, pose: c.pose, expression: c.expression, accessories: c.accessories,
    ...(c.proportions ? { proportions: c.proportions } : {}), ...(procedural ? { procedural } : {}) };
  return composeScene(options);
}

/** Preserve stable key ordering; canonical in the sense of this exact schema, not arbitrary JSON canonicalization. */
export function encodeSceneRecipe(input: unknown): string {
  return JSON.stringify(migrateSceneRecipe(input));
}
export function decodeSceneRecipe(json: string): StoredSceneRecipeV2 {
  assert(typeof json === 'string' && json.length <= 65536, 'Recipe JSON too large');
  try { return migrateSceneRecipe(JSON.parse(json) as unknown); }
  catch (error) {
    if (error instanceof SceneRecipeMigrationError) throw error;
    throw new SceneRecipeMigrationError('Invalid recipe JSON');
  }
}
