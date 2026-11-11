import { circle, ellipse, group, path, rect } from '../vector/nodes';
import type { SceneDocument, VectorNode } from '../vector/types';
import { isLumiMotif, type LumiMotif, type LumiMotifVariant } from './motifs';
import type { LumiResolvedMode } from './theme';

type Materials = {
  sky: string; far: string; ground: string; near: string; leaf: string; leafLight: string;
  stem: string; wood: string; woodShade: string; cream: string; petal: string;
  petalLight: string; heart: string; blue: string; coral: string; gold: string;
};
const MATERIALS: Record<LumiMotif, Materials> = {
  forest: { sky: '#E7EEDB', far: '#C8D9B8', ground: '#B1C79B', near: '#91AD86',
    leaf: '#91AE86', leafLight: '#B0C79D', stem: '#668262', wood: '#B49A77', woodShade: '#9B8266',
    cream: '#F6EBDD', petal: '#D9A694', petalLight: '#EDC7AB', heart: '#E3C17D',
    blue: '#A3B8BC', coral: '#D7A18A', gold: '#E8D5A1' },
  garden: { sky: '#F8EDE6', far: '#E6DFC7', ground: '#C7D5B5', near: '#ABC198',
    leaf: '#8EAD84', leafLight: '#B9CE9E', stem: '#698464', wood: '#D6BE9C', woodShade: '#B79A79',
    cream: '#FFF3DD', petal: '#D69AA9', petalLight: '#F0C4C5', heart: '#D8AC68',
    blue: '#A6BFC3', coral: '#DCA48C', gold: '#EDD6A0' },
  playground: { sky: '#E9F2F0', far: '#DAE7D9', ground: '#C2D6BC', near: '#E1D2B2',
    leaf: '#91B09C', leafLight: '#BED0AE', stem: '#6E8A75', wood: '#C8AA7D', woodShade: '#A48760',
    cream: '#F5E8CC', petal: '#D99E9A', petalLight: '#EAC4AE', heart: '#DCBC7B',
    blue: '#91B7C2', coral: '#D8A18D', gold: '#E2C381' },
};

function materials(motif: LumiMotif, mode: LumiResolvedMode, variant: LumiMotifVariant): Materials {
  const p = MATERIALS[motif];
  if (mode === 'light' && variant === 'day') return p;
  const dark = mode === 'dark';
  const skies = {
    forest: dark ? '#213A2F' : '#2E4E3E',
    garden: dark ? '#352A36' : '#58414B',
    playground: dark ? '#243C49' : '#355666',
  };
  return { ...p, sky: skies[motif], far: dark ? '#415747' : '#657A5C',
    ground: dark ? '#50684F' : '#829473', near: dark ? '#657557' : '#A1AD86',
    leaf: '#6F8D72', leafLight: '#99B28B', stem: '#ABC19A',
    wood: '#B79D7B', woodShade: '#8B745C' };
}

