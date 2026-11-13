import type { LumiAnimal } from '../types';
import { circle, ellipse, group, path } from '../vector/nodes';
import type { VectorNode, VectorProps } from '../vector/types';
import type { CharacterPart } from './blueprint';

/**
 * Authoring pass for the bundled artwork, never a compiler/runtime effect.
 * Detail lives INSIDE its anatomical owner: an ear fold sways with the ear,
 * toes follow the paw, and facial fur follows head proportions and poses.
 * Only the existing IR vocabulary is used (no filters, masks or raster assets).
 */
interface SculptProfile {
  readonly ink: string;
  readonly eyes: readonly [x: number, y: number];
  readonly headPath: string;
  readonly bodyPath: string;
}

/** This authoring pass owns its supported profiles. Adding a character to the
 * global catalog does not require changing this converter. */
const SCULPT_PROFILES = {
  rabbit: {
    ink: '#5A5550', eyes: [30, 7],
    headPath: 'M0 -1 C.4 -1 .73 -.79 .85 -.48 C.91 -.33 .9 -.2 .96 -.09 L.91 -.1 C1.05 .17 .92 .57 .63 .77 C.29 1.02 -.3 1.02 -.64 .78 C-.93 .58 -1.04 .22 -.93 -.05 L-.98 -.03 C-.88 -.24 -.92 -.41 -.8 -.61 C-.63 -.87 -.34 -1 0 -1Z',
    bodyPath: 'M0 -1 C.4 -1 .61 -.73 .69 -.39 C.75 -.14 1.04 .19 .94 .55 C.88 .83 .55 1.02 0 1 C-.55 1.02 -.88 .83 -.94 .55 C-1.04 .19 -.75 -.14 -.69 -.39 C-.61 -.73 -.4 -1 0 -1Z',
  },
  bear: {
    ink: '#66544B', eyes: [31, 2],
    headPath: 'M0 -1 C.46 -1 .78 -.79 .89 -.43 L.94 -.2 .9 -.23 C1.05 .12 .94 .57 .63 .8 C.29 1.03 -.3 1.03 -.65 .79 C-.98 .55 -1.04 .14 -.92 -.19 L-.97 -.17 C-.86 -.37 -.88 -.56 -.73 -.72 C-.54 -.92 -.27 -1 0 -1Z',
    bodyPath: 'M0 -1 C.46 -1 .78 -.65 .81 -.28 C.88 .01 1.02 .33 .91 .65 C.79 1.05 -.72 1.08 -.9 .67 C-1.05 .32 -.87 -.01 -.81 -.28 C-.78 -.65 -.46 -1 0 -1Z',
  },
  fox: {
    ink: '#705B58', eyes: [31, 4],
    headPath: 'M0 -1 C.43 -.99 .72 -.79 .8 -.48 C.84 -.28 .83 -.1 .97 .05 L.89 .03 1 .19 .88 .17 C.82 .57 .38 .86 0 1 C-.38 .86 -.82 .57 -.88 .17 L-1 .19 -.89 .03 -.97 .05 C-.83 -.1 -.84 -.28 -.8 -.48 C-.72 -.79 -.43 -.99 0 -1Z',
    bodyPath: 'M0 -1 C.35 -.98 .55 -.76 .63 -.46 L.72 -.23 .67 -.24 C.88 .08 1.02 .48 .8 .76 C.51 1.07 -.53 1.07 -.82 .75 C-1.01 .48 -.87 .07 -.67 -.24 L-.72 -.23 -.63 -.46 C-.55 -.76 -.35 -.98 0 -1Z',
  },
  otter: {
    ink: '#594D4A', eyes: [31, 0],
    headPath: 'M0 -1 C.48 -1 .78 -.78 .84 -.44 C.88 -.22 .91 -.16 .98 -.04 L.93 -.06 C1.04 .2 .9 .59 .64 .79 C.31 1.04 -.32 1.04 -.65 .79 C-.94 .57 -1.01 .19 -.94 -.05 L-.98 -.03 C-.85 -.25 -.9 -.45 -.78 -.65 C-.62 -.9 -.28 -1 0 -1Z',
    bodyPath: 'M0 -1 C.34 -1 .61 -.8 .66 -.43 C.7 -.08 .95 .32 .84 .67 C.68 1.08 -.67 1.08 -.84 .67 C-.96 .31 -.7 -.08 -.66 -.43 C-.61 -.8 -.34 -1 0 -1Z',
  },
  hedgehog: {
    ink: '#5D514D', eyes: [28, 2],
    headPath: 'M0 -1 C.43 -1 .77 -.72 .84 -.4 C.92 -.08 1 .16 .83 .46 C.65 .78 .27 .94 0 1 C-.27 .94 -.65 .78 -.83 .46 C-1 .16 -.92 -.08 -.84 -.4 C-.77 -.72 -.43 -1 0 -1Z',
    bodyPath: 'M0 -1 C.49 -.99 .8 -.55 .87 -.19 C1.08 .24 1.02 .68 .67 .85 C.31 1.05 -.4 1.04 -.72 .83 C-1.05 .61 -1.03 .21 -.87 -.19 C-.8 -.55 -.49 -.99 0 -1Z',
  },
  owl: {
    ink: '#5A4F55', eyes: [30, 6],
    headPath: 'M0 -.86 C.23 -1.05 .65 -1.02 .85 -.69 C.94 -.52 .95 -.3 .93 -.12 L1 -.02 .94 0 C1.05 .32 .77 .77 .44 .91 C.2 1.03 -.2 1.03 -.44 .91 C-.77 .77 -1.05 .32 -.94 0 L-1 -.02 -.93 -.12 C-.95 -.3 -.94 -.52 -.85 -.69 C-.65 -1.02 -.23 -1.05 0 -.86Z',
    bodyPath: 'M0 -1 C.58 -.99 .82 -.58 .89 -.15 C1.06 .35 .81 .77 .48 .88 L.39 .97 .26 .94 .14 1 0 .97 -.14 1 -.26 .94 -.39 .97 -.48 .88 C-.81 .77 -1.06 .35 -.89 -.15 C-.82 -.58 -.58 -.99 0 -1Z',
  },
  squirrel: {
    ink: '#5E4639', eyes: [28, 4],
    headPath: 'M0 -1 C.4 -1 .68 -.82 .79 -.51 C.87 -.27 .8 -.15 .96 .02 L.89 0 1 .18 .93 .17 C1.01 .48 .63 .86 .31 .94 C.1 1.02 -.1 1.02 -.31 .94 C-.63 .86 -1.01 .48 -.93 .17 L-1 .18 -.89 0 -.96 .02 C-.8 -.15 -.87 -.27 -.79 -.51 C-.68 -.82 -.4 -1 0 -1Z',
    bodyPath: 'M0 -1 C.31 -1 .56 -.73 .6 -.43 C.7 -.12 .99 .28 .88 .63 C.76 1.1 -.75 1.1 -.88 .63 C-.99 .28 -.7 -.12 -.6 -.43 C-.56 -.73 -.31 -1 0 -1Z',
  },
  fawn: {
    ink: '#5B4A3F', eyes: [29, 5],
    headPath: 'M0 -1 C.35 -1 .63 -.86 .73 -.59 C.79 -.38 .77 -.25 .9 -.06 L.84 -.09 C.98 .18 .8 .52 .59 .71 C.35 .92 .16 1.04 0 1.04 C-.16 1.04 -.35 .92 -.59 .71 C-.8 .52 -.98 .18 -.84 -.09 L-.9 -.06 C-.77 -.25 -.79 -.38 -.73 -.59 C-.63 -.86 -.35 -1 0 -1Z',
    bodyPath: 'M0 -1 C.27 -1 .48 -.72 .56 -.39 C.65 -.08 .89 .24 .8 .59 C.7 .98 .31 1.01 0 1 C-.31 1.01 -.7 .98 -.8 .59 C-.89 .24 -.65 -.08 -.56 -.39 C-.48 -.72 -.27 -1 0 -1Z',
  },
} as const satisfies Partial<Record<LumiAnimal, SculptProfile>>;

