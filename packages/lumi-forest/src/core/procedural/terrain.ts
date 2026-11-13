import { path, rect } from '../vector/nodes';
import type { VectorNode } from '../vector/types';
import { seededRandom } from '../engine/random';
import type { Palette } from '../types';
import type { ViewportSize } from '../layout/viewport';

/** Soft, full-bleed Bézier landscapes are intentionally exempt from UI exclusions. */
export function compileTerrain(
  v: ViewportSize,
  palette: Palette,
  seed: string,
): readonly VectorNode[] {
  const rng = seededRandom(`terrain:v1:${seed}`);
  const variation = () => (rng() - 0.5) * 0.065 * v.height;
  const hill = (level: number, c: string, opacity = 1): VectorNode => {
    const y0 = v.height * level + variation();
    const y1 = v.height * level + variation();
    const y2 = v.height * level + variation();
    const yy = v.height;
    const d =
      `M0 ${y0.toFixed(2)} C${(v.width * 0.28).toFixed(2)} ${(y0 - 22).toFixed(2)} ` +
      `${(v.width * 0.49).toFixed(2)} ${(y1 + 22).toFixed(2)} ${(v.width * 0.63).toFixed(2)} ${y1.toFixed(2)} ` +
      `S${(v.width * 0.91).toFixed(2)} ${(y2 + 22).toFixed(2)} ${v.width} ${y2.toFixed(2)} L${v.width} ${yy} L0 ${yy}Z`;
    return path(d, { fill: c, opacity });
  };
  return [
    rect(v.width, v.height, { fill: palette.bg }),
    hill(0.62, palette.mid, 0.92),
    hill(0.77, palette.hill),
    hill(0.91, palette.hill2, 0.78),
  ];
}
