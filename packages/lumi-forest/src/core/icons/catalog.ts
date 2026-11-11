import { circle, group, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';
import type { LumiIconId } from './types';

const ICON_SIZE = 24 as const;

/** Shared stroke language with procedural forest motifs: round caps, soft curves. */
const stroke = (color: string, width = 1.75) =>
  ({
    fill: 'none' as const,
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  });

/**
 * Geometry authored in a 24×24 box, centered on (12, 12).
 * Silhouettes stay recognizable as sun / leaf-heart / sprig / clock while
 * using the soft organic path language of Lumi Forest motifs.
 */
export function buildLumiIconNodes(id: LumiIconId, color: string): readonly VectorNode[] {
  switch (id) {
    case 'today':
      // Soft day sun: disc + short rounded rays.
      return Object.freeze([
        group([
          circle(12, 12, 4.2, { fill: color }),
          path('M12 3.2 V5.4', stroke(color, 1.8)),
          path('M12 18.6 V20.8', stroke(color, 1.8)),
          path('M3.2 12 H5.4', stroke(color, 1.8)),
          path('M18.6 12 H20.8', stroke(color, 1.8)),
          path('M5.6 5.6 L7.1 7.1', stroke(color, 1.8)),
          path('M16.9 16.9 L18.4 18.4', stroke(color, 1.8)),
          path('M18.4 5.6 L16.9 7.1', stroke(color, 1.8)),
          path('M7.1 16.9 L5.6 18.4', stroke(color, 1.8)),
        ]),
      ]);
    case 'care':
      // Protective leaf-heart: heart silhouette with a soft midrib.
      return Object.freeze([
        group([
          path(
            'M12 20.2 C12 20.2 4.2 15.2 4.2 9.6 C4.2 6.9 6.2 5 8.6 5 C10.1 5 11.3 5.8 12 7 C12.7 5.8 13.9 5 15.4 5 C17.8 5 19.8 6.9 19.8 9.6 C19.8 15.2 12 20.2 12 20.2 Z',
            { fill: color, opacity: 0.92 },
          ),
          path('M12 8.2 C12 8.2 12 16.4 12 17.6', stroke(color, 1.35)),
          path('M12 12.2 Q9.2 11.2 8.2 9.4', stroke(color, 1.2)),
          path('M12 12.2 Q14.8 11.2 15.8 9.4', stroke(color, 1.2)),
        ]),
      ]);
    case 'development':
      // Growth sprig: stem + two soft leaves (motif language, icon scale).
      return Object.freeze([
        group([
          path('M12 20.5 C11.4 15.5 11.6 10.5 12 4.8', stroke(color, 1.9)),
          path(
            'M11.6 12.2 C8.2 11.2 6.4 8.8 6.8 7.2 C9.4 7.6 11.2 9.6 11.6 12.2 Z',
            { fill: color },
          ),
          path(
            'M12.4 9.4 C15.6 8.2 17.8 6.2 17.2 4.8 C14.8 5.4 13 7.4 12.4 9.4 Z',
            { fill: color },
          ),
          path('M12 15.4 C10.2 15.8 9.2 17.2 9.4 18.4', stroke(color, 1.3)),
        ]),
      ]);
    case 'history':
      // Soft clock: rounded ring + gentle hands.
      return Object.freeze([
        group([
          circle(12, 12, 8.2, stroke(color, 1.85)),
          circle(12, 12, 1.15, { fill: color }),
          path('M12 7.2 V12.2', stroke(color, 1.85)),
          path('M12 12.2 L16.1 14.4', stroke(color, 1.85)),
          path('M12 3.6 V4.8', stroke(color, 1.6)),
        ]),
      ]);
  }
}

export { ICON_SIZE };
