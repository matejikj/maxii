/** Shared semantic tokens. Illustration hues are not automatically accessible text colors. */
export const lumi = {
  colors: {
    ivory: '#FAF7F1', sage: '#DDECE5', peach: '#F2CDBF', lilac: '#E1D9F2',
    honey: '#F4E3AD', ink: '#384C4A', inkMuted: '#647672', card: '#FFFFFF',
    border: '#E9ECE6', success: '#608A73', warning: '#B77953',
  },
  typography: {
    h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
    h2: { fontSize: 21, lineHeight: 28, fontWeight: '700' as const },
    body: { fontSize: 15, lineHeight: 23, fontWeight: '400' as const },
    caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' as const },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
  radius: { sm: 12, md: 18, card: 26, pill: 999 },
  layout: { pageHorizontal: 24, contentMaxWidth: 540, bottomIllustrationReserved: 230 },
} as const;

export type LumiTokens = typeof lumi;
