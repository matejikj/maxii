import type { LumiMotif, LumiResolvedMode, LumiSemanticColors } from '@lumi/forest-design/core';

type Insets = { bottom: number; left: number; right: number };

/** Shared by the actual dock and scroll content, including large text and landscape cutouts. */
export function forestDockMetrics(width: number, fontScale: number, insets: Insets) {
  const bottom = Math.max(insets.bottom, 10) + 10;
  const centered = Math.max(0, (width - 600) / 2);
  const left = Math.max(14, insets.left + 12, centered);
  const right = Math.max(14, insets.right + 12, centered);
  const labelWidth = Math.max(20, (width - left - right - 32) / 4 - 14);
  const labelLines = Math.max(1, Math.ceil((42 * fontScale) / labelWidth));
  const height = Math.max(80, 60 + 15 * fontScale * labelLines);
  return { height, bottom, left, right, radius: height / 2, contentInset: height + bottom + 12 };
}

function alpha(hex: string, opacity: number): string {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels.join(',')},${opacity})`;
}

/** The same forest, garden and playground materials as the rest of the app. */
export function forestGlassColors(colors: LumiSemanticColors, mode: LumiResolvedMode, motif: LumiMotif) {
  const dark = mode === 'dark';
  const accent = {
    forest: dark ? '#806638' : '#E8D6A7',
    garden: dark ? '#895C50' : '#F0D0C3',
    playground: dark ? '#826139' : '#F0D4A3',
  }[motif];
  return {
    wash: alpha(colors.surface, dark ? 0.8 : 0.68),
    opaque: colors.surfaceElevated,
    rim: dark ? alpha(colors.text, 0.24) : 'rgba(255,255,255,0.86)',
    innerRim: alpha(colors.primary, dark ? 0.1 : 0.08),
    reflection: dark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)',
    shadow: dark ? 'rgba(0,0,0,0.32)' : alpha(colors.primary, 0.16),
    active: colors.primary,
    activeInk: colors.onPrimary,
    inactiveInk: colors.text,
    accent,
  };
}
