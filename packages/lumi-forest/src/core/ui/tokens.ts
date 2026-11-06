/** Renderer-independent UI design contract; never use scene illustration colors as text. */
export const LUMI_UI_TOKENS = Object.freeze({
  space: { none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40, huge: 48 },
  radius: { xs: 8, sm: 12, md: 18, lg: 24, card: 26, pill: 999 },
  size: { touch: 48, touchCompact: 44, buttonLarge: 56, input: 52, icon: 20, iconLarge: 24, contentMax: 560 },
  line: { hairline: 1, focus: 2 },
  opacity: { disabled: 0.48, backdrop: 0.54 },
  type: {
    display: { fontSize: 34, lineHeight: 42, fontWeight: '800' },
    h1: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
    h2: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
    h3: { fontSize: 18, lineHeight: 26, fontWeight: '700' },
    body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
    label: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
    caption: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
    overline: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.2 },
  },
} as const);
export type LumiTextVariant = keyof typeof LUMI_UI_TOKENS.type;
export type LumiSpace = keyof typeof LUMI_UI_TOKENS.space;
export type LumiRadius = keyof typeof LUMI_UI_TOKENS.radius;
