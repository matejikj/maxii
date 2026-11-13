/**
 * Soft-compact anatomy for owl (Eli), squirrel (Tili) and fawn (Runi).
 * Shares the rabbit pilot recipe: matte fills, calm blush, small dark eyes,
 * a simple smile and a seed mark on the belly. Silhouettes differ per species;
 * part ids and roles stay semantic so rigs and motion can address them.
 */
import type { CharacterPart } from './blueprint';
import type { VectorNode, VectorProps } from '../vector/types';

type PartInput = Omit<CharacterPart, 'order'>;

const INK_OWL = '#5A4F55';
const INK_SQUIRREL = '#5E4639';
const INK_FAWN = '#5B4A3F';

const ellipse = (id: string, role: CharacterPart['role'], props: VectorProps): PartInput => ({
  id,
  role,
  geometry: { kind: 'ellipse', props },
});
const circle = (id: string, role: CharacterPart['role'], props: VectorProps): PartInput => ({
  id,
  role,
  geometry: { kind: 'circle', props },
});
const path = (id: string, role: CharacterPart['role'], props: VectorProps): PartInput => ({
  id,
  role,
  geometry: { kind: 'path', props },
});

const eye = (id: string, cx: number, cy: number, fill: string): PartInput =>
  ellipse(id, 'eye', { cx, cy, rx: 4, ry: 5, fill });

const smile = (d: string, stroke: string): PartInput =>
  path('mouth', 'mouth', { d, fill: 'none', stroke, strokeWidth: 2.4, strokeLinecap: 'round' });

const seedMark = (transform: string, fill: string): PartInput => {
  const children: readonly VectorNode[] = [
    { kind: 'path', props: { d: 'M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z', fill } },
    {
      kind: 'path',
      props: {
        d: 'M0 0Q4 -4 7 -3',
        stroke: '#FFFFFF',
        strokeWidth: 1.3,
        fill: 'none',
        strokeLinecap: 'round',
      },
    },
  ];
  return {
    id: 'seed-mark',
    role: 'mark',
    geometry: { kind: 'group', props: { transform }, children },
  };
};

const highlight = (d: string, opacity: number): PartInput =>
  path('highlight', 'mark', {
    d,
    fill: 'none',
    stroke: '#FFFFFF',
    strokeWidth: 2.2,
    opacity,
    strokeLinecap: 'round',
  });

/** Assigns sequential painter order in authored sequence. */
const withOrder = (parts: readonly PartInput[]): readonly CharacterPart[] =>
  parts.map((part, order) => ({ ...part, order }));

export const OWL_ANATOMY: readonly CharacterPart[] = withOrder([
  ellipse('shadow', 'shadow', { cx: 0, cy: 167, rx: 70, ry: 8, fill: '#6E947F', opacity: 0.12 }),
  path('ear-left-tuft', 'ear', { d: 'M-72 -44 L-84 -116 Q-48 -102 -22 -74Z', fill: '#B5A39F' }),
  path('ear-right-tuft', 'ear', { d: 'M72 -44 L84 -116 Q48 -102 22 -74Z', fill: '#B5A39F' }),
  path('ear-left-inner', 'ear', {
    d: 'M-66 -58 L-74 -98 Q-52 -90 -38 -70Z',
    fill: '#DCC9C6',
    opacity: 0.85,
  }),
  path('ear-right-inner', 'ear', {
    d: 'M66 -58 L74 -98 Q52 -90 38 -70Z',
    fill: '#DCC9C6',
    opacity: 0.85,
  }),
  ellipse('body', 'body', { cx: 0, cy: 80, rx: 82, ry: 82, fill: '#A89890' }),
  ellipse('belly', 'belly', { cx: 0, cy: 86, rx: 52, ry: 58, fill: '#E6DAD3' }),
  path('chest-feathers', 'mark', {
    d: 'M-20 62 Q-14 70 -8 62 M8 62 Q14 70 20 62 M-6 76 Q0 84 6 76',
    fill: 'none',
    stroke: '#C9B8B0',
    strokeWidth: 2.5,
    opacity: 0.8,
    strokeLinecap: 'round',
  }),
  ellipse('paw-left', 'paw', {
    cx: -74,
    cy: 92,
    rx: 17,
    ry: 38,
    transform: 'rotate(-14 -74 92)',
    fill: '#9A8A8C',
  }),
  ellipse('paw-right', 'paw', {
    cx: 74,
    cy: 92,
    rx: 17,
    ry: 38,
    transform: 'rotate(14 74 92)',
    fill: '#9A8A8C',
  }),
  ellipse('foot-left', 'paw', { cx: -30, cy: 154, rx: 22, ry: 12, fill: '#D2A872' }),
  ellipse('foot-right', 'paw', { cx: 30, cy: 154, rx: 22, ry: 12, fill: '#D2A872' }),
  ellipse('head', 'head', { cx: 0, cy: -2, rx: 92, ry: 80, fill: '#C9B8B0' }),
  ellipse('face-disc-left', 'muzzle', {
    cx: -32,
    cy: 4,
    rx: 30,
    ry: 28,
    fill: '#E6DAD3',
    opacity: 0.9,
  }),
  ellipse('face-disc-right', 'muzzle', {
    cx: 32,
    cy: 4,
    rx: 30,
    ry: 28,
    fill: '#E6DAD3',
    opacity: 0.9,
  }),
  ellipse('cheek-left', 'cheek', { cx: -60, cy: 28, rx: 14, ry: 9, fill: '#E6B3B0', opacity: 0.7 }),
  ellipse('cheek-right', 'cheek', { cx: 60, cy: 28, rx: 14, ry: 9, fill: '#E6B3B0', opacity: 0.7 }),
  eye('eye-left', -30, 6, INK_OWL),
  eye('eye-right', 30, 6, INK_OWL),
  path('nose', 'nose', { d: 'M-7 15 Q0 11 7 15 Q4 29 0 31 Q-4 29 -7 15Z', fill: '#D9A66B' }),
  smile('M-9 38 Q0 44 9 38', '#8A6A68'),
  seedMark('translate(0 100) scale(0.8)', '#B3C7AB'),
  highlight('M-60 -56 Q-52 -66 -42 -62', 0.55),
]);

