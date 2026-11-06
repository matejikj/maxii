import { circle, ellipse, group, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';
import type { ProceduralKind } from './types';

/** Each motif has conservative dimensions in its own coordinate space. Origin is bottom-center. */
interface Motif { readonly width: number; readonly height: number; readonly node: VectorNode }
export function createMotif(kind: Exclude<ProceduralKind, 'character'>, accent: string, soft: string): Motif {
  switch (kind) {
    case 'sun': return { width: 62, height: 62, node: circle(0, -31, 31, { fill: soft, opacity: 0.79 }) };
    case 'moon': return { width: 65, height: 65, node: group([
      path('M23 -61 A31 31 0 1 0 25 -5 A26 26 0 1 1 23 -61Z', { fill: soft, opacity: 0.85 }),
    ]) };
    case 'grass': return { width: 40, height: 34, node: group([
      path('M0 0 Q-3 -19 -15 -28 M0 0 Q1 -23 6 -32 M0 0 Q13 -18 19 -19',
        { fill: 'none', stroke: accent, strokeWidth: 3, strokeLinecap: 'round', opacity: 0.73 }),
    ]) };
    case 'sprig': return { width: 48, height: 59, node: group([
      path('M0 0 C-6 -16 -4 -35 0 -55', { fill: 'none', stroke: accent, strokeWidth: 2.6, strokeLinecap: 'round' }),
      path('M-3 -19 Q-23 -24 -20 -37 Q-3 -33 -3 -19Z', { fill: accent }),
      path('M-2 -31 Q12 -48 23 -44 Q17 -33 -2 -31Z', { fill: accent }),
    ]) };
    case 'flower': return { width: 40, height: 52, node: group([
      path('M0 0 Q-3 -26 0 -36', { fill: 'none', stroke: accent, strokeWidth: 2.4, strokeLinecap: 'round' }),
      path('M0 -15 Q-16 -24 -18 -12 Q-7 -9 0 -15 M0 -20 Q17 -27 16 -18 Q11 -13 0 -20', { fill: accent, opacity: 0.7 }),
      circle(-7, -40, 6.8, { fill: soft }), circle(7, -40, 6.8, { fill: soft }),
      circle(0, -47, 6.8, { fill: soft }), circle(0, -33, 6.8, { fill: soft }),
      circle(0, -40, 4, { fill: '#E6C48E' }),
    ]) };
    case 'mushroom': return { width: 44, height: 38, node: group([
      path('M-6 0 Q-7 -12 -5 -20 L6 -20 Q7 -12 6 0Z', { fill: '#F5EDE4' }),
      path('M-22 -19 Q-18 -40 0 -39 Q17 -39 22 -19 Q0 -12 -22 -19Z', { fill: soft }),
      circle(-7, -27, 2.7, { fill: '#FAF7F1', opacity: 0.85 }), circle(8, -30, 3.1, { fill: '#FAF7F1', opacity: 0.85 }),
    ]) };
    case 'bush': return { width: 85, height: 50, node: group([
      ellipse(-15, -14, 22, 23, { fill: accent, opacity: 0.64 }),
      ellipse(14, -17, 25, 25, { fill: accent, opacity: 0.82 }),
      ellipse(0, -10, 28, 18, { fill: accent, opacity: 0.83 }),
    ]) };
    case 'stone': return { width: 46, height: 24, node: group([
      path('M-22 0 Q-22 -10 -11 -20 Q4 -27 15 -16 Q24 -7 22 0Z', { fill: soft, opacity: 0.85 }),
    ]) };
    case 'cloud': return { width: 110, height: 49, node: group([
      ellipse(-24, -16, 23, 15, { fill: soft, opacity: 0.64 }),
      ellipse(0, -24, 27, 20, { fill: soft, opacity: 0.66 }),
      ellipse(26, -15, 27, 16, { fill: soft, opacity: 0.65 }),
    ]) };
    case 'star': return { width: 18, height: 18, node: group([
      path('M0 -18 Q2 -11 9 -9 Q2 -7 0 0 Q-2 -7 -9 -9 Q-2 -11 0 -18Z', { fill: accent, opacity: 0.54 }),
    ]) };
  }
}
