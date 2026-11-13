import type { LumiDensity } from '../types';
import type { VectorNode } from '../vector/types';
import { circle } from '../vector/nodes';
import { seededRandom } from './random';

const COUNTS: Readonly<Record<LumiDensity, number>> = { quiet: 5, regular: 13, playful: 21 };

/** Pre-vetted grid slots protect the reading zone and the bottom-right character silhouette. */
export const DECORATION_SLOTS: readonly (readonly [number, number])[] = (() => {
  const positions: [number, number][] = [];
  for (let y = 618; y <= 816; y += 33) {
    for (let x = 22; x <= 362; x += 34) {
      if (x > 166 && y > 626) continue; // reserved character region
      positions.push([x, y]);
    }
  }
  return positions;
})();

export interface Decoration {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export function planDecorations(
  scene: string,
  seed: string,
  density: LumiDensity,
): readonly Decoration[] {
  const random = seededRandom(`lumi:v1:${scene}:${seed}`);
  const shuffled = DECORATION_SLOTS.map((slot) => slot);
  // Fisher–Yates O(n), no rejections, stable and bounded on low-end phones.
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const current = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = current;
  }
  const selected = shuffled.slice(0, COUNTS[density]);
  return selected.map(([x, y]) => ({ x, y, r: 2 + Math.floor(random() * 3) }));
}

export function renderDecorations(
  scene: string,
  seed: string,
  density: LumiDensity,
  color: string,
): readonly VectorNode[] {
  return planDecorations(scene, seed, density).map(({ x, y, r }) =>
    circle(x, y, r, { fill: color, opacity: 0.32 }),
  );
}
