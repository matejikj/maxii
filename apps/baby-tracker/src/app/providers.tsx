import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LumiThemeProvider } from '@lumi/forest-design/native';
import { createCompositionRoot, type CompositionRoot } from './createServices';

const CompositionContext = createContext<CompositionRoot | null>(null);

export function AppProviders({ children }: { children: ReactNode }) {
  const root = useMemo(() => createCompositionRoot(), []);
  return (
    <CompositionContext.Provider value={root}>
      <SafeAreaProvider>
        <LumiThemeProvider scene="home" mode="system">
          {children}
        </LumiThemeProvider>
      </SafeAreaProvider>
    </CompositionContext.Provider>
  );
}

export function useCompositionRoot(): CompositionRoot {
  const value = useContext(CompositionContext);
  if (value == null) {
    throw new Error('Composition root is unavailable outside AppProviders.');
  }
  return value;
}