type SculptedAnimal = keyof typeof SCULPT_PROFILES;

/** Matte material colors with a shared light source above/left. */
function tint(hex: string, target: string, amount: number): string {
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(hex.slice(offset, offset + 2), 16);
    const b = parseInt(target.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * amount).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

const line = (d: string, stroke: string, strokeWidth: number, opacity = 1): VectorNode =>
  path(d, { fill: 'none', stroke, strokeWidth, opacity, strokeLinecap: 'round', strokeLinejoin: 'round' });

function local(props: VectorProps): VectorProps {
  const { cx = 0, cy = 0, rx = props.r ?? 1, ry = props.r ?? 1, transform } = props;
  return { transform: `${transform ? `${transform} ` : ''}translate(${cx} ${cy}) scale(${rx} ${ry})` };
}

function sculptHead(species: SculptedAnimal, props: VectorProps): VectorNode {
  const profile = SCULPT_PROFILES[species];
  // Fawn retains a warm coat with a pale blaze instead of a white circular head.
  const fill = species === 'fawn' ? '#DDB58F' : props.fill!;
  const shade = tint(fill, profile.ink, 0.15);
  const children = [
    path(profile.headPath, { fill, stroke: shade, strokeWidth: 0.012, strokeLinejoin: 'round' }),
    path('M.72 -.53 C1 -.09 .85 .42 .51 .65 C.16 .89 -.38 .85 -.69 .62 C-.39 1.05 .29 1.09 .65 .79 C.98 .51 1.04 -.13 .72 -.53Z', { fill: shade, opacity: 0.55 }),
  ];
  if (species === 'fawn') {
    children.push(path('M-.12 -.96 Q0 -.9 .12 -.96 C.15 -.58 .08 -.29 .21 -.02 C.34 .22 .43 .5 .35 .74 Q0 1.04 -.35 .74 C-.43 .5 -.34 .22 -.21 -.02 C-.08 -.29 -.15 -.58 -.12 -.96Z M-.46 -.57 q-.07 -.05 -.1 .02 q0 .07 .08 .08 q.08 0 .02 -.1Z M.46 -.57 q.07 -.05 .1 .02 q0 .07 -.08 .08 q-.08 0 -.02 -.1Z', { fill: '#F2E4D4' }));
  } else {
    children.push(path('M-.69 -.51 C-.53 -.85 -.09 -.99 .25 -.85 C-.09 -.87 -.4 -.65 -.55 -.35 Q-.62 -.3 -.69 -.51Z', { fill: tint(fill, '#FFF9EF', 0.28), opacity: 0.38 }));
  }
  const fur = species === 'owl'
    ? 'M-.27 -.72 Q-.16 -.61 -.09 -.7 M.08 -.7 Q.17 -.61 .27 -.72 M-.55 -.48 Q-.47 -.41 -.41 -.46 M.4 -.46 Q.47 -.41 .55 -.48'
    : 'M-.2 -.78 Q-.13 -.86 -.04 -.8 M-.04 -.73 Q.06 -.83 .14 -.75 M-.67 .35 l.06 .04 M.63 .37 l.06 -.04';
  children.push(line(fur, tint(fill, profile.ink, 0.27), 0.018, 0.65));
  return group(children, local(props));
}

function sculptBody(species: SculptedAnimal, props: VectorProps): VectorNode {
  const profile = SCULPT_PROFILES[species];
  const fill = props.fill!;
  const shade = tint(fill, profile.ink, 0.16);
  return group([
    path(profile.bodyPath, { fill }),
    path(species === 'fawn'
      ? 'M.56 -.39 C.66 .04 .82 .32 .65 .6 C.41 .88 -.17 .97 -.56 .78 C-.17 1.07 .62 1.05 .8 .59 C.89 .24 .65 -.08 .56 -.39Z'
      : 'M.65 -.25 C.78 .06 .84 .39 .65 .64 C.41 .89 -.29 .95 -.65 .79 C-.27 1.08 .57 1.03 .79 .73 C.99 .46 .85 .03 .65 -.25Z', { fill: shade, opacity: 0.75 }),
  ], local(props));
}

function sculptBelly(props: VectorProps): VectorNode {
  return group([
    path('M0 -1 C.23 -.96 .29 -.87 .35 -.81 L.4 -.85 .42 -.71 C.73 -.47 .97 .13 .88 .51 C.81 .85 .38 1.01 0 1 C-.4 1.01 -.81 .85 -.88 .51 C-.97 .13 -.73 -.47 -.42 -.71 L-.4 -.85 -.35 -.81 C-.29 -.87 -.23 -.96 0 -1Z', { fill: props.fill! }),
    line('M-.48 .58 q.09 .08 .18 .03 M.21 .69 q.08 .06 .16 -.01 M-.12 -.49 l.06 .1 M.09 -.46 l.05 .09', '#BAA28D', 0.022, 0.38),
  ], local(props));
}

function sculptPaw(species: SculptedAnimal, part: CharacterPart): VectorNode {
  const profile = SCULPT_PROFILES[species];
  const props = part.geometry.props;
  const fill = props.fill!;
  const foot = part.id.startsWith('foot-') || part.id.startsWith('hoof-');
  const hoof = species === 'fawn';
  const wing = species === 'owl' && !foot;
  const shape = wing
    ? 'M-.3 -1 C.44 -.99 1.05 -.38 .84 .25 C.73 .58 .23 1.03 -.05 1.05 C-.73 .81 -.99 .13 -.87 -.47 Q-.73 -.9 -.3 -1Z'
    : 'M-.17 -.93 C.34 -1.05 .83 -.61 .94 -.13 C1.09 .28 .64 .84 .21 .94 C-.27 1.06 -.83 .86 -.94 .43 C-1.09 -.08 -.74 -.75 -.17 -.93Z';
  const detail = wing
    ? 'M-.44 -.39 Q.12 -.09 .35 .43 M-.61 -.08 Q-.16 .21 .02 .66 M-.62 .24 Q-.4 .48 -.29 .7'
    : hoof
      ? 'M0 .21 Q-.1 .57 -.05 .9'
      : foot
        ? 'M-.34 .21 q-.13 .2 -.08 .39 M.01 .27 q-.09 .2 -.03 .37 M.35 .21 q-.07 .18 -.03 .32'
        : 'M-.05 .42 q.14 -.04 .19 -.21 M.25 .51 q.15 -.08 .18 -.25';
  return group([
    path(shape, { fill, stroke: tint(fill, profile.ink, 0.18), strokeWidth: 0.025 }),
    path(wing
      ? 'M.68 -.1 C.52 .33 .09 .82 -.05 1.05 C.23 1.03 .73 .58 .84 .25 Q.93 -.01 .68 -.1Z'
      : 'M.83 -.15 C.75 .34 .29 .79 -.2 .83 Q-.63 .84 -.85 .6 C-.55 1.16 .43 1.07 .81 .53 Q1.04 .18 .83 -.15Z', { fill: tint(fill, profile.ink, 0.16), opacity: 0.6 }),
    line(detail, tint(fill, profile.ink, 0.33), wing ? 0.055 : 0.045, 0.75),
  ], local(props));
}

function sculptEar(species: SculptedAnimal, part: CharacterPart): VectorNode {
  const profile = SCULPT_PROFILES[species];
  const props = part.geometry.props;
  const inner = part.id.includes('inner');
  if (part.geometry.kind === 'path') {
    // Rounded cartilage / feather tips in place of ruler-straight triangles.
    const left = part.id.includes('left');
    const shape = species === 'fox'
      ? inner
        ? 'M39 -73 C46 -88 58 -105 69 -111 Q74 -91 70 -70 Q54 -78 39 -73Z'
        : 'M25 -69 C35 -96 54 -123 76 -136 Q80 -138 82 -131 C84 -102 84 -71 86 -48 Q55 -60 25 -69Z'
      : species === 'squirrel'
        ? inner
          ? 'M36 -64 Q46 -83 61 -91 Q68 -73 64 -51Z'
          : 'M24 -65 C32 -89 52 -101 65 -113 L68 -105 73 -112 Q79 -80 75 -35Z'
        : inner
          ? 'M38 -70 Q55 -88 72 -96 L66 -57Z'
          : 'M22 -73 Q49 -102 78 -115 L77 -106 84 -110 Q83 -74 73 -43Z';
    return group([
      path(shape, { fill: props.fill!, opacity: props.opacity ?? 1, strokeLinejoin: 'round' }),
      line(inner ? 'M58 -73 Q62 -84 65 -91' : 'M74 -61 Q74 -84 76 -99', inner ? '#FFF0E1' : profile.ink, 1.6, inner ? 0.45 : 0.18),
    ], left ? { transform: 'scale(-1 1)' } : {});
  }
  const fill = props.fill!;
  const tall = species === 'rabbit' || species === 'fawn';
  const d = tall
    ? 'M-.03 -1 C.51 -.99 .94 -.33 .77 .25 C.63 .65 .3 .97 0 1 C-.48 .77 -.84 .14 -.8 -.36 C-.77 -.76 -.42 -.98 -.03 -1Z'
    : 'M0 -1 C.63 -1 1.04 -.49 .98 .08 C.95 .63 .45 .99 -.12 .96 C-.73 .94 -1.06 .39 -.98 -.17 C-.93 -.67 -.56 -1 0 -1Z';
  return group([
    path(d, { fill, opacity: props.opacity ?? 1 }),
    inner
      ? line(tall ? 'M-.11 -.61 Q.25 -.05 .02 .56' : 'M-.49 -.17 Q-.37 -.59 .12 -.51', tint(fill, '#FFF5EB', 0.6), tall ? 0.09 : 0.1, 0.6)
      : path('M.57 -.65 C.98 -.24 .79 .39 .29 .84 Q.1 .97 0 1 C.67 .98 1.09 .18 .8 -.47Z', { fill: tint(fill, profile.ink, 0.15) }),
  ], local(species === 'fawn' ? {
    ...props,
    rx: inner ? 12 : 25,
    ry: inner ? 31 : 44,
    transform: `rotate(${part.id.includes('left') ? -42 : 42} ${props.cx} ${props.cy})`,
  } : props));
}

function sculptMuzzle(species: SculptedAnimal, part: CharacterPart): VectorNode {
  const profile = SCULPT_PROFILES[species];
  const props = part.geometry.props;
  if (species === 'fox') {
    return group([
      path('M-84 7 Q-69 18 -57 19 L-61 13 C-45 24 -24 32 0 40 C24 32 45 24 61 13 L57 19 Q69 18 84 7 C74 40 42 66 0 74 C-42 66 -74 40 -84 7Z', { fill: '#FFF1E8' }),
      line('M-25 39 l-8 -1 M25 39 l8 -1 M-41 33 l-6 -2 M41 33 l6 -2', '#B38C78', 1.3, 0.48),
    ]);
  }
  const owl = species === 'owl';
  const fill = props.fill!;
  return group([
    path(owl
      ? 'M0 -.98 C.61 -1.06 1.13 -.36 .96 .24 C.77 .88 .1 1.13 -.49 .8 C-.98 .56 -1.12 -.16 -.8 -.62 Q-.48 -.98 0 -.98Z'
      : 'M0 -.73 C.25 -.96 .63 -.76 .85 -.42 C1.07 -.11 .85 .58 .49 .82 Q0 1.06 -.49 .82 C-.85 .58 -1.07 -.11 -.85 -.42 C-.63 -.76 -.25 -.96 0 -.73Z', { fill, opacity: props.opacity ?? 1 }),
    owl
      ? line('M-.7 -.44 Q-.98 .1 -.55 .52 M.38 -.71 Q.68 -.53 .74 -.21', tint(fill, profile.ink, 0.24), 0.035, 0.6)
      : line(species === 'otter'
        ? 'M-.46 -.1 l-.02 .01 M.46 -.1 l.02 .01 M-.62 .14 l-.02 .01 M.62 .14 l.02 .01 M-.63 .08 Q-.94 -.04 -1.18 .03 M.63 .08 Q.94 -.04 1.18 .03 M-.65 .3 Q-.99 .29 -1.15 .42 M.65 .3 Q.99 .29 1.15 .42'
        : 'M-.46 -.1 l-.02 .01 M.46 -.1 l.02 .01 M-.62 .14 l-.02 .01 M.62 .14 l.02 .01', tint(fill, profile.ink, 0.4), species === 'otter' ? 0.028 : 0.06, 0.65),
  ], local(props));
}

function sculptTail(species: SculptedAnimal, part: CharacterPart): VectorNode {
  const profile = SCULPT_PROFILES[species];
  const fill = part.geometry.props.fill!;
  const shade = tint(fill, profile.ink, 0.19);
  if (species === 'squirrel' && part.id === 'tail') {
    return group([
      path('M57 148 C111 174 173 126 171 68 C172 31 151 -10 121 -34 Q115 -39 111 -31 C101 -11 111 9 116 34 C126 71 106 103 70 112Z', { fill }),
      line('M88 133 C151 123 160 69 136 26 M105 127 C147 104 146 69 132 48 M121 116 Q140 93 134 74', shade, 2.3, 0.7),
    ]);
  }
  if (species === 'fox' && part.id === 'tail') {
    return group([
      path('M64 108 C99 93 131 92 148 109 C166 129 148 155 126 165 C105 177 86 166 70 149Z', { fill }),
      line('M93 155 Q119 160 136 141 M101 148 Q126 149 139 132', shade, 2, 0.5),
    ]);
  }
  if (species === 'otter') {
    return group([
      path('M73 93 C122 88 146 114 143 144 Q141 162 122 162 C105 162 95 140 86 119Z', { fill }),
      line('M99 111 Q128 122 131 145', shade, 2, 0.55),
    ]);
  }
  return part.geometry;
}

/** Keeps IDs, painter order, roles and rig landmarks stable across the refresh. */
export function sculptCharacterAnatomy(
  species: SculptedAnimal,
  parts: readonly CharacterPart[],
): readonly CharacterPart[] {
  const profile = SCULPT_PROFILES[species];
  return parts.map((part) => {
    const props = part.geometry.props;
    let geometry = part.geometry;
    if (part.id === 'head') geometry = sculptHead(species, props);
    else if (part.id === 'body') geometry = sculptBody(species, props);
    else if (part.id === 'belly') geometry = sculptBelly(props);
    else if (part.role === 'paw') geometry = sculptPaw(species, part);
    else if (part.role === 'ear') geometry = sculptEar(species, part);
    else if (part.role === 'muzzle') geometry = sculptMuzzle(species, part);
    else if (part.role === 'tail') geometry = sculptTail(species, part);
    else if (part.role === 'eye') {
      const [x, y] = profile.eyes;
      const cx = part.id === 'eye-left' ? -x : x;
      geometry = group([
        ellipse(cx, y, species === 'owl' ? 6.6 : 5.4, species === 'owl' ? 8 : 6.8, { fill: profile.ink }),
        circle(cx - 1.7, y - 2.3, 1.8, { fill: '#FFF9F0' }),
      ]);
    } else if (part.role === 'cheek') {
      // Keep a leaf so appearance styles can continue to quiet the blush.
      geometry = { ...part.geometry, props: { ...props, opacity: 0.46 } };
    } else if (part.id === 'nose') {
      const noseY = species === 'rabbit' ? 17 : species === 'fox' ? 31 : species === 'owl' ? 20 : species === 'hedgehog' ? 24 : 20;
      geometry = species === 'owl'
        ? group([part.geometry, line('M-2 17 Q0 20 0 25', '#FBE0AC', 1.5, 0.8)])
        : group([
          path('M-7 -3 C-5 -6 5 -6 7 -3 Q8 0 3 4 Q0 7 -3 4 Q-8 0 -7 -3Z', { fill: species === 'rabbit' ? '#B88884' : profile.ink }),
          line('M-3 -2 Q0 -3 2 -2', '#FFF4E6', 1.3, 0.65),
        ], { transform: `translate(0 ${noseY})${species === 'rabbit' ? ' scale(.7)' : ''}` });
    } else if (part.id === 'spines') {
      geometry = group([
        path('M-101 48 Q-111 29 -107 17 L-88 12 Q-99 -7 -94 -20 L-72 -18 Q-76 -42 -65 -53 L-45 -44 Q-37 -64 -25 -70 L-4 -55 Q9 -70 22 -71 L42 -47 Q59 -57 69 -50 L73 -25 Q94 -29 101 -16 L94 9 Q112 10 114 25 L101 48 C120 104 91 162 0 169 C-85 163 -117 112 -101 48Z', { fill: '#B0917C' }),
        line('M-91 36 l7 11 M-83 71 l8 12 M-93 100 l11 10 M-79 125 l12 8 M-58 145 l10 4 M91 36 l-7 11 M83 71 l-8 12 M93 100 l-11 10 M79 125 l-12 8 M58 145 l-10 4 M-55 -34 l8 10 M-23 -52 l5 9 M23 -52 l-5 9 M55 -34 l-8 10', '#E1C2A5', 2.2, 0.8),
      ]);
    } else if (part.id === 'highlight') {
      // The former forehead mark used the body channel; attach it to the head.
      return { ...part, role: 'head', geometry: line('M-44 -43 Q-38 -48 -32 -46', '#FFF8ED', 1.8, 0.45) };
    } else if (part.id === 'shadow') {
      geometry = ellipse(0, species === 'fawn' ? 180 : 164, 65, 7, { fill: '#6E8068', opacity: 0.12 });
    }
    return { ...part, geometry };
  });
}
