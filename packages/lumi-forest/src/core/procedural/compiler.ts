import { compileCharacter, CHARACTER_BLUEPRINTS } from '../characters';
import { seededRandom } from '../engine/random';
import { SCENE_CATALOG } from '../scenes/catalog';
import type { SceneLayer, VectorNode } from '../vector/types';
import { group } from '../vector/nodes';
import { compileTerrain } from './terrain';
import { createMotif } from './motifs';
import { inflate, normalizeSafeZones, OccupancyGrid, validateViewport } from './geometry';
import type { PlannedItem, ProceduralKind, ProceduralLayerId, ProceduralSceneRequest, Rect, ScenePlan } from './types';

const COUNTS = { quiet: 8, regular: 17, playful: 27 } as const;
const CHARACTER_BOX: Rect = { x: -155, y: -205, width: 310, height: 410 };
const round = (x: number): number => Math.round(x * 100) / 100;
const PADDING = 4;

const mix = <T>(array: readonly T[], rng: () => number): T[] => {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const old = result[i]!;
    result[i] = result[j]!;
    result[j] = old;
  }
  return result;
};

/**
 * Deterministic, bounded, collision-aware scene planner.
 * No React, layout callbacks, random global state, device APIs or mutable singletons.
 * Terrain is decorative color underlay; placements are the only collision-controlled objects.
 */
