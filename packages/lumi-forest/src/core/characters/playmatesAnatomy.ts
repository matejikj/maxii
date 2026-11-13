import type { CharacterPart } from './blueprint';
import { circle, ellipse, group, path } from '../vector/nodes';
import type { VectorNode } from '../vector/types';

// Authored volumes and details remain inside their semantic owner, so every
// existing expression, proportion, pose and motion pass can use the new guides.
const line = (d: string, color: string, width = 2, opacity = 1) =>
  path(d, {
    fill: 'none',
    stroke: color,
    strokeWidth: width,
    opacity,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  });
function parts(
  entries: readonly [string, CharacterPart['role'], VectorNode][],
): readonly CharacterPart[] {
  return entries.map(([id, role, geometry], order) => ({ id, role, geometry, order }));
}
const eye = (x: number, ink: string) =>
  group([ellipse(x, 3, 5.6, 7, { fill: ink }), circle(x - 1.8, 0.7, 1.8, { fill: '#FFF8ED' })]);
const toes = (x: number, fill: string) =>
  group([
    path(
      `M${x - 23} 147 C${x - 26} 130 ${x + 17} 129 ${x + 25} 148 Q${x + 28} 161 ${x + 4} 163 Q${x - 22} 166 ${x - 23} 147Z`,
      { fill },
    ),
    line(`M${x - 8} 153 l-1 5 M${x} 154 v5 M${x + 8} 153 l1 5`, '#856E65', 1.5, 0.5),
  ]);
