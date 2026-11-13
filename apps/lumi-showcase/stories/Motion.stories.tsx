import React, { useState } from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import {
  LumiAnimatedCharacter,
  LumiButton,
  LumiMotionProvider,
  LumiText,
} from '@lumi/forest-design';

const meta = {
  title: 'Illustrations/Motion',
  component: LumiAnimatedCharacter,
  args: { species: 'rabbit', motion: 'idle' },
} satisfies Meta<typeof LumiAnimatedCharacter>;
export default meta;
type Story = StoryObj<typeof meta>;

function Interactive() {
  const [count, setCount] = useState(0);
  const [reduce, setReduce] = useState(false);
  return (
    <LumiMotionProvider preferReducedMotion={reduce}>
      <View style={{ backgroundColor: '#FAF7F1', padding: 16, gap: 12, alignItems: 'center' }}>
        <LumiText variant="h3">Pohybové profily</LumiText>
        <View style={{ flexDirection: 'row', gap: 15 }}>
          <LumiAnimatedCharacter
            species="rabbit"
            motion="idle"
            celebrationKey={count}
            width={135}
            height={155}
          />
          <LumiAnimatedCharacter
            species="fox"
            pose="sleeping"
            expression="sleepy"
            motion="sleeping"
            width={135}
            height={155}
          />
        </View>
        <LumiButton title="Oslavit milník" onPress={() => setCount((n) => n + 1)} />
        <LumiButton
          variant="secondary"
          title={reduce ? 'Zapnout pohyb (pokud OS dovolí)' : 'Omezit pohyb'}
          onPress={() => setReduce((v) => !v)}
        />
        <LumiText variant="caption">Systémové Reduce Motion nelze přepsat.</LumiText>
      </View>
    </LumiMotionProvider>
  );
}
export const InteractiveCharacters: Story = { render: () => <Interactive /> };
