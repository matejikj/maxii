/**
 * LUMI Forest 0.1 • Procedural vector backgrounds for React Native.
 * All shapes are authored in this project. No raster assets, remote API, or random repaint.
 * Install: npx expo install react-native-svg (Expo) / npm i react-native-svg (bare RN).
 */
import React, { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

export type LumiScene = 'home' | 'growth' | 'sleep' | 'feeding' | 'milestones';
export type LumiAnimal = 'rabbit' | 'bear' | 'fox' | 'otter' | 'hedgehog';
export type LumiDensity = 'quiet' | 'regular' | 'playful';

type Palette = {
  bg: string;
  mid: string;
  hill: string;
  hill2: string;
  sun: string;
  accent: string;
  accentText: string;
  ink: string;
  animal: LumiAnimal;
};

export const LUMI_PALETTES: Record<LumiScene, Palette> = {
  home: {
    bg: '#FAF7F1',
    mid: '#EFF2E9',
    hill: '#DDE9DB',
    hill2: '#CADCC8',
    sun: '#F6DFAE',
    accent: '#92B3A1',
    accentText: '#506F60',
    ink: '#354A47',
    animal: 'rabbit',
  },
  growth: {
    bg: '#FCF9F2',
    mid: '#F3F0E5',
    hill: '#DCE8D8',
    hill2: '#C7D8BF',
    sun: '#F7DDB3',
    accent: '#91AF8F',
    accentText: '#506D51',
    ink: '#354A47',
    animal: 'bear',
  },
  sleep: {
    bg: '#F7F5FB',
    mid: '#EDE8F4',
    hill: '#E0DFF1',
    hill2: '#CFCDE8',
    sun: '#EEE1BF',
    accent: '#A29AC6',
    accentText: '#625B87',
    ink: '#44415F',
    animal: 'fox',
  },
  feeding: {
    bg: '#FAF8F1',
    mid: '#F6EEE5',
    hill: '#E8E6D8',
    hill2: '#D5DFC9',
    sun: '#F9DDA9',
    accent: '#C5A78A',
    accentText: '#795C44',
    ink: '#354A47',
    animal: 'otter',
  },
  milestones: {
    bg: '#FDF8F4',
    mid: '#F3EDE7',
    hill: '#F0DCCF',
    hill2: '#E5CBB7',
    sun: '#F6DDAA',
    accent: '#CEA89A',
    accentText: '#8A625B',
    ink: '#4B4744',
    animal: 'hedgehog',
  },
};

// Original house style. Every character follows the same geometric grammar:
// large dome head, rounded body, paw nubs, blush, tiny face, belly seed.
const ANIMAL_SVG: Record<LumiAnimal, string> = {
  rabbit:
    '<g>\n  <ellipse cx="-18" cy="-3" rx="16" ry="7" fill="#6E947F" opacity=".12"/>\n  <ellipse cx="-44" cy="-83" rx="20" ry="70" transform="rotate(-14 -44 -83)" fill="#EDE0D6"/>\n  <ellipse cx="32" cy="-88" rx="20" ry="72" transform="rotate(13 32 -88)" fill="#EDE0D6"/>\n  <ellipse cx="-44" cy="-83" rx="9" ry="52" transform="rotate(-14 -44 -83)" fill="#E7B8B6" opacity=".84"/>\n  <ellipse cx="32" cy="-88" rx="9" ry="52" transform="rotate(13 32 -88)" fill="#E7B8B6" opacity=".84"/>\n  <ellipse cx="0" cy="74" rx="91" ry="85" fill="#EDE0D6"/>\n  <ellipse cx="0" cy="82" rx="54" ry="58" fill="#FBF6F0"/>\n  <ellipse cx="-79" cy="98" rx="24" ry="17" transform="rotate(-28 -79 98)" fill="#EDE0D6"/>\n  <ellipse cx="79" cy="98" rx="24" ry="17" transform="rotate(28 79 98)" fill="#EDE0D6"/>\n  <ellipse cx="-47" cy="148" rx="26" ry="16" fill="#E9D3C8"/>\n  <ellipse cx="47" cy="148" rx="26" ry="16" fill="#E9D3C8"/>\n  <ellipse cx="0" cy="-3" rx="91" ry="78" fill="#F1E5DA"/>\n  <ellipse cx="-56" cy="27" rx="17" ry="11" fill="#EAB8B0" opacity=".7"/>\n  <ellipse cx="56" cy="27" rx="17" ry="11" fill="#EAB8B0" opacity=".7"/>\n  <path d="M-43 8 Q-30 -2 -17 8" stroke="#5A5550" stroke-width="4.3" fill="none" stroke-linecap="round"/>\n  <path d="M17 8 Q30 -2 43 8" stroke="#5A5550" stroke-width="4.3" fill="none" stroke-linecap="round"/>\n  <path d="M-5 21 Q0 26 5 21" fill="none" stroke="#9E716F" stroke-width="2.5" stroke-linecap="round"/>\n  <circle cx="0" cy="16" r="3.3" fill="#B07F7C"/>\n  <g transform="translate(0 91) scale(0.85)"><path d="M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z" fill="#B3C7AB"/><path d="M0 0Q4 -4 7 -3" stroke="#FFFFFF" stroke-width="1.3" fill="none" stroke-linecap="round"/></g><path d="M-56 -67 Q-50 -74 -44 -68" fill="none" stroke="#FFFFFF" stroke-width="2.2" opacity=".65" stroke-linecap="round"/></g>',
  bear: '<g>\n  <circle cx="-68" cy="-49" r="33" fill="#CFAE85"/><circle cx="68" cy="-49" r="33" fill="#CFAE85"/>\n  <circle cx="-68" cy="-49" r="19" fill="#EBCDB3"/><circle cx="68" cy="-49" r="19" fill="#EBCDB3"/>\n  <ellipse cx="0" cy="77" rx="92" ry="86" fill="#DAB991"/>\n  <ellipse cx="0" cy="85" rx="56" ry="58" fill="#F5E4CE"/>\n  <ellipse cx="-79" cy="99" rx="25" ry="17" transform="rotate(-20 -79 99)" fill="#D5B18A"/>\n  <ellipse cx="79" cy="99" rx="25" ry="17" transform="rotate(20 79 99)" fill="#D5B18A"/>\n  <ellipse cx="-48" cy="147" rx="26" ry="17" fill="#C8A57E"/>\n  <ellipse cx="48" cy="147" rx="26" ry="17" fill="#C8A57E"/>\n  <ellipse cx="0" cy="-3" rx="92" ry="79" fill="#E1C19B"/>\n  <ellipse cx="0" cy="25" rx="34" ry="24" fill="#F4E6D5"/>\n  <ellipse cx="-58" cy="22" rx="17" ry="10" fill="#ECAFA0" opacity=".56"/>\n  <ellipse cx="58" cy="22" rx="17" ry="10" fill="#ECAFA0" opacity=".56"/>\n  <circle cx="-31" cy="2" r="4.4" fill="#5D5149"/><circle cx="31" cy="2" r="4.4" fill="#5D5149"/>\n  <path d="M-8 18 Q0 11 8 18 Q6 25 0 25 Q-6 25 -8 18Z" fill="#66544B"/>\n  <path d="M0 25 Q-1 34 -10 34 M0 25 Q1 34 10 34" fill="none" stroke="#66544B" stroke-width="2" stroke-linecap="round"/>\n  <g transform="translate(0 93) scale(0.87)"><path d="M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z" fill="#AFC7A2"/><path d="M0 0Q4 -4 7 -3" stroke="#FFFFFF" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g>',
  fox: '<g>\n   <path d="M64 98 C173 45 178 166 95 174 C45 180 35 142 65 127Z" fill="#E6A77E"/>\n   <path d="M144 108 Q176 150 123 165 Q131 144 144 108Z" fill="#FFF1E3"/>\n   <path d="M-87 -50 L-80 -139 Q-42 -121 -24 -72Z" fill="#CD8F75"/>\n   <path d="M87 -50 L80 -139 Q42 -121 24 -72Z" fill="#CD8F75"/>\n   <path d="M-70 -69 L-70 -114 Q-50 -99 -40 -76Z" fill="#EDC0AE"/>\n   <path d="M70 -69 L70 -114 Q50 -99 40 -76Z" fill="#EDC0AE"/>\n   <ellipse cx="0" cy="75" rx="92" ry="84" fill="#E8A987"/>\n   <ellipse cx="0" cy="82" rx="54" ry="56" fill="#FFF1E6"/>\n   <ellipse cx="-72" cy="100" rx="25" ry="19" fill="#D99678"/>\n   <ellipse cx="72" cy="100" rx="25" ry="19" fill="#D99678"/>\n   <ellipse cx="-44" cy="143" rx="26" ry="16" fill="#D98D72"/>\n   <ellipse cx="44" cy="143" rx="26" ry="16" fill="#D98D72"/>\n   <ellipse cx="0" cy="-2" rx="91" ry="78" fill="#EBAF89"/>\n   <path d="M-82 8 C-64 26 -36 39 0 45 C36 39 64 26 82 8 Q68 70 0 73 Q-68 70 -82 8" fill="#FFF1E8"/>\n   <ellipse cx="-55" cy="16" rx="15" ry="9" fill="#E8B0A2" opacity=".6"/>\n   <ellipse cx="55" cy="16" rx="15" ry="9" fill="#E8B0A2" opacity=".6"/>\n   <path d="M-43 4 Q-31 -6 -19 4" stroke="#705B58" stroke-width="4.1" fill="none" stroke-linecap="round"/>\n   <path d="M19 4 Q31 -6 43 4" stroke="#705B58" stroke-width="4.1" fill="none" stroke-linecap="round"/>\n   <path d="M-6 35 Q0 42 6 35" fill="none" stroke="#AF7870" stroke-width="2" stroke-linecap="round"/>\n   <path d="M-7 29 L7 29 Q5 38 0 38 Q-5 38 -7 29Z" fill="#855C57"/>\n  <g transform="translate(0 96) scale(0.85)"><path d="M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z" fill="#D7BDA2"/><path d="M0 0Q4 -4 7 -3" stroke="#FFFFFF" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g>',
  otter:
    '<g>\n  <path d="M73 93 C163 78 160 164 115 163 Q100 156 110 140 Q145 114 86 119Z" fill="#B98D78"/>\n  <circle cx="-74" cy="-51" r="27" fill="#C7A08C"/><circle cx="74" cy="-51" r="27" fill="#C7A08C"/>\n  <ellipse cx="0" cy="78" rx="90" ry="88" fill="#C9A38C"/><ellipse cx="0" cy="82" rx="54" ry="62" fill="#F4E4D5"/>\n  <ellipse cx="-74" cy="104" rx="25" ry="17" fill="#C29880"/><ellipse cx="74" cy="104" rx="25" ry="17" fill="#C29880"/>\n  <ellipse cx="-43" cy="147" rx="26" ry="16" fill="#B98D78"/><ellipse cx="43" cy="147" rx="26" ry="16" fill="#B98D78"/>\n  <ellipse cx="0" cy="-5" rx="89" ry="80" fill="#D3AD96"/><ellipse cx="0" cy="24" rx="47" ry="29" fill="#F4E3D7"/>\n  <circle cx="-31" cy="0" r="4" fill="#594D4A"/><circle cx="31" cy="0" r="4" fill="#594D4A"/>\n  <ellipse cx="0" cy="20" rx="8" ry="5" fill="#76615A"/><path d="M0 25 Q-8 35 -15 27 M0 25 Q8 35 15 27" stroke="#76615A" stroke-width="2" fill="none" stroke-linecap="round"/>\n  <ellipse cx="-59" cy="24" rx="16" ry="10" fill="#E8ADA2" opacity=".6"/><ellipse cx="59" cy="24" rx="16" ry="10" fill="#E8ADA2" opacity=".6"/>\n  <g transform="translate(0 91) scale(0.85)"><path d="M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z" fill="#AFC5A2"/><path d="M0 0Q4 -4 7 -3" stroke="#FFFFFF" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g>',
  hedgehog:
    '<g>\n  <path d="M-102 47 L-112 20 L-87 12 L-98 -18 L-70 -19 L-68 -50 L-42 -44 L-26 -70 L-2 -53 L21 -70 L44 -43 L67 -51 L72 -21 L100 -18 L91 12 L113 22 L100 49 Q113 152 0 168 Q-105 155 -102 47" fill="#BD9C87"/>\n  <ellipse cx="0" cy="74" rx="87" ry="88" fill="#D8B39D"/><ellipse cx="0" cy="84" rx="54" ry="56" fill="#F7E6D6"/>\n  <ellipse cx="-70" cy="106" rx="25" ry="17" fill="#C8A18B"/><ellipse cx="70" cy="106" rx="25" ry="17" fill="#C8A18B"/>\n  <ellipse cx="-45" cy="146" rx="26" ry="16" fill="#BE9B87"/><ellipse cx="45" cy="146" rx="26" ry="16" fill="#BE9B87"/>\n  <ellipse cx="0" cy="0" rx="80" ry="75" fill="#F0D5BF"/>\n  <ellipse cx="-28" cy="2" rx="4" ry="5" fill="#5D514D"/><ellipse cx="28" cy="2" rx="4" ry="5" fill="#5D514D"/>\n  <circle cx="0" cy="23" r="5" fill="#74574E"/><path d="M-7 30 Q0 38 7 30" fill="none" stroke="#74574E" stroke-width="2.3" stroke-linecap="round"/>\n  <ellipse cx="-54" cy="25" rx="15" ry="10" fill="#E8B1A8" opacity=".7"/><ellipse cx="54" cy="25" rx="15" ry="10" fill="#E8B1A8" opacity=".7"/>\n  <g transform="translate(0 90) scale(0.85)"><path d="M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z" fill="#C7A48B"/><path d="M0 0Q4 -4 7 -3" stroke="#FFFFFF" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></g>',
};

const seedMark = (x: number, y: number, scale: number, color: string): string =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 -10 C9 -7 10 1 0 10 C-10 1 -9 -7 0 -10Z" fill="${color}"/><path d="M0 0 Q4 -4 7 -3" stroke="#FFFFFF" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>`;

const star = (x: number, y: number, scale: number, color: string): string =>
  `<path d="M${x} ${y - 7 * scale} Q${x + 2 * scale} ${y - 2 * scale} ${x + 7 * scale} ${y} Q${x + 2 * scale} ${y + 2 * scale} ${x} ${y + 7 * scale} Q${x - 2 * scale} ${y + 2 * scale} ${x - 7 * scale} ${y} Q${x - 2 * scale} ${y - 2 * scale} ${x} ${y - 7 * scale}Z" fill="${color}"/>`;

const sprig = (x: number, y: number, scale: number, color: string): string =>
  `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"><path d="M0 0 C-6 -18 -5 -34 1 -56"/><path d="M-2 -18 C-18 -26 -18 -38 -18 -38 C-3 -35 -1 -23 -2 -18" fill="${color}" stroke="none"/><path d="M-2 -30 C11 -45 22 -43 22 -43 C15 -29 4 -27 -2 -30" fill="${color}" stroke="none"/></g>`;

// Stable pseudo-random decoration; identical child + scene + seed -> identical world.
function seededGenerator(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export type LumiBackgroundOptions = {
  scene: LumiScene;
  /** Fixed per child or illustration; never personal identifiers or names. */
  seed?: string;
  animal?: LumiAnimal;
  density?: LumiDensity;
};

/** Returns standalone SVG. Useful for caching, sharing or snapshot tests. */
export function createLumiSvg({
  scene,
  seed = 'lumi-default',
  animal,
  density = 'regular',
}: LumiBackgroundOptions): string {
  const t = LUMI_PALETTES[scene];
  const rand = seededGenerator(`${scene}:${seed}`);
  const n = density === 'quiet' ? 5 : density === 'playful' ? 21 : 13;
  const dots = Array.from({ length: n }, () => {
    const x = 12 + Math.floor(rand() * 367);
    const y = 600 + Math.floor(rand() * 226);
    const r = [2, 3, 3, 4][Math.floor(rand() * 4)];
    // The illustrated character owns the bottom-right zone.
    return x > 172 && y > 626
      ? ''
      : `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.accent}" opacity=".32"/>`;
  }).join('');
  const plants = [
    [32, 768, 0.78],
    [116, 809, 0.46],
    [177, 786, 0.68],
    [366, 803, 0.55],
  ]
    .map(([x, y, s]) => sprig(x, y, s, t.accent))
    .join('');
  const stars = [
    [38, 587, 0.49],
    [356, 560, 0.6],
    [184, 629, 0.46],
  ]
    .map(([x, y, s]) => star(x, y, s, t.sun))
    .join('');
  const sky =
    scene === 'sleep'
      ? `<path d="M324 102 A34 34 0 1 1 314 45 A27 27 0 1 0 324 102Z" fill="#E2CFAD" opacity=".85"/>${star(290, 113, 0.55, '#C8B8DA')}${star(357, 149, 0.4, '#D6C6DE')}`
      : scene === 'growth'
        ? `<circle cx="343" cy="95" r="26" fill="#F3DCAF" opacity=".72"/><path d="M92 765 L92 644 M82 644 L102 644 M82 674 L102 674 M82 704 L102 704 M82 734 L102 734" stroke="#9FB49F" stroke-width="3" stroke-linecap="round" opacity=".74"/>${sprig(107, 763, 0.72, t.accent)}`
        : scene === 'milestones'
          ? star(343, 120, 1.6, '#E4C69D')
          : `<circle cx="341" cy="92" r="31" fill="#F3DCAF" opacity=".60"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice">
    <rect width="390" height="844" fill="${t.bg}"/>
    <path d="M0 510 Q135 475 240 521 Q350 566 390 530 L390 844 L0 844Z" fill="${t.mid}" opacity=".77"/>
    <path d="M0 665 Q80 625 173 656 Q289 688 390 622 L390 844 L0 844Z" fill="${t.hill}"/>
    <path d="M0 765 Q155 719 278 773 Q329 800 390 749 L390 844 L0 844Z" fill="${t.hill2}" opacity=".77"/>
    ${dots}${plants}${stars}${sky}
    <g transform="translate(288 704) scale(.83)">${ANIMAL_SVG[animal ?? t.animal]}</g>
  </svg>`;
}

type Props = LumiBackgroundOptions & { style?: ViewStyle };
/** Render behind your actual screen content. Purely decorative, no touches or accessibility focus. */
export const LumiBackground = React.memo(function LumiBackground(props: Props) {
  const { scene, seed = 'lumi-default', animal, density = 'regular', style } = props;
  const svgXml = useMemo(
    () => createLumiSvg({ scene, seed, animal, density }),
    [scene, seed, animal, density],
  );
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}
    >
      <SvgXml xml={svgXml} width="100%" height="100%" />
    </View>
  );
});

export { seedMark }; // optional for branding if creating an external SVG asset