const seed = group([
  path('M0 91 C10 95 11 102 0 113 C-11 102 -10 95 0 91Z', { fill: '#B7C79D' }),
  line('M0 107 l0 -9 M0 102 l4 -3', '#F9F4DD', 1.3),
]);
export const TIGER_ANATOMY = parts([
  ['shadow', 'shadow', ellipse(0, 166, 65, 7, { fill: '#6E8068', opacity: 0.12 })],
  [
    'tail',
    'tail',
    group([
      path('M57 136 C111 144 143 113 125 85 C113 70 99 83 107 95 C120 111 98 127 66 120Z', {
        fill: '#D9A36B',
      }),
      path('M118 79 Q134 80 134 95 L114 99 Q103 89 109 83Z M102 118 l10 14 -12 5 -8 -13Z', {
        fill: '#88705F',
      }),
      line('M72 135 Q99 138 116 121', '#F1C890', 2, 0.7),
    ]),
  ],
  [
    'ear-left',
    'ear',
    group([
      ellipse(-64, -60, 24, 26, { fill: '#C89160' }),
      ellipse(-64, -60, 15, 17, { fill: '#F1CEB0' }),
      ellipse(-64, -60, 8, 10, { fill: '#B57D60', opacity: 0.4 }),
    ]),
  ],
  [
    'ear-right',
    'ear',
    group([
      ellipse(64, -60, 24, 26, { fill: '#C89160' }),
      ellipse(64, -60, 15, 17, { fill: '#F1CEB0' }),
    ]),
  ],
  [
    'body',
    'body',
    group([
      path(
        'M0 -4 C47 -3 64 32 68 64 C80 96 85 130 62 148 C38 170 -37 171 -61 150 C-86 130 -77 96 -68 64 C-63 30 -48 -3 0 -4Z',
        { fill: '#D9A36B' },
      ),
      path('M52 36 C83 102 70 137 38 151 Q-1 170 -39 153 Q32 179 63 148 C85 130 80 96 68 64Z', {
        fill: '#BB8557',
        opacity: 0.6,
      }),
      path(
        'M-63 54 l24 10 -24 8Z M-72 86 l26 7 -24 10Z M63 54 l-24 10 24 8Z M72 86 l-26 7 24 10Z',
        { fill: '#8B715E' },
      ),
    ]),
  ],
  [
    'belly',
    'belly',
    group([
      path(
        'M0 34 C-37 34 -48 67 -47 103 C-47 144 -24 155 0 155 C28 155 49 140 47 100 C46 65 35 34 0 34Z',
        { fill: '#F4E0BC' },
      ),
      line('M-27 53 Q-43 82 -35 114', '#FFF3D9', 2.2, 0.7),
    ]),
  ],
  [
    'paw-left',
    'paw',
    group([
      path('M-53 70 C-75 73 -80 103 -64 111 C-49 117 -34 101 -38 86 Q-40 72 -53 70Z', {
        fill: '#C99160',
      }),
      line('M-66 97 l4 3 M-61 91 l5 3', '#8B715E', 2),
    ]),
  ],
  [
    'paw-right',
    'paw',
    group([
      path('M53 70 C75 73 80 103 64 111 C49 117 34 101 38 86 Q40 72 53 70Z', { fill: '#C99160' }),
      line('M66 97 l-4 3 M61 91 l-5 3', '#8B715E', 2),
    ]),
  ],
  ['foot-left', 'paw', toes(-37, '#D1A072')],
  ['foot-right', 'paw', toes(37, '#D1A072')],
  [
    'head',
    'head',
    group([
      path(
        'M0 -78 C43 -80 70 -57 77 -30 L87 -2 81 -5 89 12 81 10 C87 42 50 67 0 69 C-48 67 -86 43 -81 10 L-89 12 -81 -5 -87 -2 -77 -30 C-70 -57 -43 -80 0 -78Z',
        { fill: '#E3B27D' },
      ),
      path('M65 -45 C93 10 74 46 35 58 Q-10 75 -51 50 C-29 78 56 77 81 35 Q94 10 65 -45Z', {
        fill: '#C49467',
        opacity: 0.5,
      }),
      path('M-49 -57 C-37 -75 0 -80 24 -69 Q-15 -71 -41 -49Z', { fill: '#F3CEA1', opacity: 0.8 }),
      path(
        'M-8 -77 l8 25 8 -25Z M-35 -70 l12 20 5 -26Z M35 -70 l-12 20 -5 -26Z M-79 -24 l25 7 -25 7Z M79 -24 l-25 7 25 7Z M-84 7 l23 8 -18 7Z M84 7 l-23 8 18 7Z',
        { fill: '#8B715E' },
      ),
      line('M-22 -42 Q-13 -48 -7 -42 M8 -42 Q17 -49 23 -42', '#BE8C5D', 1.7, 0.7),
    ]),
  ],
  [
    'muzzle',
    'muzzle',
    group([
      path('M-4 19 C-35 4 -51 25 -39 42 C-28 54 -9 48 0 43 C9 48 28 54 39 42 C51 25 35 4 4 19Z', {
        fill: '#F7E9CF',
      }),
      line('M-30 30 h-3 M-24 35 h-3 M30 30 h3 M24 35 h3', '#B2A18A', 1.8),
    ]),
  ],
  ['cheek-left', 'cheek', ellipse(-56, 25, 13, 8, { fill: '#E6A590', opacity: 0.5 })],
  ['cheek-right', 'cheek', ellipse(56, 25, 13, 8, { fill: '#E6A590', opacity: 0.5 })],
  ['eye-left', 'eye', eye(-29, '#655247')],
  ['eye-right', 'eye', eye(29, '#655247')],
  [
    'nose',
    'nose',
    group([
      path('M-8 16 Q0 10 8 16 Q7 23 0 25 Q-7 23 -8 16Z', { fill: '#9E7465' }),
      line('M-4 16 Q0 14 3 16', '#EDCBB4', 1.3),
    ]),
  ],
  ['mouth', 'mouth', line('M0 25 v7 M-11 31 Q0 45 11 31', '#655247', 2.1)],
  ['seed-mark', 'mark', seed],
]);

