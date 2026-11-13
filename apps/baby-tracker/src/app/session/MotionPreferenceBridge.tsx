import React, { type ReactNode } from 'react';
import { LumiMotionProvider } from '@lumi/forest-design/native';
import { usePersonalPreferences } from './PreferencesContext';

/** Maps the single “Pohyb postav” preference onto forest motion without a second switch. */
export function MotionPreferenceBridge({ children }: { children: ReactNode }) {
  const { preferences } = usePersonalPreferences();
  return (
    <LumiMotionProvider enabled={preferences.characterMotionEnabled}>{children}</LumiMotionProvider>
  );
}
