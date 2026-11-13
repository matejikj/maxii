import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiButton } from '@lumi/forest-design';
const meta = {
  title: 'Actions/Button',
  component: LumiButton,
  args: { title: 'Přidat záznam', onPress: () => {} },
} satisfies Meta<typeof LumiButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Variants: Story = {
  render: () => (
    <View style={{ gap: 12 }}>
      <LumiButton title="Primary" onPress={() => {}} />
      <LumiButton title="Secondary" variant="secondary" onPress={() => {}} />
      <LumiButton title="Outline" variant="outline" onPress={() => {}} />
      <LumiButton title="Ghost" variant="ghost" onPress={() => {}} />
      <LumiButton title="Destructive" variant="destructive" onPress={() => {}} />
      <LumiButton title="Loading" loading onPress={() => {}} />
      <LumiButton title="Disabled" disabled onPress={() => {}} />
    </View>
  ),
};
