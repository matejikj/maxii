import { circle, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';
import type { LumiIconId } from './types';

const ICON_SIZE = 24 as const;
const stroke = (color: string, width = 1.65) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/**
 * Botanical miniatures: generous silhouettes, softly carved contours and
 * translucent material planes. Authored at 24 px, still legible at 20 px.
 * Ink carries meaning; an optional accent adds warmth without changing the
 * monochrome caller contract. No remote assets, fonts or SVG effects.
 */
export function buildLumiIconNodes(
  id: LumiIconId,
  color: string,
  accent = color,
): readonly VectorNode[] {
  let nodes: VectorNode[];
  switch (id) {
    case 'today':
      nodes = [
        circle(12, 11, 4.7, { fill: accent, opacity: 0.24 }),
        path('M8.1 13.5 A4.7 4.7 0 1 1 16.4 12.6', stroke(color)),
        path(
          'M12 2.1 v1.5 M5.4 4.4 l1.1 1.1 M2.8 10.7 h1.6 M18.6 4.4 l-1.1 1.1 M21.2 10.7 h-1.6',
          stroke(accent, 1.85),
        ),
        path(
          'M3.5 17 Q7.6 14.7 12 17 Q16.4 19.3 20.5 17 M6.8 20.4 Q12 18.9 17.2 20.4',
          stroke(color, 1.55),
        ),
        path('M8.9 10.4 Q9.4 8 11.5 7.8', stroke(accent, 1.1)),
      ];
      break;
    case 'care':
      nodes = [
        path(
          'M12 17.2 C9.8 15.6 5.7 12.5 5.7 8.7 C5.7 5.3 10 4.3 12 7.3 C14 4.3 18.3 5.3 18.3 8.7 C18.3 12.5 14.2 15.6 12 17.2Z',
          { fill: accent, opacity: 0.23 },
        ),
        path(
          'M12 17.2 C9.8 15.6 5.7 12.5 5.7 8.7 C5.7 5.3 10 4.3 12 7.3 C14 4.3 18.3 5.3 18.3 8.7 Q18.3 11.1 15.8 13.7',
          stroke(color),
        ),
        path('M11.8 21 C6.6 20.7 2.8 17.4 2.8 12.7 C7.1 12.7 10.3 15.4 11.8 21Z', {
          fill: color,
          opacity: 0.85,
        }),
        path('M12.2 21 C17.4 20.7 21.2 17.4 21.2 12.7 C16.9 12.7 13.7 15.4 12.2 21Z', {
          fill: color,
          opacity: 0.42,
        }),
        path('M6 16 Q8.3 17.1 10.1 19.6 M18 16 Q15.7 17.1 13.9 19.6', stroke(accent, 1)),
      ];
      break;
    case 'development':
      nodes = [
        path('M11.8 20.8 C11.4 16.7 11.8 12.5 13 8.5', stroke(color, 1.8)),
        path('M12.3 12.8 C12.2 6.5 16.3 3.1 20.7 3.5 C20.9 8.8 17 12.3 12.3 12.8Z', {
          fill: color,
          opacity: 0.85,
        }),
        path('M11.8 16 C6.4 16 3.2 12.5 3.1 8.6 C7.9 8.2 11.6 11.1 11.8 16Z', {
          fill: accent,
          opacity: 0.45,
        }),
        path(
          'M14 10.2 Q16.3 7.1 18.3 5.8 M5.6 10.9 Q8 11.9 10 14.3 M6.3 21 Q11.8 19.3 17.3 21',
          stroke(color, 1.2),
        ),
        circle(5, 4.6, 1.25, { fill: accent }),
      ];
      break;
    case 'history':
      nodes = [
        path(
          'M19.8 7.6 C17.2 2.3 9.5 1.7 5.5 6.1 C1.7 10.4 3.9 18.9 9.7 20.5 C15.6 22.2 21.2 17.4 20.9 12',
          stroke(color),
        ),
        path('M7.1 8.3 C4.8 11.5 6.4 16.3 9.8 17.6 Q13.2 18.8 16 16.4', stroke(accent, 1.15)),
        path('M12 7.1 v5 l3.2 1.9', stroke(color, 1.8)),
        path('M17.1 3.1 Q21.1 3.3 21.5 7.7 Q17.6 7.7 17.1 3.1Z', { fill: accent, opacity: 0.65 }),
        circle(12, 12, 1.05, { fill: color }),
      ];
      break;
    case 'sleep':
      nodes = [
        path(
          'M15.1 3.1 C8.7 2 3.4 7.1 4.3 13.4 C5.2 19.5 12.6 22.7 17.9 18.9 C11.2 20 7.4 13 10.2 7.8 Q11.7 4.9 15.1 3.1Z',
          { fill: accent, opacity: 0.25 },
        ),
        path(
          'M15.1 3.1 C8.7 2 3.4 7.1 4.3 13.4 C5.2 19.5 12.6 22.7 17.9 18.9 C11.2 20 7.4 13 10.2 7.8 Q11.7 4.9 15.1 3.1Z',
          stroke(color),
        ),
        path('M18.2 7.1 l.7 1.8 1.8 .7 -1.8 .7 -.7 1.8 -.7 -1.8 -1.8 -.7 1.8 -.7Z', {
          fill: accent,
        }),
        circle(20.2, 4.2, 0.8, { fill: color }),
      ];
      break;
    case 'nursing':
      nodes = [
        path(
          'M12.5 3.1 C11.5 5.3 7.6 8.8 7.6 12 C7.6 17.9 16.8 18.1 16.8 12 C16.8 8.8 13.6 5.2 12.5 3.1Z',
          { fill: accent, opacity: 0.23 },
        ),
        path(
          'M12.5 3.1 C11.5 5.3 7.6 8.8 7.6 12 Q7.6 14.8 10.4 16 M16.8 12 C16.8 8.8 13.6 5.2 12.5 3.1',
          stroke(color),
        ),
        path(
          'M3 15.8 Q6.3 14.4 9.4 17.3 L13 17.3 Q15.3 17.4 15 19.2 M3.4 20.7 Q10.6 23 16.1 20.5 L21 16.4 Q21.8 15.2 20.5 14.5 Q19.7 14.1 18.8 14.8 L15.7 17',
          stroke(color, 1.5),
        ),
        path('M10.6 11 Q12 9.3 13.1 11 Q14.3 9.3 15.3 11 Q15.6 12.3 13 14 Q10.5 12.3 10.6 11Z', {
          fill: accent,
        }),
      ];
      break;
    case 'bottle':
      nodes = [
        path('M8.8 9.1 H15.2 L17 18.4 Q17.5 21 14.7 21 H9.3 Q6.5 21 7 18.4Z', {
          fill: accent,
          opacity: 0.24,
        }),
        path(
          'M8.8 9.1 H15.2 L17 18.4 Q17.5 21 14.7 21 H9.3 Q6.5 21 7 18.4Z M8.3 6.1 H15.7 V9.1 H8.3Z M10.2 6.1 V4.1 Q10.2 2 12 2 Q13.8 2 13.8 4.1 V6.1',
          stroke(color, 1.5),
        ),
        path('M8 16.8 Q11.7 15.4 16.2 16.8 M13.6 11.7 h1.4 M13.9 14.1 h1.5', stroke(color, 1.15)),
        path('M9.1 16 Q8.9 12.3 11.7 11.1 Q13.1 14 9.1 16Z', { fill: accent, opacity: 0.85 }),
      ];
      break;
    case 'food':
      nodes = [
        path('M3.4 11.7 H17.1 C17 17.4 14.7 20 10.3 20 C5.9 20 3.6 17.4 3.4 11.7Z', {
          fill: accent,
          opacity: 0.23,
        }),
        path(
          'M3.4 11.7 H17.1 C17 17.4 14.7 20 10.3 20 C5.9 20 3.6 17.4 3.4 11.7Z M6.2 21 H14.1 M20.3 10.3 V21',
          stroke(color, 1.5),
        ),
        path(
          'M20.3 2.5 C17.6 2.5 17.1 9.7 20.3 10.3 C23.5 9.7 23 2.5 20.3 2.5Z',
          stroke(color, 1.45),
        ),
        path(
          'M10.4 9.3 Q6 8.4 6.2 4.6 Q10.7 4.5 10.4 9.3Z M10.7 9.3 Q10.5 4.9 14.7 3.9 Q15.5 8.4 10.7 9.3Z',
          { fill: accent, opacity: 0.8 },
        ),
      ];
      break;
    case 'diaper':
      nodes = [
        path('M3 6.5 Q12 8.6 21 6.5 L19.4 14 Q17.6 20.6 12 21 Q6.4 20.6 4.6 14Z', {
          fill: accent,
          opacity: 0.22,
        }),
        path(
          'M3 6.5 Q12 8.6 21 6.5 L19.4 14 Q17.6 20.6 12 21 Q6.4 20.6 4.6 14Z M3.6 9.6 Q12 11.5 20.4 9.6 M5.2 15.4 Q8.8 13.5 9.1 19.9 M18.8 15.4 Q15.2 13.5 14.9 19.9',
          stroke(color, 1.5),
        ),
        path('M10.4 13 Q12 15 13.6 13 M7.6 3.1 Q12 4.6 16.4 3.1', stroke(accent, 1.5)),
      ];
      break;
    case 'growth':
      nodes = [
        path('M4.5 3.2 H10 V21 H4.5 Q3 21 3 19.5 V4.7 Q3 3.2 4.5 3.2Z', {
          fill: accent,
          opacity: 0.25,
        }),
        path(
          'M4.5 3.2 H10 V21 H4.5 Q3 21 3 19.5 V4.7 Q3 3.2 4.5 3.2Z M7.2 7 h2.6 M6 11 h3.8 M7.2 15 h2.6 M14.6 21 Q14 15 16.1 10.5',
          stroke(color, 1.5),
        ),
        path('M15.3 14.6 Q13.4 8.4 21 6.1 Q22.1 12 15.3 14.6Z', { fill: color, opacity: 0.8 }),
        path('M15 18.6 Q10.6 17 11.5 13.6 Q15.6 14.1 15 18.6Z', { fill: accent, opacity: 0.8 }),
      ];
      break;
    case 'experience':
      nodes = [
        path(
          'M12 5.9 C8.4 .1 3.8 4.8 7.1 9.2 C.4 9.6 1.2 16 7.6 15.3 C5.8 21.6 12.2 23.1 14 17.2 C18.4 21.5 23.2 17 18.4 12.7 C24.2 9.1 20 3.6 15.4 7.4 Q14.7 5.4 12 5.9Z',
          { fill: accent, opacity: 0.24 },
        ),
        path(
          'M12 5.9 C8.4 .1 3.8 4.8 7.1 9.2 C.4 9.6 1.2 16 7.6 15.3 C5.8 21.6 12.2 23.1 14 17.2 C18.4 21.5 23.2 17 18.4 12.7 C24.2 9.1 20 3.6 15.4 7.4 Q14.7 5.4 12 5.9Z',
          stroke(color, 1.4),
        ),
        circle(12, 12, 2.6, { fill: accent, opacity: 0.8 }),
        path('M11.4 11.1 Q12.3 10.6 12.9 11.4', stroke(color, 1)),
      ];
      break;
    case 'settings':
      nodes = [
        path(
          'M9.7 3.1 Q12 1.6 14.3 3.1 L14.8 5 Q16 5.5 16.8 6.2 L18.8 5.9 Q21 7.4 21.1 9.8 L19.7 11.3 V13.2 L21.1 14.7 Q20.7 17.2 18.8 18.2 L16.8 17.9 Q16 18.6 14.8 19 L14.3 20.9 Q12 22.4 9.7 20.9 L9.2 19 Q8 18.6 7.2 17.9 L5.2 18.2 Q3.3 17.2 2.9 14.7 L4.3 13.2 V11.3 L2.9 9.8 Q3 7.4 5.2 5.9 L7.2 6.2 Q8 5.5 9.2 5Z',
          { fill: accent, opacity: 0.13 },
        ),
        path(
          'M9.7 3.1 Q12 1.6 14.3 3.1 L14.8 5 Q16 5.5 16.8 6.2 L18.8 5.9 Q21 7.4 21.1 9.8 L19.7 11.3 V13.2 L21.1 14.7 Q20.7 17.2 18.8 18.2 L16.8 17.9 Q16 18.6 14.8 19 L14.3 20.9 Q12 22.4 9.7 20.9 L9.2 19 Q8 18.6 7.2 17.9 L5.2 18.2 Q3.3 17.2 2.9 14.7 L4.3 13.2 V11.3 L2.9 9.8 Q3 7.4 5.2 5.9 L7.2 6.2 Q8 5.5 9.2 5Z',
          stroke(color, 1.4),
        ),
        circle(12, 12.1, 3.1, stroke(color, 1.4)),
      ];
      break;
    case 'plus':
      nodes = [path('M12 5 V19 M5 12 H19', stroke(color, 1.8))];
      break;
    case 'arrow-right':
      nodes = [path('M4.5 12 H19.5 M13.4 5.9 L19.5 12 13.4 18.1', stroke(color, 1.75))];
      break;
  }
  return Object.freeze(nodes);
}

export { ICON_SIZE };
