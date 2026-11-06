import { LUMI_UI_TOKENS } from './tokens';
import { SCENE_CATALOG } from '../scenes/catalog';
import { lumi } from '../theme/tokens';
import type { LumiScene, Palette } from '../types';

export type LumiResolvedMode = 'light' | 'dark';
export type LumiMode = LumiResolvedMode | 'system';

/** Functional colors, reviewed independently from the decorative palettes. */
export interface LumiSemanticColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceSubtle: string;
  readonly surfaceElevated: string;
  readonly text: string;
  readonly textMuted: string;
  readonly textInverse: string;
  readonly border: string;
  readonly controlBorder: string;
  readonly focus: string;
  readonly primary: string;
  readonly onPrimary: string;
  readonly secondary: string;
  readonly onSecondary: string;
  readonly danger: string;
  readonly onDanger: string;
  readonly success: string;
  readonly warning: string;
  readonly overlay: string;
  readonly sceneAccent: string;
  readonly sceneAccentSoft: string;
  readonly onSceneAccent: string;
}
const LIGHT: Omit<LumiSemanticColors, 'sceneAccent' | 'sceneAccentSoft' | 'onSceneAccent'> = Object.freeze({
  background: '#FAF7F1', surface: '#FFFFFF', surfaceSubtle: '#F0F4EF', surfaceElevated: '#FFFFFF',
  text: '#263B36', textMuted: '#50635C', textInverse: '#FFFFFF', border: '#CBD8CF', controlBorder: '#708476', focus: '#245C4A',
  primary: '#304E42', onPrimary: '#FFFFFF', secondary: '#E4EDE5', onSecondary: '#263B36',
  danger: '#A52839', onDanger: '#FFFFFF', success: '#246343', warning: '#865116', overlay: 'rgba(7,18,13,0.58)',
});
const DARK: Omit<LumiSemanticColors, 'sceneAccent' | 'sceneAccentSoft' | 'onSceneAccent'> = Object.freeze({
  background: '#17221E', surface: '#26342E', surfaceSubtle: '#30433A', surfaceElevated: '#34493F',
  text: '#F6F8F3', textMuted: '#C7D9CF', textInverse: '#17221E', border: '#61766A', controlBorder: '#8DAA98', focus: '#C5EAD3',
  primary: '#DBF2E2', onPrimary: '#17291E', secondary: '#40584B', onSecondary: '#F6F8F3',
  danger: '#FFB8BE', onDanger: '#472028', success: '#BCEFCB', warning: '#F7CF89', overlay: 'rgba(3,10,6,0.76)',
});
const ACCENTS: Record<LumiScene, { light: string; dark: string; softLight: string; softDark: string }> = {
  home: { light: '#3C7057', dark: '#C4EDD7', softLight: '#DDECE5', softDark: '#365B46' },
  growth: { light: '#80513F', dark: '#F6D4C0', softLight: '#F2CDBF', softDark: '#60463C' },
  sleep: { light: '#665393', dark: '#E5D6FF', softLight: '#E1D9F2', softDark: '#4A3F67' },
  feeding: { light: '#795920', dark: '#FFE4A8', softLight: '#F4E3AD', softDark: '#64512B' },
  milestones: { light: '#3C6D71', dark: '#BEE7E8', softLight: '#D9EBEB', softDark: '#3B585A' },
};
export interface LumiTheme {
  readonly scene: LumiScene;
  readonly mode: LumiResolvedMode;
  readonly colors: LumiSemanticColors;
  readonly ui: typeof LUMI_UI_TOKENS;
  /** @deprecated use `ui` and `colors`; kept for v0.4 compatibility. */
  readonly tokens: typeof lumi;
  readonly palette: Palette;
  /** @deprecated use colors.surface, colors.border, colors.text and colors.textMuted. */
  readonly semantic: { readonly surface: string; readonly surfaceBorder: string; readonly text: string; readonly mutedText: string };
}
const themes = {} as Record<LumiResolvedMode, Record<LumiScene, LumiTheme>>;
for (const mode of ['light', 'dark'] as const) {
  const lookup = {} as Record<LumiScene, LumiTheme>;
  for (const scene of Object.keys(SCENE_CATALOG) as LumiScene[]) {
    const accent = ACCENTS[scene];
    const base = mode === 'light' ? LIGHT : DARK;
    const colors: LumiSemanticColors = Object.freeze({ ...base,
      sceneAccent: accent[mode], sceneAccentSoft: mode === 'light' ? accent.softLight : accent.softDark,
      onSceneAccent: mode === 'light' ? '#FFFFFF' : '#17221E',
    });
    lookup[scene] = Object.freeze({ scene, mode, colors, ui: LUMI_UI_TOKENS,
      tokens: lumi, palette: SCENE_CATALOG[scene].palette,
      semantic: Object.freeze({ surface: colors.surface, surfaceBorder: colors.border,
        text: colors.text, mutedText: colors.textMuted }),
    });
  }
  themes[mode] = Object.freeze(lookup);
}
/** Stable, frozen references: no allocations or context churn for identical scene/mode pairs. */
export function resolveLumiTheme(scene: LumiScene = 'home', mode: LumiResolvedMode = 'light'): LumiTheme {
  return themes[mode][scene];
}