export function planProceduralScene(request: ProceduralSceneRequest): ScenePlan {
  const { viewport: v, scene, seed = 'lumi-default', density = 'regular' } = request;
  validateViewport(v);
  if (!SCENE_CATALOG[scene]) throw new RangeError(`Unknown procedural scene: ${String(scene)}`);
  if (!Object.hasOwn(COUNTS, density)) throw new RangeError(`Unknown procedural density: ${String(density)}`);
  if (typeof seed !== 'string' || seed.length > 256) throw new RangeError('Scene seed must be a string with at most 256 characters');
  if (request.characterVisibility && !['auto', 'none'].includes(request.characterVisibility)) {
    throw new RangeError('Unknown character visibility');
  }
  const motionPadding = request.characterMotionPadding ?? 0;
  if (!Number.isFinite(motionPadding) || motionPadding < 0 || motionPadding > 32) {
    throw new RangeError('Character motion padding must be 0..32dp');
  }
  const palette = SCENE_CATALOG[scene].palette;
  const zones = normalizeSafeZones(request.safeZones ?? [], v);
  const occupancy = new OccupancyGrid(v);
  for (const zone of zones) occupancy.block(zone);
  const items: PlannedItem[] = [];
  const add = (item: PlannedItem, padding = PADDING): boolean => {
    // Containment and collisions are checked including a small breathing gap.
    if (!occupancy.reserve(inflate(item.bounds, padding))) return false;
    items.push(item);
    return true;
  };
  const key = `proc:v1:${scene}:${seed}:${v.width}x${v.height}`;
  let omitted = 0;
  let omittedCharacter = false;
  if (request.characterVisibility !== 'none') {
    const animal = request.animal ?? SCENE_CATALOG[scene].defaultAnimal;
    const blueprint = CHARACTER_BLUEPRINTS[animal];
    if (!blueprint) throw new RangeError(`Unknown animal: ${String(animal)}`);
    const art = compileCharacter(blueprint, {
      ...(request.pose === undefined ? {} : { pose: request.pose }),
      ...(request.expression === undefined ? {} : { expression: request.expression }),
      ...(request.accessories === undefined ? {} : { accessories: request.accessories }),
      ...(request.proportions === undefined ? {} : { proportions: request.proportions }),
    });
    // Scale down only when needed; do not overlap content even as a last resort.
    const base = Math.min(.82, Math.max(.40, v.width / 490), Math.max(.40, v.height / 720));
    const scales = [base, base * .85, base * .72, base * .60].map(round);
    const rng = seededRandom(`${key}:char`);
    const horizontal = rng() > 0.5 ? ['right','left','center'] as const : ['right','center','left'] as const;
    let found = false;
    for (const s of scales) {
      if (found) break;
      const w = CHARACTER_BOX.width * s, h = CHARACTER_BOX.height * s;
      const lowest = v.height - 14 - motionPadding - h;
      const yCandidates = [lowest, lowest - v.height * .09, lowest - v.height * .18];
      const xs = horizontal.map(pos => pos === 'right' ? v.width - 18 - motionPadding - w : pos === 'left' ? 18 + motionPadding : (v.width - w) / 2);
      for (const y of yCandidates) {
        if (found) break;
        for (const x of xs) {
          const box = { x: round(x), y: round(y), width: round(w), height: round(h) };
          const tx = round(x - CHARACTER_BOX.x * s);
          const ty = round(y - CHARACTER_BOX.y * s);
          if (add({ id: 'character', kind: 'character', layer: 'character', bounds: box,
            node: group([art], { transform: `translate(${tx} ${ty}) scale(${s})` }) }, PADDING + motionPadding)) { found = true; break; }
        }
      }
    }
    omittedCharacter = !found;
  }

  const objectKinds: readonly Exclude<ProceduralKind,'character' | 'sun' | 'moon' | 'cloud' | 'star'>[] =
    ['sprig', 'grass', 'flower', 'grass', 'bush', 'stone', 'sprig', 'mushroom', 'grass', 'flower', 'stone'];
  const areaFactor = Math.min(1.65, Math.max(.55, Math.sqrt(v.width * v.height / (390 * 844))));
  const count = Math.min(44, Math.ceil(COUNTS[density] * areaFactor));
  const rng = seededRandom(`${key}:ground:${density}`);
  const order = mix(Array.from({ length: count }, (_, i) => i), rng);
  for (const i of order) {
    const kind = objectKinds[i % objectKinds.length]!;
    const shape = createMotif(kind, palette.accent, palette.mid);
    const scale = round(0.67 + rng() * 0.60);
    const w = round(shape.width * scale), h = round(shape.height * scale);
    let placed = false;
    for (let attempt = 0; attempt < 35; attempt++) {
      const cx = round((.055 + rng() * .89) * v.width);
      // Objects appear on the ground: upper meadows are subtle, foreground remains denser.
      const baseline = round((.71 + rng() * .267) * v.height);
      const x = round(cx - w / 2), y = round(baseline - h);
      const layer: ProceduralLayerId = kind === 'bush' || kind === 'stone' || kind === 'mushroom' ? 'objects' : 'plants';
      if (add({ id: `${kind}-${i}`, kind, layer, bounds: { x, y, width: w, height: h },
        node: group([shape.node], { transform: `translate(${cx} ${baseline}) scale(${scale})` }) })) { placed = true; break; }
    }
    if (!placed) omitted++;
  }

  // Separate RNG streams prevent changing terrain or character when sky budgets change.
  const skyRng = seededRandom(`${key}:sky`);
  const skyKinds: readonly ('cloud' | 'star' | 'sun' | 'moon')[] = [
    SCENE_CATALOG[scene].sky === 'moon' ? 'moon' : 'sun',
    'cloud', 'star', 'star', ...(v.width >= 650 ? (['cloud', 'star'] as const) : []),
  ];
  for (const [i, kind] of skyKinds.entries()) {
    const shape = createMotif(kind, palette.sun, kind === 'cloud' ? palette.mid : palette.sun);
    const scale = round(kind === 'cloud' ? 0.85 + skyRng() * .2 : 0.72 + skyRng() * .35);
    const w = round(shape.width * scale), h = round(shape.height * scale);
    let placed = false;
    for (let attempt = 0; attempt < 35; attempt++) {
      const cx = round((.08 + skyRng() * .84) * v.width);
      const bottom = round((.12 + skyRng() * .22) * v.height);
      const x = round(cx - w / 2), y = round(bottom - h);
      if (add({ id: `${kind}-${i}`, kind, layer: 'sky', bounds: { x, y, width: w, height: h },
        node: group([shape.node], { transform: `translate(${cx} ${bottom}) scale(${scale})` }) })) { placed = true; break; }
    }
    if (!placed) omitted++;
  }

  const terrain = compileTerrain(v, palette, `${key}:terrain`);
  const nodesFor = (id: ProceduralLayerId): readonly VectorNode[] => items.filter(item => item.layer === id).map(item => item.node);
  const layer = (id: SceneLayer['id'], nodes: readonly VectorNode[]): SceneLayer => ({ id, nodes });
  return {
    document: {
      schemaVersion: 1, scene, width: v.width, height: v.height,
      layers: [
        layer('canvas', [terrain[0]!]),
        layer('sky', nodesFor('sky')),
        layer('landscape', terrain.slice(1)),
        layer('microdetails', nodesFor('microdetails')),
        layer('plants', nodesFor('plants')),
        layer('objects', nodesFor('objects')),
        layer('character', nodesFor('character')),
      ],
    },
    items,
    excluded: zones,
    omitted: { character: omittedCharacter, decorations: omitted },
  };
}
export const composeProceduralScene = (request: ProceduralSceneRequest) => planProceduralScene(request).document;
