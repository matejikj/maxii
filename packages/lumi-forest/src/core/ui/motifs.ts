/** Visual worlds are independent of activity scenes and character art styles. */
export const LUMI_MOTIF_IDS = ['forest', 'garden', 'playground'] as const;
export type LumiMotif = (typeof LUMI_MOTIF_IDS)[number];
export type LumiMotifVariant = 'day' | 'dusk';

export const LUMI_MOTIFS = Object.freeze({
  forest: Object.freeze({
    id: 'forest',
    label: 'Forest',
    shortLabel: 'Les',
    brand: 'LUMI FOREST',
    description: 'Měkký mech, kapradí a slunce mezi stromy.',
    accent: '#3E6550',
    swatch: '#E4ECD8',
  }),
  garden: Object.freeze({
    id: 'garden',
    label: 'Garden',
    shortLabel: 'Zahrada',
    brand: 'LUMI GARDEN',
    description: 'Rozkvetlé záhony, ovocné stromy a teplé světlo.',
    accent: '#87515F',
    swatch: '#F3DFE2',
  }),
  playground: Object.freeze({
    id: 'playground',
    label: 'Dětské hřiště',
    shortLabel: 'Hřiště',
    brand: 'LUMI PLAY',
    description: 'Houpačka, skluzavka a malé světy z písku.',
    accent: '#3E6877',
    swatch: '#DDECF0',
  }),
} as const);

export function isLumiMotif(value: unknown): value is LumiMotif {
  return typeof value === 'string' && (LUMI_MOTIF_IDS as readonly string[]).includes(value);
}
