import { circle, ellipse, group, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';
import type { CharacterAccessory, CharacterRig } from './blueprint';

export const ACCESSORY_SLOTS: Readonly<Record<CharacterAccessory, 'head' | 'neck' | 'hand'>> = {
  bow: 'head',
  flower: 'head',
  scarf: 'neck',
  star: 'hand',
};

/** Accessory recipes are local to their semantic anchors, not the device screen. */
export function compileAccessory(accessory: CharacterAccessory, rig: CharacterRig): VectorNode {
  const slot = ACCESSORY_SLOTS[accessory];
  if (!slot) throw new RangeError(`Unknown accessory: ${String(accessory)}`);
  const anchor = rig.accessoryAnchors[slot];
  const at = { transform: `translate(${anchor.x} ${anchor.y})` };
  switch (accessory) {
    case 'bow':
      return group(
        [
          ellipse(-12, 0, 13, 8, { fill: '#D7A1A8', transform: 'rotate(-17 -12 0)' }),
          ellipse(12, 0, 13, 8, { fill: '#D7A1A8', transform: 'rotate(17 12 0)' }),
          circle(0, 0, 5.6, { fill: '#F4E3AD' }),
        ],
        at,
      );
    case 'flower':
      return group(
        [
          ...Array.from({ length: 5 }, (_, i) => {
            const angle = (i * 2 * Math.PI) / 5;
            return ellipse(Math.cos(angle) * 9.3, Math.sin(angle) * 9.3, 7.7, 7.7, {
              fill: '#F2CDBF',
            });
          }),
          circle(0, 0, 6.3, { fill: '#EECF84' }),
        ],
        at,
      );
    case 'scarf':
      return group(
        [
          path('M-43 -3 Q0 13 43 -3 L35 13 Q0 28 -35 13Z', { fill: '#A9C5B5' }),
          path('M20 13 Q39 11 35 41 L21 39Z', { fill: '#8FB19D' }),
          path('M-31 1 Q0 13 29 1', { fill: 'none', stroke: '#7B9F8C', strokeWidth: 2 }),
        ],
        at,
      );
    case 'star':
      return group(
        [
          path('M0 -23 L6 -8 L23 -7 L10 4 L14 21 L0 12 L-14 21 L-10 4 L-23 -7 L-6 -8Z', {
            fill: '#F3D994',
          }),
          circle(-5, -5, 2.5, { fill: '#FFFFFF', opacity: 0.7 }),
        ],
        at,
      );
  }
}