export const SQUIRREL_ANATOMY: readonly CharacterPart[] = withOrder([
  ellipse('shadow', 'shadow', { cx: 0, cy: 169, rx: 66, ry: 8, fill: '#6E947F', opacity: 0.12 }),
  path('tail', 'tail', {
    d: 'M56 148 C140 160 190 90 160 20 C148 -10 128 -30 112 -34 C100 -14 112 8 116 34 C122 70 104 104 70 112Z',
    fill: '#C8875A',
  }),
  path('tail-tip', 'tail', {
    d: 'M148 10 C140 -10 126 -26 114 -30 C104 -16 114 4 120 22 Q138 26 148 10Z',
    fill: '#F0C79E',
  }),
  path('ear-left-outer', 'ear', { d: 'M-76 -36 L-70 -112 Q-42 -100 -24 -68Z', fill: '#C8875A' }),
  path('ear-right-outer', 'ear', { d: 'M76 -36 L70 -112 Q42 -100 24 -68Z', fill: '#C8875A' }),
  path('ear-left-inner', 'ear', {
    d: 'M-66 -52 L-62 -94 Q-46 -84 -36 -64Z',
    fill: '#EBBFA4',
    opacity: 0.85,
  }),
  path('ear-right-inner', 'ear', {
    d: 'M66 -52 L62 -94 Q46 -84 36 -64Z',
    fill: '#EBBFA4',
    opacity: 0.85,
  }),
  ellipse('body', 'body', { cx: 0, cy: 78, rx: 74, ry: 88, fill: '#C8875A' }),
  ellipse('belly', 'belly', { cx: 0, cy: 88, rx: 48, ry: 60, fill: '#F3DDBF' }),
  ellipse('paw-left', 'paw', {
    cx: -46,
    cy: 98,
    rx: 18,
    ry: 14,
    transform: 'rotate(-24 -46 98)',
    fill: '#BA7A50',
  }),
  ellipse('paw-right', 'paw', {
    cx: 46,
    cy: 98,
    rx: 18,
    ry: 14,
    transform: 'rotate(24 46 98)',
    fill: '#BA7A50',
  }),
  ellipse('foot-left', 'paw', { cx: -36, cy: 154, rx: 24, ry: 14, fill: '#BA7A50' }),
  ellipse('foot-right', 'paw', { cx: 36, cy: 154, rx: 24, ry: 14, fill: '#BA7A50' }),
  ellipse('head', 'head', { cx: 0, cy: -3, rx: 86, ry: 76, fill: '#E0A878' }),
  ellipse('muzzle', 'muzzle', { cx: 0, cy: 25, rx: 30, ry: 20, fill: '#F5E0C5' }),
  ellipse('cheek-left', 'cheek', {
    cx: -56,
    cy: 24,
    rx: 16,
    ry: 10,
    fill: '#E8A998',
    opacity: 0.72,
  }),
  ellipse('cheek-right', 'cheek', {
    cx: 56,
    cy: 24,
    rx: 16,
    ry: 10,
    fill: '#E8A998',
    opacity: 0.72,
  }),
  eye('eye-left', -30, 6, INK_SQUIRREL),
  eye('eye-right', 30, 6, INK_SQUIRREL),
  circle('nose', 'nose', { cx: 0, cy: 18, r: 4, fill: '#7A4A38' }),
  smile('M-7 30 Q0 36 7 30', '#8E5A48'),
  seedMark('translate(0 98) scale(0.8)', '#B3C7AB'),
  highlight('M-52 -48 Q-46 -56 -38 -54', 0.55),
]);

