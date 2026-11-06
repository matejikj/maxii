import React, { useState } from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiInput } from '@lumi/forest-design';
const meta = { title: 'Forms/Input', component: LumiInput, args: { label: 'Poznámka' } } satisfies Meta<typeof LumiInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { render: () => {
  const [text, setText] = useState('');
  return <View style={{ gap: 18 }}>
    <LumiInput label="Poznámka" value={text} onChangeText={setText} placeholder="Co se dnes povedlo?" />
    <LumiInput label="Povinné pole" error="Toto pole je povinné" />
    <LumiInput label="Uzamčené pole" value="Nelze upravit" editable={false}/>
  </View>;
} };
