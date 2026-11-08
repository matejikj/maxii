import { circle, ellipse, group, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';
import type { CharacterRig } from './blueprint';
import type { CharacterPropId } from './collection';

/**
 * Offline character props. Anchored to the hand (or head for a scarf drape)
 * so scale matches the companion without remote assets.
 */
export function compileCharacterProp(prop: CharacterPropId, rig: CharacterRig): VectorNode {
  if (prop === 'scarfProp') {
    const neck = rig.accessoryAnchors.neck;
    return group(
      [
        path('M-36 -2 Q0 14 36 -2 L30 12 Q0 24 -30 12Z', { fill: '#A9C5B5' }),
        path('M16 12 Q34 10 30 36 L18 34Z', { fill: '#8FB19D' }),
      ],
      { transform: `translate(${neck.x} ${neck.y}) scale(0.92)` },
    );
  }

  const hand = rig.accessoryAnchors.hand;
  const at = { transform: `translate(${hand.x} ${hand.y}) scale(0.9)` };
  switch (prop) {
    case 'book':
      return group(
        [
          path('M-22 -4 L-2 -10 L-2 22 L-22 28Z', { fill: '#C9896A' }),
          path('M-2 -10 L18 -4 L18 28 L-2 22Z', { fill: '#E2B089' }),
          path('M-2 -10 L-2 22', {
            fill: 'none',
            stroke: '#8F5E45',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
          }),
          path('M4 -2 L14 2', {
            fill: 'none',
            stroke: '#F7E8D6',
            strokeWidth: 1.4,
            strokeLinecap: 'round',
          }),
        ],
        at,
      );
    case 'blocks':
      return group(
        [
          path('M-20 8 L-4 0 L12 8 L-4 16Z', { fill: '#E8B86A' }),
          path('M-20 8 L-20 24 L-4 32 L-4 16Z', { fill: '#D39A4A' }),
          path('M-4 16 L-4 32 L12 24 L12 8Z', { fill: '#F0C98A' }),
          ellipse(10, -6, 9, 9, { fill: '#8FB19D' }),
          circle(-8, -10, 7, { fill: '#D7A1A8' }),
        ],
        at,
      );
    case 'leaf':
      return group(
        [
          path('M0 -26 C14 -14 14 8 0 26 C-14 8 -14 -14 0 -26Z', { fill: '#8FB19D' }),
          path('M0 -18 L0 18', {
            fill: 'none',
            stroke: '#6F947C',
            strokeWidth: 1.8,
            strokeLinecap: 'round',
          }),
          path('M0 -6 Q10 0 0 8', {
            fill: 'none',
            stroke: '#B7D0BE',
            strokeWidth: 1.4,
            strokeLinecap: 'round',
          }),
        ],
        at,
      );
    default: {
      const _exhaustive: never = prop;
      void _exhaustive;
      throw new RangeError(`Unknown character prop: ${String(prop)}`);
    }
  }
}
