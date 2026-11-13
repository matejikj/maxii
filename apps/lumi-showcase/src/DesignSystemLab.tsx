import React, { useState } from 'react';
import { Platform, ScrollView, View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import {
  LumiThemeProvider,
  useLumiTheme,
  LumiText,
  LumiButton,
  LumiCard,
  LumiInput,
  LumiChip,
  LumiTimeline,
  LumiChartContainer,
  LumiBottomSheet,
  LumiSwitchRow,
  LumiProgress,
  LumiSectionHeader,
  LumiEmptyState,
  type LumiMode,
} from '@lumi/forest-design';

const events = [
  {
    id: 'a',
    time: '08:15',
    title: 'Ranní krmení',
    detail: 'Mléko 180 ml',
    status: 'complete' as const,
  },
  {
    id: 'b',
    time: '10:30',
    title: 'Dopolední spánek',
    detail: '1 h 10 min',
    status: 'complete' as const,
  },
  {
    id: 'c',
    time: '13:00',
    title: 'Zeleninový příkrm',
    detail: 'Dneska nová chuť!',
    status: 'current' as const,
  },
];

function MiniChart() {
  const { colors } = useLumiTheme();
  return (
    <Svg
      viewBox="0 0 300 125"
      height={125}
      width="100%"
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': true, focusable: false }
        : { accessible: false })}
    >
      {[25, 60, 95].map((y) => (
        <Line key={y} x1={12} x2={290} y1={y} y2={y} stroke={colors.border} strokeWidth={1} />
      ))}
      {[58, 63, 77, 81, 95, 108, 113].map((value, index) => (
        <Rect
          key={index}
          x={18 + index * 40}
          y={120 - value}
          width={23}
          height={value}
          rx={8}
          fill={index === 6 ? colors.primary : colors.sceneAccentSoft}
        />
      ))}
      <Circle cx={270} cy={7} r={4} fill={colors.primary} />
    </Svg>
  );
}

function DesignSystemContent({
  mode,
  onModeChange,
}: {
  mode: LumiMode;
  onModeChange: (mode: LumiMode) => void;
}) {
  const { colors, ui, mode: resolved } = useLumiTheme();
  const { width } = useWindowDimensions();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('Týden');
  const [notify, setNotify] = useState(true);
  const [sheet, setSheet] = useState(false);
  const wide = width >= 760;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="lumi-ui-lab">
      <ScrollView
        contentContainerStyle={[
          styles.page,
          { padding: ui.space.xl, gap: ui.space.xl, maxWidth: wide ? 840 : ui.size.contentMax },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <LumiText variant="overline" tone="accent">
            LUMI DESIGN SYSTEM · v0.5
          </LumiText>
          <LumiText variant="display" accessibilityRole="header">
            Pohodový svět, jasná pravidla.
          </LumiText>
          <LumiText tone="muted">
            Přístupné, jednotné komponenty pro každodenní život s miminkem.
          </LumiText>
        </View>
        <View style={styles.wrap} testID="lumi-mode-switcher">
          {(['light', 'dark', 'system'] as const).map((item) => (
            <LumiChip
              key={item}
              label={item}
              testID={`mode-${item}`}
              selected={mode === item}
              onPress={() => onModeChange(item)}
            />
          ))}
        </View>
        <LumiCard variant="soft" accessibilityLabel="Aktuální téma" padding="md">
          <LumiText variant="caption" tone="muted">
            Režim: {resolved} · téma: home · kontrastní sémantické barvy
          </LumiText>
        </LumiCard>
        <LumiSectionHeader title="Interakce" subtitle="Jednotná velikost dotyku a stavy" />
        <View style={styles.wrap} testID="lumi-button-examples">
          <LumiButton
            testID="ui-primary-button"
            title="Přidat záznam"
            onPress={() => setSheet(true)}
          />
          <LumiButton title="Sekundární" variant="secondary" onPress={() => {}} />
          <LumiButton title="Obrysové" variant="outline" onPress={() => {}} />
          <LumiButton title="Nedostupné" disabled onPress={() => {}} />
        </View>
        <LumiCard testID="ui-input-card" style={{ gap: ui.space.lg }}>
          <LumiText variant="h3">Nový záznam</LumiText>
          <LumiInput
            testID="ui-name-input"
            label="Poznámka"
            value={name}
            onChangeText={setName}
            placeholder="Třeba první úsměv…"
            hint="Zůstane v tvém rodinném deníku"
          />
          <LumiInput
            label="Ukázka validace"
            error="Toto pole je povinné"
            value=""
            onChangeText={() => {}}
          />
          <View style={styles.wrap}>
            {['Den', 'Týden', 'Měsíc'].map((option) => (
              <LumiChip
                key={option}
                label={option}
                selected={selected === option}
                onPress={() => setSelected(option)}
              />
            ))}
          </View>
          <LumiSwitchRow
            label="Připomenutí"
            description="Jemná připomínka dalšího záznamu"
            value={notify}
            onValueChange={setNotify}
          />
        </LumiCard>
        <LumiSectionHeader title="Přehled růstu" subtitle="Srozumitelné grafy a metriky" />
        <LumiChartContainer
          title="Vývoj hmotnosti"
          subtitle="Ukázková data · posledních 7 období"
          summary="Hmotnost postupně roste ze 4,8 na 7,4 kilogramu."
        >
          <MiniChart />
        </LumiChartContainer>
        <LumiCard style={{ gap: ui.space.xl }}>
          <LumiProgress testID="ui-progress" label="Denní záznamy" value={3} max={5} />
          <LumiProgress label="Nové milníky" value={8} max={10} />
        </LumiCard>
        <LumiSectionHeader title="Dnešní příběh" subtitle="Chronologické události" />
        <LumiCard>
          <LumiTimeline items={events} />
        </LumiCard>
        <LumiSectionHeader title="Prázdný stav" />
        <LumiCard>
          <LumiEmptyState
            title="Zatím žádné fotografie"
            description="Až přidáš první společnou vzpomínku, zobrazí se tady."
            actionTitle="Přidat fotografii"
            onAction={() => setSheet(true)}
          />
        </LumiCard>
        <LumiText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          Všechny komponenty používají sdílené sémantické tokeny.
        </LumiText>
      </ScrollView>
      <LumiBottomSheet
        testID="ui-bottom-sheet"
        title="Nový záznam"
        visible={sheet}
        onClose={() => setSheet(false)}
      >
        <View style={{ gap: ui.space.lg }}>
          <LumiText>Co nového se dnes povedlo? Přidej krátký záznam do svého deníku.</LumiText>
          <LumiInput label="Popis události" placeholder="Něco krásného…" />
          <LumiButton testID="ui-close-sheet" title="Hotovo" onPress={() => setSheet(false)} />
        </View>
      </LumiBottomSheet>
    </View>
  );
}
export function DesignSystemLab() {
  const [mode, setMode] = useState<LumiMode>('system');
  return (
    <LumiThemeProvider scene="home" mode={mode}>
      <DesignSystemContent mode={mode} onModeChange={setMode} />
    </LumiThemeProvider>
  );
}
const styles = StyleSheet.create({
  page: { width: '100%', alignSelf: 'center', paddingBottom: 72 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' },
});
