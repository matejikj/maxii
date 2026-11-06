import type { VectorNode } from '../vector/types';
import { circle, ellipse, group, path } from '../vector/nodes';
import type { CharacterExpression, CharacterRig, Point } from './blueprint';

/** Morph-free expression recipes. One parameterized recipe works for all species. */
export function expressionEye(expression: Exclude<CharacterExpression, 'neutral'>, point: Point, rig: CharacterRig): VectorNode {
  const { x, y } = point;
  const ink = rig.ink;
  switch (expression) {
    case 'happy':
      return path(`M${x - 12} ${y + 4} Q${x} ${y - 9} ${x + 12} ${y + 4}`, {
        fill: 'none', stroke: ink, strokeWidth: 4.1, strokeLinecap: 'round',
      });
    case 'sleepy':
      return path(`M${x - 12} ${y - 2} Q${x} ${y + 9} ${x + 12} ${y - 2}`, {
        fill: 'none', stroke: ink, strokeWidth: 3.4, strokeLinecap: 'round',
      });
    case 'curious':
      return group([
        ellipse(x, y, 5.7, 7.2, { fill: ink }),
        circle(x - 1.8, y - 2.8, 1.75, { fill: '#FFFFFF', opacity: 0.92 }),
      ]);
  }
}

export function expressionMouth(expression: Exclude<CharacterExpression, 'neutral'>, rig: CharacterRig): VectorNode {
  const { x, y } = rig.mouth;
  switch (expression) {
    case 'happy':
      return path(`M${x - 14} ${y - 5} Q${x} ${y + 13} ${x + 14} ${y - 5}`, {
        fill: 'none', stroke: rig.ink, strokeWidth: 3.2, strokeLinecap: 'round',
      });
    case 'sleepy':
      return ellipse(x, y + 2, 4.6, 6.4, { fill: rig.ink, opacity: 0.87 });
    case 'curious':
      return ellipse(x, y + 2, 5.3, 8.2, { fill: rig.ink });
  }
}
