import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiText } from '@lumi/forest-design';
const meta = { title: 'Foundations/Typography', component: LumiText } satisfies Meta<typeof LumiText>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Hierarchy: Story = { render: () => <View style={{ gap: 12 }}>
  <LumiText variant="display">Vývoj dítěte</LumiText>
  <LumiText variant="h1">Velké milníky</LumiText>
  <LumiText variant="h2">Drobné radosti</LumiText>
  <LumiText variant="h3">Dnešní den</LumiText>
  <LumiText variant="body">Text určený pro pohodlné čtení na telefonu.</LumiText>
  <LumiText variant="caption" tone="muted">Doplňková poznámka</LumiText>
  <LumiText variant="overline" tone="accent">KATEGORIE</LumiText>
</View> };
