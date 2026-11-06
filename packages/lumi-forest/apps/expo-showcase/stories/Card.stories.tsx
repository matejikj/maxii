import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiCard, LumiText } from '@lumi/forest-design';
const meta = { title: 'Surfaces/Card', component: LumiCard } satisfies Meta<typeof LumiCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Variants: Story = { render: () => <View style={{ gap: 16 }}>
  {(['surface', 'soft', 'outlined'] as const).map(variant =>
    <LumiCard key={variant} variant={variant}>
      <LumiText variant="h3">{variant}</LumiText>
      <LumiText tone="muted">Jedna komponenta pro všechny scény.</LumiText>
    </LumiCard>)}
</View> };
