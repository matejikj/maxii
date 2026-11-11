import React, { type ReactNode } from 'react';
import { LumiThemeProvider } from '@lumi/forest-design/native';
import { usePersonalPreferences } from './PreferencesContext';

/** Recolors the whole app without remounting navigation or active care forms. */
export function ThemePreferenceBridge({ children }: { children: ReactNode }) {
  const { preferences } = usePersonalPreferences();
  return <LumiThemeProvider scene="home" mode="system" motif={preferences.appMotif}>{children}</LumiThemeProvider>;
}
