import type { VectorNode } from '../vector/types';
import { circle, group, path } from '../vector/nodes';

/** Shared graphic primitives – also useful to future character accessories. */
export function seedMark(x: number, y: number, scale: number, color: string): VectorNode {
  return group([
    path('M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z', { fill: color }),
    path('M0 0 Q4 -4 7 -3', { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.3, strokeLinecap: 'round' }),
  ], { transform: `translate(${x} ${y}) scale(${scale})` });
}

export function sparkle(x: number, y: number, scale: number, color: string): VectorNode {
  const d = `M${x} ${y-7*scale} Q${x+2*scale} ${y-2*scale} ${x+7*scale} ${y} ` +
    `Q${x+2*scale} ${y+2*scale} ${x} ${y+7*scale} ` +
    `Q${x-2*scale} ${y+2*scale} ${x-7*scale} ${y} ` +
    `Q${x-2*scale} ${y-2*scale} ${x} ${y-7*scale}Z`;
  return path(d, { fill: color });
}

export function sprig(x: number, y: number, scale: number, color: string): VectorNode {
  return group([
    path('M0 0 C-6 -18 -5 -34 1 -56', { fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round' }),
    path('M-2 -18 C-18 -26 -18 -38 -18 -38 C-3 -35 -1 -23 -2 -18', { fill: color }),
    path('M-2 -30 C11 -45 22 -43 22 -43 C15 -29 4 -27 -2 -30', { fill: color }),
  ], { transform: `translate(${x} ${y}) scale(${scale})` });
}

export function sun(x = 341, y = 92, r = 31, color = '#F3DCAF'): VectorNode {
  return circle(x, y, r, { fill: color, opacity: 0.60 });
}
