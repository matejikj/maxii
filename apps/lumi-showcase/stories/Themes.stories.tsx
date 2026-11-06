import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiThemeProvider, LumiCard, LumiText, LumiButton, LumiProgress, resolveLumiTheme } from '@lumi/forest-design';
function ThemeTile({ mode }: { mode: 'light' | 'dark' }) {
  const colors = resolveLumiTheme('home', mode).colors;
  return <LumiThemeProvider scene="home" mode={mode}><View style={{ flex: 1, backgroundColor: colors.background, padding: 14, gap: 12, borderRadius: 18 }}>
    <LumiText variant="overline" tone="accent">{mode.toUpperCase()}</LumiText>
    <LumiCard padding="md"><LumiText variant="h3">Malé radosti</LumiText>
      <LumiText tone="muted">Jednotný systém komponent</LumiText></LumiCard>
    <LumiProgress label="Pokrok" value={66} />
    <LumiButton title="Nový záznam" onPress={() => {}} />
  </View></LumiThemeProvider>;
}
const meta = { title: 'Foundations/Themes', component: ThemeTile, args: { mode: 'light' as const } } satisfies Meta<typeof ThemeTile>;
export default meta;
type Story = StoryObj<typeof meta>;
export const LightAndDark: Story = { render: () => {
  const { width } = useWindowDimensions();
  return <View style={{ flexDirection: width < 600 ? 'column' : 'row', gap: 12 }}>
    <ThemeTile mode="light"/><ThemeTile mode="dark"/>
  </View>;
} };
