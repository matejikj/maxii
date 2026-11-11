import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { resolveLumiTheme } from '../core/ui/theme';
import type { LumiMode, LumiResolvedMode, LumiTheme } from '../core/ui/theme';
import type { LumiScene } from '../core/types';
import type { LumiMotif } from '../core/ui/motifs';

const ThemeContext = createContext<LumiTheme>(resolveLumiTheme());
/** Supports explicit light/dark and system appearance. Theme objects are stable references. */
export function LumiThemeProvider({ scene = 'home', mode = 'system', motif = 'forest', children }: {
  readonly scene?: LumiScene;
  readonly mode?: LumiMode;
  readonly motif?: LumiMotif;
  readonly children: React.ReactNode;
}) {
  const preferred = useColorScheme();
  const resolved: LumiResolvedMode = mode === 'system' ? preferred === 'dark' ? 'dark' : 'light' : mode;
  return <ThemeContext.Provider value={resolveLumiTheme(scene, resolved, motif)}>{children}</ThemeContext.Provider>;
}
export function useLumiTheme(): LumiTheme { return useContext(ThemeContext); }
export function useLumiColorMode(): LumiResolvedMode { return useLumiTheme().mode; }
export type { LumiTheme, LumiMode, LumiResolvedMode } from '../core/ui/theme';