export const HIPPO_ANATOMY = parts([
  ['shadow', 'shadow', ellipse(0, 166, 69, 7, { fill: '#6E8068', opacity: 0.12 })],
  [
    'ear-left',
    'ear',
    group([
      path('M-57 -48 C-93 -47 -94 -91 -72 -91 C-50 -92 -41 -66 -57 -48Z', { fill: '#A6A4BC' }),
      ellipse(-70, -71, 10, 13, { fill: '#D7BDC9' }),
      line('M-77 -76 Q-83 -64 -72 -59', '#8E8FA8', 1.8),
    ]),
  ],
  [
    'ear-right',
    'ear',
    group([
      path('M57 -48 C93 -47 94 -91 72 -91 C50 -92 41 -66 57 -48Z', { fill: '#A6A4BC' }),
      ellipse(70, -71, 10, 13, { fill: '#D7BDC9' }),
    ]),
  ],
  [
    'body',
    'body',
    group([
      path(
        'M0 -2 C47 -2 65 30 73 68 C88 107 90 141 58 155 C29 170 -35 170 -62 152 C-91 134 -83 99 -72 66 C-65 28 -45 -2 0 -2Z',
        { fill: '#AEAEC4' },
      ),
      path(
        'M59 39 C77 90 80 130 52 148 Q19 169 -31 155 C14 179 76 160 82 133 C92 104 73 66 59 39Z',
        { fill: '#9195AE', opacity: 0.6 },
      ),
      line('M-52 40 Q-66 65 -63 84', '#CECCDA', 3, 0.65),
    ]),
  ],
  [
    'belly',
    'belly',
    group([
      path(
        'M0 36 C-42 36 -52 73 -46 116 C-40 151 -15 158 6 154 C44 149 55 122 48 90 C42 57 30 36 0 36Z',
        { fill: '#D8CCD6' },
      ),
      line('M-24 55 Q-40 78 -34 104', '#ECE1E5', 2, 0.8),
    ]),
  ],
  [
    'paw-left',
    'paw',
    group([
      path('M-56 75 C-84 75 -86 110 -64 116 C-42 121 -31 98 -43 84 Q-48 77 -56 75Z', {
        fill: '#9DA0B8',
      }),
      line('M-69 105 l4 3 M-61 108 l1 3', '#7F849F', 1.7),
    ]),
  ],
  [
    'paw-right',
    'paw',
    group([
      path('M56 75 C84 75 86 110 64 116 C42 121 31 98 43 84 Q48 77 56 75Z', { fill: '#9DA0B8' }),
      line('M69 105 l-4 3 M61 108 l-1 3', '#7F849F', 1.7),
    ]),
  ],
  ['foot-left', 'paw', toes(-40, '#9CA0B8')],
  ['foot-right', 'paw', toes(40, '#9CA0B8')],
  [
    'head',
    'head',
    group([
      path(
        'M0 -74 C47 -75 75 -48 78 -8 C89 35 60 65 0 66 C-60 65 -88 35 -78 -8 C-75 -48 -47 -75 0 -74Z',
        { fill: '#BFC0D1' },
      ),
      path('M62 -46 C92 12 66 50 29 57 Q-21 70 -57 40 C-25 78 63 78 80 35 Q91 0 62 -46Z', {
        fill: '#9CA2BC',
        opacity: 0.5,
      }),
      path('M-54 -42 Q-37 -72 6 -67 Q-30 -63 -47 -35Z', { fill: '#DFDCE6', opacity: 0.6 }),
      line('M-32 -31 Q-26 -35 -20 -31 M20 -31 Q26 -35 32 -31', '#9398B1', 2, 0.65),
    ]),
  ],
  [
    'muzzle',
    'muzzle',
    group([
      path('M0 8 C-41 -4 -76 7 -74 31 C-73 56 -37 65 0 63 C38 65 74 55 74 30 C76 7 41 -4 0 8Z', {
        fill: '#D4C6D3',
      }),
      path('M-69 36 Q-53 66 0 63 Q60 65 71 37 Q38 57 0 54 Q-42 56 -69 36Z', {
        fill: '#B6ACBF',
        opacity: 0.55,
      }),
      line('M-54 15 Q-34 5 -17 15', '#E8DBE2', 2.5, 0.65),
      ellipse(-34, 19, 6, 4, { fill: '#9493AA' }),
      ellipse(34, 19, 6, 4, { fill: '#9493AA' }),
    ]),
  ],
  ['cheek-left', 'cheek', ellipse(-62, 34, 12, 7, { fill: '#DFAEBB', opacity: 0.5 })],
  ['cheek-right', 'cheek', ellipse(62, 34, 12, 7, { fill: '#DFAEBB', opacity: 0.5 })],
  ['eye-left', 'eye', eye(-30, '#626379')],
  ['eye-right', 'eye', eye(30, '#626379')],
  ['nose', 'nose', line('M-3 16 Q0 17 3 16', '#B1A7BB', 1.5, 0.5)],
  ['mouth', 'mouth', line('M-17 40 Q0 54 17 40', '#76738D', 2.1)],
  ['seed-mark', 'mark', seed],
]);
