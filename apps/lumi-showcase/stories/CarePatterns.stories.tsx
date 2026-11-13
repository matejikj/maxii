import React, { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native';
import {
  LumiBottomSheet,
  LumiButton,
  LumiCard,
  LumiChip,
  LumiInput,
  LumiText,
  LumiThemeProvider,
} from '@lumi/forest-design';

/**
 * Early UX walkthrough using only the public forest-design API and synthetic
 * Czech copy. No real child data and no baby-tracker imports.
 */
function DiaperSleepWalkthrough({ width }: { width: number }) {
  const [sheet, setSheet] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [note, setNote] = useState('Syntetická poznámka bez osobních údajů.');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveDirect() {
    if (pending) return;
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    setPending(false);
    setSaved(true);
    setSheet(false);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, width, maxWidth: 390 }}>
      <LumiText variant="h2">Plenka a spánek</LumiText>
      <LumiText tone="muted">Šířka {width} · žádná skutečná dětská data</LumiText>
      <LumiButton title="Plenka" onPress={() => setSheet(true)} fullWidth />
      <LumiButton title="Zahájit spánek" variant="secondary" fullWidth onPress={() => {}} />
      {saved ? <LumiText>Přebalení uloženo. Zpět · Upravit</LumiText> : null}
      <LumiCard>
        <LumiInput
          label="Poznámka"
          value={note}
          onChangeText={setNote}
          multiline
          hint="Můžete použít diktování, pokud ho vaše klávesnice nabízí."
          blurOnSubmit={false}
        />
      </LumiCard>
      <LumiBottomSheet visible={sheet} title="Zapsat plenku nyní" onClose={() => setSheet(false)}>
        <View style={{ gap: 12 }}>
          <LumiButton
            title="Zapsat mokrou"
            loading={pending}
            onPress={() => void saveDirect()}
            fullWidth
          />
          <LumiButton
            title="Zapsat stolici"
            variant="secondary"
            disabled={pending}
            onPress={() => void saveDirect()}
            fullWidth
          />
          <LumiButton
            title="Zapsat obojí"
            variant="secondary"
            disabled={pending}
            onPress={() => void saveDirect()}
            fullWidth
          />
          <LumiButton
            title="Jiný čas nebo poznámka"
            variant="ghost"
            onPress={() => {
              setSheet(false);
              setDetailed(true);
            }}
            fullWidth
          />
        </View>
      </LumiBottomSheet>
      <LumiBottomSheet
        visible={detailed}
        title="Podrobný zápis plenky"
        onClose={() => setDetailed(false)}
      >
        <View style={{ gap: 12 }}>
          <LumiInput label="Čas události" value="2024-06-01 10:20" onChangeText={() => {}} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <LumiChip label="ml" selected onPress={() => {}} />
            <LumiChip label="g" onPress={() => {}} />
          </View>
          <LumiButton title="Uložit" onPress={() => setDetailed(false)} fullWidth />
        </View>
      </LumiBottomSheet>
    </ScrollView>
  );
}

const meta = {
  title: 'Product/CarePatterns',
  component: DiaperSleepWalkthrough,
} satisfies Meta<typeof DiaperSleepWalkthrough>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Width390Day: Story = {
  args: { width: 390 },
  render: () => (
    <LumiThemeProvider scene="home" mode="light">
      <DiaperSleepWalkthrough width={390} />
    </LumiThemeProvider>
  ),
};

export const Width320Night: Story = {
  args: { width: 320 },
  render: () => (
    <LumiThemeProvider scene="home" mode="dark">
      <DiaperSleepWalkthrough width={320} />
    </LumiThemeProvider>
  ),
};

export const LargeTextFriendly: Story = {
  args: { width: 390 },
  render: function LargeTextCarePattern() {
    const { width } = useWindowDimensions();
    return (
      <LumiThemeProvider scene="home" mode="system">
        <DiaperSleepWalkthrough width={Math.min(390, width)} />
      </LumiThemeProvider>
    );
  },
};
