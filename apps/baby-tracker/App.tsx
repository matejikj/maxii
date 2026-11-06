import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LumiThemeProvider } from '@lumi/forest-design/native';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <LumiThemeProvider scene="home" mode="system">
        <HomeScreen />
      </LumiThemeProvider>
    </SafeAreaProvider>
  );
}
