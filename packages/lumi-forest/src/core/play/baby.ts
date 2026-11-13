import type { CharacterPart, Point } from '../characters/blueprint';
import { circle, ellipse, group, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';

export const LUMI_BABY_VARIANTS = ['neutral', 'girl', 'boy'] as const;
export type LumiBabyVariant = (typeof LUMI_BABY_VARIANTS)[number];
export type LumiBabyPose = 'reclined' | 'tummy' | 'sitting' | 'standing';
export interface BabyBlueprint {
  readonly schemaVersion: 1;
  readonly variant: LumiBabyVariant;
  readonly artworkRevision: string;
  readonly parts: readonly CharacterPart[];
  readonly pivots: Readonly<{
    head: Point;
    leftHand: Point;
    rightHand: Point;
    leftFoot: Point;
    rightFoot: Point;
  }>;
}
const stroke = (d: string, color: string, width = 1.5, opacity = 1) =>
  path(d, {
    fill: 'none',
    stroke: color,
    strokeWidth: width,
    opacity,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  });
const SKIN = '#EDC5AA',
  SHADE = '#D9A98E',
  LIGHT = '#F9DAC0',
  INK = '#70564D';
function makeBaby(variant: LumiBabyVariant): BabyBlueprint {
  const cloth = variant === 'girl' ? '#CEAAA5' : variant === 'boy' ? '#A6BEB4' : '#CABD9F';
  const seam = variant === 'girl' ? '#AA8587' : variant === 'boy' ? '#7E9F94' : '#AA977C';
  const entries: [string, CharacterPart['role'], VectorNode][] = [
    ['shadow', 'shadow', ellipse(0, 141, 59, 6, { fill: '#6E8068', opacity: 0.12 })],
    [
      'left-foot',
      'paw',
      group([
        path(
          'M-35 92 C-48 96 -49 120 -42 129 C-38 139 -20 141 -12 131 C-7 124 -14 111 -16 103 Q-21 89 -35 92Z',
          { fill: SKIN },
        ),
        ellipse(-28, 126, 14, 9, { fill: LIGHT, opacity: 0.65 }),
        stroke('M-38 125 l1 4 M-32 126 v5 M-25 126 v5 M-19 125 v4', SHADE, 1.2),
        stroke('M-39 109 Q-31 113 -21 108', SHADE, 1.4, 0.65),
      ]),
    ],
    [
      'right-foot',
      'paw',
      group([
        path(
          'M35 92 C48 96 49 120 42 129 C38 139 20 141 12 131 C7 124 14 111 16 103 Q21 89 35 92Z',
          { fill: SKIN },
        ),
        ellipse(28, 126, 14, 9, { fill: LIGHT, opacity: 0.65 }),
        stroke('M38 125 l-1 4 M32 126 v5 M25 126 v5 M19 125 v4', SHADE, 1.2),
        stroke('M39 109 Q31 113 21 108', SHADE, 1.4, 0.65),
      ]),
    ],
    [
      'body',
      'body',
      group([
        path(
          'M0 15 C-28 13 -40 35 -42 60 C-48 86 -37 111 -15 114 L0 103 15 114 C37 111 48 86 42 60 C40 35 28 13 0 15Z',
          { fill: cloth },
        ),
        path('M29 29 C45 64 40 91 17 105 L15 114 C43 113 51 75 40 47Z', {
          fill: seam,
          opacity: 0.45,
        }),
        path('M-20 21 Q0 42 20 21 L17 17 Q0 29 -17 17Z', { fill: '#F5E8D6' }),
        stroke(
          'M-31 42 Q-38 65 -32 78 M-24 91 Q-15 94 -11 102 M24 91 Q15 94 11 102',
          seam,
          1.6,
          0.6,
        ),
        stroke('M-2 40 v39 M-10 84 Q0 91 10 84', seam, 1.4, 0.65),
        circle(5, 49, 2, { fill: '#F6E7D0' }),
        circle(5, 66, 2, { fill: '#F6E7D0' }),
        path('M-14 56 C-6 55 -4 63 -11 71 C-20 65 -22 59 -14 56Z', { fill: '#E6DBBC' }),
      ]),
    ],
    [
      'left-hand',
      'paw',
      group([
        path(
          'M-33 32 C-46 28 -58 44 -61 61 C-70 69 -67 80 -57 82 C-45 85 -44 72 -42 64 Q-24 45 -33 32Z',
          { fill: SKIN },
        ),
        stroke('M-57 66 Q-51 63 -48 66 M-61 73 l3 2 M-55 75 l2 3', SHADE, 1.3),
        path('M-33 31 Q-47 29 -52 45 L-39 55 Q-26 44 -33 31Z', { fill: cloth }),
        stroke('M-51 44 l12 9', seam, 1.5, 0.6),
      ]),
    ],
    [
      'right-hand',
      'paw',
      group([
        path('M33 32 C46 28 58 44 61 61 C70 69 67 80 57 82 C45 85 44 72 42 64 Q24 45 33 32Z', {
          fill: SKIN,
        }),
        stroke('M57 66 Q51 63 48 66 M61 73 l-3 2 M55 75 l-2 3', SHADE, 1.3),
        path('M33 31 Q47 29 52 45 L39 55 Q26 44 33 31Z', { fill: cloth }),
        stroke('M51 44 l-12 9', seam, 1.5, 0.6),
      ]),
    ],
    [
      'head',
      'head',
      group([
        ellipse(-57, -27, 9, 14, { fill: SKIN }),
        ellipse(57, -27, 9, 14, { fill: SKIN }),
        stroke('M-59 -32 Q-54 -33 -55 -24 M59 -32 Q54 -33 55 -24', SHADE, 1.4),
        path(
          'M0 -95 C35 -96 56 -74 58 -46 C66 -19 55 11 31 23 Q0 40 -31 23 C-55 11 -66 -19 -58 -46 C-56 -74 -35 -96 0 -95Z',
          { fill: SKIN },
        ),
        path('M43 -76 C69 -45 57 -2 30 15 Q0 34 -32 15 C-15 40 31 37 50 13 C71 -9 66 -52 43 -76Z', {
          fill: SHADE,
          opacity: 0.5,
        }),
        path('M-43 -60 Q-27 -88 6 -86 Q-27 -80 -37 -51Z', { fill: LIGHT, opacity: 0.65 }),
        ellipse(-36, -12, 13, 8, { fill: '#E6A49B', opacity: 0.5 }),
        ellipse(36, -12, 13, 8, { fill: '#E6A49B', opacity: 0.5 }),
        stroke('M-31 -49 Q-24 -53 -17 -49 M17 -49 Q24 -53 31 -49', '#AA8270', 1.8, 0.65),
        stroke('M-4 -18 Q3 -20 5 -14 Q1 -10 -2 -13', '#BF8D78', 1.5),
        path('M-9 -2 Q0 7 9 -2 Q5 13 0 13 Q-5 13 -9 -2Z', { fill: '#B57E72' }),
        stroke('M-5 7 Q0 5 5 7', '#EAB3A6', 1.5),
        path(
          'M-8 -91 C-26 -107 -7 -116 4 -103 C14 -91 -8 -82 -10 -96 C-4 -91 5 -95 0 -101 Q-9 -110 -14 -102Z',
          { fill: '#A78164' },
        ),
        stroke('M-27 -82 Q-17 -91 -8 -88 M12 -84 Q23 -86 30 -79', '#B28F70', 1.5, 0.55),
      ]),
    ],
    [
      'eye-left',
      'eye',
      group([
        ellipse(-23, -32, 4.7, 6, { fill: INK }),
        circle(-24.4, -34, 1.5, { fill: '#FFF9EF' }),
      ]),
    ],
    [
      'eye-right',
      'eye',
      group([ellipse(23, -32, 4.7, 6, { fill: INK }), circle(21.6, -34, 1.5, { fill: '#FFF9EF' })]),
    ],
  ];
  if (variant === 'girl')
    entries.push([
      'hair-flower',
      'head',
      group([
        path(
          'M-46 -67 Q-69 -59 -57 -42 Q-68 -46 -67 -58 Q-65 -72 -49 -75 M47 -66 Q66 -57 56 -43 Q69 -48 66 -60 Q63 -73 49 -74',
          { fill: '#A78164' },
        ),
        path(
          'M39 -78 C26 -89 27 -67 38 -72 C36 -58 54 -63 46 -73 C61 -72 55 -90 45 -81 C47 -95 29 -92 39 -78Z',
          { fill: '#F0DEC0' },
        ),
        circle(42, -77, 3.4, { fill: '#C8A777' }),
      ]),
    ]);
  return {
    schemaVersion: 1,
    variant,
    artworkRevision: `lumi.baby.${variant}.v1`,
    parts: entries.map(([id, role, geometry], order) => ({ id, role, geometry, order })),
    pivots: {
      head: { x: 0, y: -20 },
      leftHand: { x: -34, y: 34 },
      rightHand: { x: 34, y: 34 },
      leftFoot: { x: -28, y: 100 },
      rightFoot: { x: 28, y: 100 },
    },
  };
}
export const BABY_BLUEPRINTS: Readonly<Record<LumiBabyVariant, BabyBlueprint>> = {
  neutral: makeBaby('neutral'),
  girl: makeBaby('girl'),
  boy: makeBaby('boy'),
};
export function prepareBabyParts(
  variant: LumiBabyVariant = 'neutral',
  pose: LumiBabyPose = 'sitting',
): readonly CharacterPart[] {
  const blueprint = BABY_BLUEPRINTS[variant];
  return blueprint.parts.map((part) => {
    if (part.id === 'shadow')
      return pose === 'reclined'
        ? { ...part, geometry: ellipse(15, 105, 105, 8, { fill: '#6E8068', opacity: 0.1 }) }
        : part;
    let transform: string | undefined;
    if (pose === 'reclined') transform = 'rotate(-65 0 25)';
    else if (pose === 'tummy') {
      transform =
        part.role === 'head' || part.role === 'eye'
          ? 'translate(-44 80)'
          : part.id.includes('hand')
            ? 'translate(-48 53) rotate(-22 0 45)'
            : 'translate(32 30) rotate(-77 0 65)';
    } else if (pose === 'standing' && part.id.includes('foot')) transform = 'translate(0 18)';
    return transform ? { ...part, transform } : part;
  });
}
export function compileBaby(
  variant: LumiBabyVariant = 'neutral',
  pose: LumiBabyPose = 'sitting',
): VectorNode {
  return group(
    prepareBabyParts(variant, pose).map((part) =>
      group([part.geometry], part.transform ? { transform: part.transform } : {}),
    ),
  );
}
