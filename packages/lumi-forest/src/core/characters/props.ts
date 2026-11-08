import { circle, ellipse, group, path, rect } from '../vector/nodes';
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
    case 'routeMap':
      return group(
        [
          path('M-26 -18 L24 -22 L28 20 L-22 24Z', { fill: '#F4E4C8' }),
          path('M-26 -18 L24 -22 L28 20 L-22 24Z', {
            fill: 'none',
            stroke: '#C4A574',
            strokeWidth: 1.4,
          }),
          path('M-14 -6 Q0 -14 12 -2 Q4 8 -8 10', {
            fill: 'none',
            stroke: '#7A9E86',
            strokeWidth: 2,
            strokeLinecap: 'round',
          }),
          circle(12, -2, 3.2, { fill: '#D9896A' }),
          circle(-8, 10, 2.6, { fill: '#8FB19D' }),
        ],
        at,
      );
    case 'bridgePieces':
      return group(
        [
          rect(18, 10, { x: -28, y: -4, fill: '#C9896A', rx: 2 }),
          rect(18, 10, { x: -8, y: -8, fill: '#D9A078', rx: 2 }),
          rect(16, 10, { x: 12, y: -2, fill: '#B87A52', rx: 2 }),
          path('M-26 8 Q0 18 26 6', {
            fill: 'none',
            stroke: '#8F5E45',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
          }),
        ],
        at,
      );
    case 'notebook':
      return group(
        [
          path('M-18 -20 L16 -24 L20 18 L-14 22Z', { fill: '#E8F0E6' }),
          path('M-18 -20 L16 -24 L20 18 L-14 22Z', {
            fill: 'none',
            stroke: '#8FA894',
            strokeWidth: 1.5,
          }),
          path('M-10 -8 L10 -12', {
            fill: 'none',
            stroke: '#B7C9BA',
            strokeWidth: 1.3,
            strokeLinecap: 'round',
          }),
          path('M-9 2 L12 -2', {
            fill: 'none',
            stroke: '#B7C9BA',
            strokeWidth: 1.3,
            strokeLinecap: 'round',
          }),
          path('M-8 12 L8 8', {
            fill: 'none',
            stroke: '#B7C9BA',
            strokeWidth: 1.3,
            strokeLinecap: 'round',
          }),
          rect(4, 36, { x: -20, y: -18, fill: '#A9C5B5' }),
        ],
        at,
      );
    case 'pencil':
      return group(
        [
          path('M-4 -22 L4 -22 L6 14 L0 24 L-6 14Z', { fill: '#E8B86A' }),
          path('M-4 -22 L4 -22 L3 -14 L-3 -14Z', { fill: '#D7A1A8' }),
          path('M-6 14 L0 24 L6 14Z', { fill: '#5A5550' }),
          path('M-3 -10 L3 -10', {
            fill: 'none',
            stroke: '#C9896A',
            strokeWidth: 1.2,
            strokeLinecap: 'round',
          }),
        ],
        { transform: `translate(${hand.x + 18} ${hand.y - 8}) scale(0.75) rotate(28)` },
      );
    case 'patternTiles':
      return group(
        [
          rect(16, 16, { x: -22, y: -18, fill: '#8FB19D', rx: 2 }),
          rect(16, 16, { x: -2, y: -14, fill: '#E8B86A', rx: 2 }),
          rect(16, 16, { x: -14, y: 2, fill: '#D7A1A8', rx: 2 }),
          rect(14, 14, { x: 6, y: 6, fill: '#A9C5B5', rx: 2 }),
          circle(-14, -10, 3, { fill: '#F7E8D6' }),
          path('M6 -6 L10 -2 L6 2 L2 -2Z', { fill: '#F4E4C8' }),
        ],
        at,
      );
    case 'displayStand':
      return group(
        [
          path('M-8 18 L8 18 L4 28 L-4 28Z', { fill: '#C9896A' }),
          rect(36, 8, { x: -18, y: 8, fill: '#D9A078', rx: 2 }),
          ellipse(0, -6, 14, 16, { fill: '#8FB19D' }),
          path('M-6 -14 Q0 -22 6 -14', {
            fill: 'none',
            stroke: '#F7E8D6',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
          }),
          circle(-4, -4, 2.2, { fill: '#5A5550' }),
          circle(4, -4, 2.2, { fill: '#5A5550' }),
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
