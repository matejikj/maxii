import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiBottomSheet, LumiButton, LumiText } from '@lumi/forest-design';
const meta = {
  title: 'Overlays/BottomSheet',
  component: LumiBottomSheet,
  args: { title: 'Nový záznam', visible: false, onClose: () => {}, children: null },
} satisfies Meta<typeof LumiBottomSheet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {
  render: function InteractiveBottomSheet() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <LumiButton title="Otevřít" onPress={() => setOpen(true)} />
        <LumiBottomSheet visible={open} title="Nový záznam" onClose={() => setOpen(false)}>
          <LumiText>Dialog s podporou nativního tlačítka zpět.</LumiText>
          <LumiButton title="Hotovo" onPress={() => setOpen(false)} />
        </LumiBottomSheet>
      </>
    );
  },
};