export const FAWN_ANATOMY: readonly CharacterPart[] = withOrder([
  ellipse('shadow', 'shadow', { cx: 0, cy: 184, rx: 68, ry: 8, fill: '#6E947F', opacity: 0.12 }),
  ellipse('ear-left-outer', 'ear', {
    cx: -62,
    cy: -86,
    rx: 19,
    ry: 54,
    transform: 'rotate(-24 -62 -86)',
    fill: '#E4C4A0',
  }),
  ellipse('ear-right-outer', 'ear', {
    cx: 62,
    cy: -86,
    rx: 19,
    ry: 54,
    transform: 'rotate(24 62 -86)',
    fill: '#E4C4A0',
  }),
  ellipse('ear-left-inner', 'ear', {
    cx: -62,
    cy: -86,
    rx: 9,
    ry: 38,
    transform: 'rotate(-24 -62 -86)',
    fill: '#E6BDB0',
    opacity: 0.8,
  }),
  ellipse('ear-right-inner', 'ear', {
    cx: 62,
    cy: -86,
    rx: 9,
    ry: 38,
    transform: 'rotate(24 62 -86)',
    fill: '#E6BDB0',
    opacity: 0.8,
  }),
  ellipse('hoof-left', 'paw', { cx: -34, cy: 174, rx: 15, ry: 9, fill: '#8A6650' }),
  ellipse('hoof-right', 'paw', { cx: 34, cy: 174, rx: 15, ry: 9, fill: '#8A6650' }),
  ellipse('leg-left', 'paw', { cx: -34, cy: 148, rx: 17, ry: 26, fill: '#C79A74' }),
  ellipse('leg-right', 'paw', { cx: 34, cy: 148, rx: 17, ry: 26, fill: '#C79A74' }),
  ellipse('body', 'body', { cx: 0, cy: 78, rx: 76, ry: 90, fill: '#D4A882' }),
  ellipse('belly', 'belly', { cx: 0, cy: 90, rx: 46, ry: 60, fill: '#F6EBDD' }),
  ellipse('spot-left', 'mark', {
    cx: -40,
    cy: 56,
    rx: 9,
    ry: 6,
    transform: 'rotate(-20 -40 56)',
    fill: '#F2E4D4',
    opacity: 0.9,
  }),
  ellipse('spot-right', 'mark', {
    cx: 38,
    cy: 44,
    rx: 8,
    ry: 5.5,
    transform: 'rotate(18 38 44)',
    fill: '#F2E4D4',
    opacity: 0.9,
  }),
  ellipse('paw-left', 'paw', {
    cx: -62,
    cy: 102,
    rx: 15,
    ry: 26,
    transform: 'rotate(-10 -62 102)',
    fill: '#C79A74',
  }),
  ellipse('paw-right', 'paw', {
    cx: 62,
    cy: 102,
    rx: 15,
    ry: 26,
    transform: 'rotate(10 62 102)',
    fill: '#C79A74',
  }),
  ellipse('head', 'head', { cx: 0, cy: -2, rx: 80, ry: 72, fill: '#F2E4D4' }),
  ellipse('muzzle', 'muzzle', { cx: 0, cy: 26, rx: 30, ry: 22, fill: '#F9EFE3' }),
  ellipse('cheek-left', 'cheek', {
    cx: -52,
    cy: 24,
    rx: 15,
    ry: 10,
    fill: '#E8B3A6',
    opacity: 0.68,
  }),
  ellipse('cheek-right', 'cheek', {
    cx: 52,
    cy: 24,
    rx: 15,
    ry: 10,
    fill: '#E8B3A6',
    opacity: 0.68,
  }),
  eye('eye-left', -28, 6, INK_FAWN),
  eye('eye-right', 28, 6, INK_FAWN),
  ellipse('nose', 'nose', { cx: 0, cy: 20, rx: 6, ry: 4.5, fill: '#8A6258' }),
  smile('M-6 32 Q0 38 6 32', '#9A6E62'),
  seedMark('translate(0 104) scale(0.8)', '#B3C7AB'),
  highlight('M-48 -44 Q-42 -52 -34 -50', 0.55),
]);

export const NEW_SPECIES_ANATOMY = {
  owl: OWL_ANATOMY,
  squirrel: SQUIRREL_ANATOMY,
  fawn: FAWN_ANATOMY,
} as const;