const line = (d: string, stroke: string, width = 1.5, opacity = 1): VectorNode =>
  path(d, { fill: 'none', stroke, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round', opacity });

function flower(x: number, y: number, scale: number, p: Materials, color = p.petal): VectorNode {
  return group([
    line('M0 1 Q-3 16 0 29', p.stem, 1.8),
    path('M-1 20 Q-13 20 -12 11 Q-2 11 -1 20Z M-1 25 Q11 24 11 16 Q2 16 -1 25Z', { fill: p.leaf }),
    path('M0 -5 C-8 -14 -16 -4 -7 1 C-14 10 -2 16 1 7 C8 16 17 6 8 1 C18 -4 8 -14 3 -6 Q1 -8 0 -5Z', { fill: color }),
    circle(1, 1, 3.4, { fill: p.heart }),
    line('M-8 -4 Q-6 -8 -3 -6 M7 5 l2 -1', p.cream, 1.3, 0.65),
  ], { transform: `translate(${x} ${y}) scale(${scale})` });
}

function tree(x: number, y: number, scale: number, p: Materials, fruit = false): VectorNode {
  return group([
    path('M-5 5 Q-5 -30 -14 -53 L-10 -56 Q1 -40 2 -28 Q14 -43 23 -46 L26 -43 Q9 -31 7 -14 L9 27 H-7Z', { fill: p.woodShade }),
    path('M-3 26 Q-1 -22 -12 -52 L-10 -54 Q1 -39 2 -28 L5 -31 Q3 -13 6 26Z', { fill: p.wood }),
    path('M-37 -48 C-62 -61 -49 -92 -29 -91 C-30 -118 9 -123 22 -106 C44 -114 67 -88 53 -70 C70 -46 40 -29 21 -36 C4 -17 -25 -24 -27 -41 Q-35 -39 -37 -48Z', { fill: p.leaf }),
    path('M-39 -69 C-54 -85 -27 -101 -16 -93 C-17 -111 12 -115 23 -102 C6 -96 4 -79 -9 -75 C-22 -78 -26 -68 -39 -69Z', { fill: p.leafLight, opacity: 0.8 }),
    line('M-24 -66 q8 -7 14 -3 M26 -82 q7 -4 13 2 M-4 -99 l5 -1 M18 -53 l7 -1', p.cream, 1.5, 0.3),
    ...(fruit ? [
      circle(-27, -68, 4.5, { fill: p.coral }), circle(28, -74, 4, { fill: p.coral }),
      circle(7, -95, 4.5, { fill: p.gold }), circle(9, -49, 4, { fill: p.coral }),
      line('M-28 -71 l2 -3 M28 -77 l1 -3 M7 -98 l1 -3', p.stem, 1.1),
    ] : []),
  ], { transform: `translate(${x} ${y}) scale(${scale})` });
}

function forest(p: Materials): readonly VectorNode[] {
  return [
    tree(361, 160, 1.05, p), tree(402, 173, 0.7, p),
    path('M0 193 Q19 171 42 179 Q61 163 82 187 Q101 172 120 194Z', { fill: p.leaf, opacity: 0.65 }),
    line('M20 200 Q19 174 7 162 M17 185 Q1 182 2 173 Q13 174 17 185 M13 176 Q20 163 29 163 Q29 173 13 176 M34 200 Q40 180 53 175', p.stem, 1.5, 0.7),
    group([
      path('M-2 0 Q-3 9 -1 14 H4 Q4 6 2 0Z', { fill: p.cream }),
      path('M-12 0 Q-9 -16 0 -15 Q10 -15 13 0 Q2 5 -12 0Z', { fill: p.petal }),
      circle(-4, -6, 2, { fill: p.cream }), circle(5, -8, 1.5, { fill: p.cream }),
    ], { transform: 'translate(59 184) scale(.72)' }),
    flower(195, 190, 0.38, p, p.cream),
    line('M100 193 q10 -8 19 -2 M143 185 q8 -7 14 -1 M205 199 l8 -5', p.stem, 1, 0.45),
  ];
}

function garden(p: Materials): readonly VectorNode[] {
  return [
    tree(352, 172, 1.05, p, true),
    path('M0 176 Q101 153 211 177 T400 167 V200H0Z', { fill: p.cream, opacity: 0.5 }),
    path('M12 181 V164 Q15 157 18 164 V181 M42 178 V161 Q45 154 48 161 V178 M72 177 V160 Q75 153 78 160 V177 M102 177 V160 Q105 153 108 160 V177 M132 178 V162 Q135 155 138 162 V178 M162 181 V164 Q165 157 168 164 V181',
      { fill: p.cream, stroke: p.wood, strokeWidth: 1.3, strokeLinejoin: 'round' }),
    line('M6 170 Q88 163 174 172 M7 179 Q89 172 174 181', p.wood, 2, 0.9),
    path('M0 200 Q45 174 96 190 Q140 168 196 188 Q239 177 268 200Z', { fill: p.leafLight }),
    flower(22, 174, 0.7, p), flower(45, 186, 0.52, p, p.cream),
    flower(78, 176, 0.68, p, p.petalLight), flower(105, 185, 0.5, p),
    flower(140, 173, 0.73, p, p.cream), flower(171, 183, 0.54, p, p.petalLight),
    flower(208, 181, 0.66, p), flower(235, 191, 0.44, p, p.gold),
    group([
      path('M0 0 C-15 -16 -19 6 -4 7 C-13 15 0 20 3 8 C15 15 22 0 7 0 C18 -10 4 -18 2 -3Z', { fill: p.petalLight }),
      line('M2 -3 L3 9 M2 -3 l-3 -4 M2 -3 l4 -4', p.woodShade, 1),
    ], { transform: 'translate(254 33) rotate(-16) scale(.8)' }),
    group([
      path('M0 0 H20 L18 20 Q10 24 2 20Z M20 5 Q31 -3 31 7 Q31 16 20 14', { fill: p.blue, stroke: p.woodShade, strokeWidth: 1.1, strokeLinejoin: 'round' }),
      path('M0 5 L-12 -4 -14 1 -1 13Z', { fill: p.blue }),
      line('M3 3 L5 17', p.cream, 1.5, 0.6),
    ], { transform: 'translate(367 180) rotate(9) scale(.72)' }),
  ];
}

function playground(p: Materials): readonly VectorNode[] {
  return [
    // Rounded timber frame, ropes and a visibly suspended swing seat.
    path('M239 158 L259 40 Q261 35 266 37 L282 158 M317 158 L302 40 Q303 36 308 37 L331 158',
      { fill: 'none', stroke: p.woodShade, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    line('M256 39 Q289 35 312 39', p.wood, 7),
    line('M268 42 L269 111 M295 41 L293 111', p.cream, 1.7),
    path('M265 111 Q281 108 298 111 L296 117 Q281 120 266 117Z', { fill: p.coral }),
    line('M268 112 Q280 111 294 112', p.cream, 1, 0.6),
    // Little play tower and a curved slide with a second material plane.
    path('M345 83 L344 163 M384 83 L386 163', { fill: 'none', stroke: p.woodShade, strokeWidth: 5, strokeLinecap: 'round' }),
    path('M338 72 Q338 68 344 66 L361 43 Q364 39 368 43 L391 68 Q395 73 390 75 H341Z', { fill: p.coral }),
    path('M342 70 L365 46 387 70Z', { fill: p.petalLight, opacity: 0.65 }),
    path('M342 77 H387 V85 H342Z', { fill: p.wood }),
    line('M350 85 L333 159 M339 140 l15 3 M344 120 l14 3 M349 100 l12 3', p.wood, 3),
    path('M373 85 C368 111 370 126 392 140 Q402 148 397 155 C365 157 347 126 361 85Z', { fill: p.blue }),
    path('M368 86 C359 114 364 133 386 147 L397 150 Q397 155 392 155 C362 149 351 119 361 85Z', { fill: p.stem, opacity: 0.22 }),
    line('M373 88 Q368 115 384 133', p.cream, 1.8, 0.75),
    // Soft sand with wooden edges; no geometry enters the text-safe left area.
    path('M132 184 Q193 161 265 177 L288 191 Q230 210 144 199Z', { fill: p.woodShade }),
    path('M137 181 Q195 160 264 175 L283 187 Q226 206 145 196Z', { fill: p.wood }),
    path('M149 183 Q201 168 258 179 L269 186 Q215 199 156 191Z', { fill: p.cream }),
    path('M181 180 L195 178 194 190 Q187 194 182 190Z', { fill: p.coral }),
    line('M182 181 Q179 168 189 170 Q196 171 195 178 M207 182 l10 -12 M215 169 l4 4 M204 184 l4 4', p.blue, 1.5),
    line('M230 13 Q311 38 400 12', p.woodShade, 1, 0.6),
    path('M248 18 L253 33 Q254 35 256 33 L262 22Z M301 26 L308 41 Q310 44 312 40 L319 26Z M357 23 L365 36 Q367 38 368 34 L373 19Z', { fill: p.coral }),
    path('M274 23 L280 38 Q282 41 284 37 L290 26Z M331 25 L338 39 Q340 41 342 37 L348 24Z M383 17 L390 29 Q392 32 394 27 L399 13Z', { fill: p.blue }),
    flower(26, 187, 0.45, p, p.gold), flower(57, 192, 0.36, p, p.cream),
  ];
}

const cache = new Map<string, SceneDocument>();

/**
 * Pure, retained 400×200 card scenery. The top-left 230×150 area stays quiet
 * for product text. The same IR renders in native SVG and offline previews.
 * This is separate from legacy activity-scene recipes and stored documents.
 */
export function compileLumiMotifLandscape(motif: LumiMotif, options: {
  readonly mode?: LumiResolvedMode; readonly variant?: LumiMotifVariant;
} = {}): SceneDocument {
  if (!isLumiMotif(motif)) throw new RangeError(`Unknown Lumi motif: ${String(motif)}`);
  const mode = options.mode ?? 'light';
  const variant = options.variant ?? 'day';
  if (!['light', 'dark'].includes(mode) || !['day', 'dusk'].includes(variant)) {
    throw new RangeError('Unknown motif mode or variant');
  }
  const key = `${motif}/${mode}/${variant}`;
  const previous = cache.get(key);
  if (previous) return previous;
  const p = materials(motif, mode, variant);
  const document: SceneDocument = {
    schemaVersion: 1, scene: `lumi-${motif}`, width: 400, height: 200,
    layers: [
      { id: 'canvas', nodes: [rect(400, 200, { fill: p.sky })] },
      { id: 'sky', nodes: [circle(331, 40, 46, { fill: p.gold, opacity: 0.14 }),
        circle(331, 40, 27, { fill: p.gold, opacity: mode === 'light' && variant === 'day' ? 0.7 : 0.32 })] },
      { id: 'landscape', nodes: [
        path('M0 183 Q95 142 202 169 T400 160 V200H0Z', { fill: p.far }),
        path('M0 198 Q106 168 218 183 T400 173 V200H0Z', { fill: p.ground }),
        path('M176 200 Q294 159 400 189 V200Z', { fill: p.near }),
      ] },
      { id: 'objects', nodes: motif === 'garden' ? garden(p) : motif === 'playground' ? playground(p) : forest(p) },
    ],
  };
  cache.set(key, document);
  return document;
}
