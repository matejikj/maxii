import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import { LumiChartContainer, LumiText } from '@lumi/forest-design';
const meta = {
  title: 'Data/ChartContainer',
  component: LumiChartContainer,
  args: { title: 'Vývoj hmotnosti', summary: 'Hodnota pravidelně roste', children: null },
} satisfies Meta<typeof LumiChartContainer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Summary: Story = {
  render: () => (
    <LumiChartContainer
      title="Vývoj hmotnosti"
      summary="Za 4 měsíce přibylo 2,3 kg."
      table={[
        { label: 'Únor', value: '4,2 kg' },
        { label: 'Červen', value: '6,5 kg' },
      ]}
    >
      <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
        <LumiText>Sem vlož svůj chart renderer</LumiText>
      </View>
    </LumiChartContainer>
  ),
};
