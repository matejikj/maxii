import React, { useState } from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiSwitchRow, LumiProgress, LumiChip, LumiText } from '@lumi/forest-design';
const meta = { title: 'Forms/Controls', component: LumiChip, args: { label: 'Vybrat' } } satisfies Meta<typeof LumiChip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Gallery: Story = { render: () => {
  const [checked, setChecked] = useState(false);
  return <View style={{ gap: 16 }}>
    <LumiText variant="h3">Výběr</LumiText>
    <LumiChip label="Zvolené" selected onPress={() => {}} />
    <LumiChip label="Nezvolené" selected={false} onPress={() => {}} />
    <LumiSwitchRow label="Připomenutí" value={checked} onValueChange={setChecked} />
    <LumiProgress label="Pokrok" value={70}/>
  </View>;
} };
