import React, { useState } from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiInput } from '@lumi/forest-design';
const meta = {
  title: 'Forms/Input',
  component: LumiInput,
  args: { label: 'Poznámka' },
} satisfies Meta<typeof LumiInput>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function InteractiveInputs() {
    const [text, setText] = useState('');
    const [note, setNote] = useState('');
    return (
      <View style={{ gap: 18 }}>
        <LumiInput
          label="Poznámka"
          value={text}
          onChangeText={setText}
          placeholder="Co se dnes povedlo?"
        />
        <LumiInput
          label="Víceřádková poznámka"
          value={note}
          onChangeText={setNote}
          multiline
          hint="Můžete použít diktování, pokud ho vaše klávesnice nabízí."
          blurOnSubmit={false}
        />
        <LumiInput label="Povinné pole" error="Toto pole je povinné" />
        <LumiInput label="Uzamčené pole" value="Nelze upravit" editable={false} />
      </View>
    );
  },
};
