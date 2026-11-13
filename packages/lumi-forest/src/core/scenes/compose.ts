import type { SceneOptions } from '../types';
import type { SceneDocument, SceneLayer, VectorNode } from '../vector/types';
import { circle, group, path, rect } from '../vector/nodes';
import { CHARACTER_BLUEPRINTS, compileCharacter } from '../characters';
import { renderDecorations } from '../engine/decorations';
import { SCENE_CATALOG } from './catalog';
import { sparkle, sprig, sun } from './primitives';
import { composeProceduralScene } from '../procedural/compiler';

const CANVAS_WIDTH = 390;
const CANVAS_HEIGHT = 844;
const HILLS = {
  mid: 'M0 510 Q135 475 240 521 Q350 566 390 530 L390 844 L0 844Z',
  near: 'M0 665 Q80 625 173 656 Q289 688 390 622 L390 844 L0 844Z',
  front: 'M0 765 Q155 719 278 773 Q329 800 390 749 L390 844 L0 844Z',
} as const;

function layer(id: SceneLayer['id'], nodes: readonly VectorNode[]): SceneLayer {
  return { id, nodes };
}

function createSky(
  scene: (typeof SCENE_CATALOG)[keyof typeof SCENE_CATALOG],
): readonly VectorNode[] {
  const { palette: p } = scene;
  if (scene.sky === 'moon') {
    return [
      path('M324 102 A34 34 0 1 1 314 45 A27 27 0 1 0 324 102Z', {
        fill: '#E2CFAD',
        opacity: 0.85,
      }),
      sparkle(290, 113, 0.55, '#C8B8DA'),
      sparkle(357, 149, 0.4, '#D6C6DE'),
    ];
  }
  if (scene.sky === 'celebration') return [sparkle(343, 120, 1.6, '#E4C69D')];
  if (scene.showGrowthRuler) {
    return [
      circle(343, 95, 26, { fill: '#F3DCAF', opacity: 0.72 }),
      path('M92 765 L92 644 M82 644 L102 644 M82 674 L102 674 M82 704 L102 704 M82 734 L102 734', {
        fill: 'none',
        stroke: '#9FB49F',
        strokeWidth: 3,
        strokeLinecap: 'round',
        opacity: 0.74,
      }),
      sprig(107, 763, 0.72, p.accent),
    ];
  }
  return [sun()];
}

/** Pure, renderer-neutral scene compiler. A future procedural engine changes THIS layer, not the UI. */
export function composeScene(options: SceneOptions): SceneDocument {
  if (options.procedural) return composeProceduralScene({ ...options, ...options.procedural });
  const {
    scene,
    seed = 'lumi-default',
    density = 'regular',
    animal,
    pose,
    expression,
    accessories,
    proportions,
  } = options;
  const recipe = SCENE_CATALOG[scene];
  if (!recipe) throw new RangeError(`Unknown LUMI scene: ${String(scene)}`);
  if (!['quiet', 'regular', 'playful'].includes(density))
    throw new RangeError(`Unknown density: ${String(density)}`);
  const character = CHARACTER_BLUEPRINTS[animal ?? recipe.defaultAnimal];
  if (!character) throw new RangeError(`Unknown animal: ${String(animal)}`);
  const { palette: p } = recipe;

  return {
    schemaVersion: 1,
    scene,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    layers: [
      layer('canvas', [rect(CANVAS_WIDTH, CANVAS_HEIGHT, { fill: p.bg })]),
      layer('landscape', [
        path(HILLS.mid, { fill: p.mid, opacity: 0.77 }),
        path(HILLS.near, { fill: p.hill }),
        path(HILLS.front, { fill: p.hill2, opacity: 0.77 }),
      ]),
      layer('microdetails', renderDecorations(scene, seed, density, p.accent)),
      layer('plants', [
        sprig(32, 768, 0.78, p.accent),
        sprig(116, 809, 0.46, p.accent),
        sprig(177, 786, 0.68, p.accent),
        sprig(366, 803, 0.55, p.accent),
        sparkle(38, 587, 0.49, p.sun),
        sparkle(356, 560, 0.6, p.sun),
        sparkle(184, 629, 0.46, p.sun),
      ]),
      layer('sky', createSky(recipe)),
      layer('character', [
        group(
          [
            compileCharacter(character, {
              ...(pose === undefined ? {} : { pose }),
              ...(expression === undefined ? {} : { expression }),
              ...(accessories === undefined ? {} : { accessories }),
              ...(proportions === undefined ? {} : { proportions }),
            }),
          ],
          { transform: 'translate(288 704) scale(.83)' },
        ),
      ]),
    ],
  };
}
