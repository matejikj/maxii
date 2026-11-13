import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  LumiBackground,
  LumiCard,
  LumiThemeProvider,
  SCENE_CATALOG,
  LUMI_SCENES,
  type LumiScene,
} from '@lumi/forest-design';
import { PerfLab } from './src/PerfLab';
import { CharacterLab } from './src/CharacterLab';
import { SceneLab } from './src/SceneLab';
import { DesignSystemLab } from './src/DesignSystemLab';
import { AnimationLab } from './src/AnimationLab';

const LABELS: Readonly<
  Record<LumiScene, { title: string; subtitle: string; value: string; unit: string; note: string }>
> = {
  home: {
    title: 'Ahoj, maličký',
    subtitle: 'Každý den je nové dobrodružství.',
    value: '6',
    unit: 'měsíců',
    note: 'Dneska můžeme objevit něco nového.',
  },
  growth: {
    title: 'Jak krásně rosteš',
    subtitle: 'Malé krůčky, velké proměny.',
    value: '7,4',
    unit: 'kg',
    note: 'Poslední ukázkové měření',
  },
  sleep: {
    title: 'Sladké sny',
    subtitle: 'Klidná noc plná snů.',
    value: '12',
    unit: 'hodin',
    note: 'Ukázkový spánek za den',
  },
  feeding: {
    title: 'Dobrou chuť',
    subtitle: 'Nové chutě, nové zážitky.',
    value: '5',
    unit: 'jídel',
    note: 'Ukázková jídla dnes',
  },
  milestones: {
    title: 'Malé zázraky',
    subtitle: 'Každý pokrok stojí za oslavu.',
    value: '8',
    unit: 'milníků',
    note: 'Ukázkových záznamů',
  },
};

function Showcase() {
  const [selection, setSelection] = useState<
    LumiScene | 'perf' | 'characters' | 'procedural' | 'ui' | 'motion'
  >('home');
  const { width, height } = useWindowDimensions();
  const scene =
    selection === 'perf' ||
    selection === 'characters' ||
    selection === 'procedural' ||
    selection === 'ui' ||
    selection === 'motion'
      ? 'home'
      : selection;
  const content = LABELS[scene];
  const isWide = width > 670;
  const isPerf = selection === 'perf';
  const isCharacters = selection === 'characters';
  const isProcedural = selection === 'procedural';
  const isUi = selection === 'ui';
  const isMotion = selection === 'motion';
  return (
    <LumiThemeProvider scene={scene} mode="light">
      <View style={styles.root} testID="lumi-showcase">
        <StatusBar barStyle="dark-content" />
        {!isPerf && !isCharacters && !isProcedural && !isUi && !isMotion && (
          <LumiBackground scene={scene} density="quiet" seed="e2e-static-seed" mode="auto" />
        )}
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>
                ✦ LUMI <Text style={styles.brandLight}>FOREST</Text>
              </Text>
              <Text style={styles.version}>Design system lab · 0.6.0</Text>
            </View>
            <View style={styles.circle}>
              <Text style={styles.circleText}>✿</Text>
            </View>
          </View>
          <ScrollView
            testID="scene-tabs"
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.navScroll}
            contentContainerStyle={styles.nav}
          >
            {LUMI_SCENES.map((id) => (
              <Pressable
                key={id}
                testID={`scene-selector-${id}`}
                onPress={() => setSelection(id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: selection === id }}
                style={[styles.tab, selection === id && styles.tabSelected]}
              >
                <Text style={[styles.tabText, selection === id && styles.tabSelectedText]}>
                  {id}
                </Text>
              </Pressable>
            ))}
            <Pressable
              testID="scene-selector-characters"
              onPress={() => setSelection('characters')}
              accessibilityRole="tab"
              accessibilityState={{ selected: isCharacters }}
              style={[styles.tab, isCharacters && styles.tabSelected]}
            >
              <Text style={[styles.tabText, isCharacters && styles.tabSelectedText]}>
                characters
              </Text>
            </Pressable>
            <Pressable
              testID="scene-selector-procedural"
              onPress={() => setSelection('procedural')}
              accessibilityRole="tab"
              accessibilityState={{ selected: isProcedural }}
              style={[styles.tab, isProcedural && styles.tabSelected]}
            >
              <Text style={[styles.tabText, isProcedural && styles.tabSelectedText]}>worlds</Text>
            </Pressable>
            <Pressable
              testID="scene-selector-ui"
              onPress={() => setSelection('ui')}
              accessibilityRole="tab"
              accessibilityState={{ selected: isUi }}
              style={[styles.tab, isUi && styles.tabSelected]}
            >
              <Text style={[styles.tabText, isUi && styles.tabSelectedText]}>ui kit</Text>
            </Pressable>
            <Pressable
              testID="scene-selector-motion"
              onPress={() => setSelection('motion')}
              accessibilityRole="tab"
              accessibilityState={{ selected: isMotion }}
              style={[styles.tab, isMotion && styles.tabSelected]}
            >
              <Text style={[styles.tabText, isMotion && styles.tabSelectedText]}>motion</Text>
            </Pressable>
            <Pressable
              testID="scene-selector-perf"
              onPress={() => setSelection('perf')}
              accessibilityRole="tab"
              accessibilityState={{ selected: isPerf }}
              style={[styles.tab, isPerf && styles.tabSelected]}
            >
              <Text style={[styles.tabText, isPerf && styles.tabSelectedText]}>perf</Text>
            </Pressable>
          </ScrollView>
          {isPerf ? (
            <PerfLab />
          ) : isCharacters ? (
            <CharacterLab />
          ) : isProcedural ? (
            <SceneLab />
          ) : isUi ? (
            <DesignSystemLab />
          ) : isMotion ? (
            <AnimationLab />
          ) : (
            <ScrollView
              testID={`screen-${scene}`}
              contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.eyebrow}>TVŮJ PŘÍBĚH · UKÁZKA</Text>
              <Text style={[styles.heading, isWide && styles.headingWide]}>{content.title}</Text>
              <Text style={styles.subtitle}>{content.subtitle}</Text>
              <LumiCard testID={`metric-card-${scene}`} style={styles.card}>
                <Text style={styles.cardCaption}>DNEŠNÍ PŘEHLED</Text>
                <View style={styles.metricRow}>
                  <Text style={styles.bigMetric}>{content.value}</Text>
                  <Text style={styles.unit}>{content.unit}</Text>
                </View>
                <View style={styles.rule} />
                <Text style={styles.cardNote}>{content.note}</Text>
              </LumiCard>
              <View style={styles.footerHint}>
                <View style={styles.dot} />
                <Text style={styles.footerText}>
                  Ilustrace: {SCENE_CATALOG[scene].defaultAnimal} · responsivní SVG
                </Text>
              </View>
            </ScrollView>
          )}
          <View style={styles.bottom}>
            <Text style={styles.bottomText}>
              {isPerf
                ? 'RELEASE BUILD BENCHMARK'
                : isCharacters
                  ? 'CHARACTER ENGINE · PURE VECTOR IR'
                  : isProcedural
                    ? 'PROCEDURAL WORLD GENERATION'
                    : isMotion
                      ? 'ANIMATION ENGINE · UI THREAD'
                      : isUi
                        ? 'LUMI UI DESIGN SYSTEM · v0.5'
                        : `${Math.round(width)} × ${Math.round(height)} dp · adaptivní scéna`}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </LumiThemeProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Showcase />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAF7F1' },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { color: '#384C4A', fontSize: 25, fontWeight: '800', letterSpacing: 2 },
  brandLight: { fontWeight: '400', letterSpacing: 1 },
  version: { color: '#647672', fontSize: 10, marginTop: 2, letterSpacing: 1 },
  circle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F0E8',
  },
  circleText: { color: '#779A86', fontSize: 22 },
  navScroll: { flexGrow: 0, maxHeight: 62 },
  nav: { paddingHorizontal: 24, alignItems: 'center', gap: 8, paddingVertical: 10 },
  tab: {
    backgroundColor: 'rgba(255,255,255,.78)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ECEAE4',
  },
  tabSelected: { backgroundColor: '#384C4A', borderColor: '#384C4A' },
  tabText: { color: '#647672', fontWeight: '600', fontSize: 12, textTransform: 'capitalize' },
  tabSelectedText: { color: '#fff' },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 100, gap: 8 },
  bodyWide: { alignSelf: 'center', width: '100%', maxWidth: 540 },
  eyebrow: {
    letterSpacing: 2.2,
    fontSize: 10,
    fontWeight: '700',
    color: '#819B89',
    marginBottom: 3,
  },
  heading: { fontSize: 31, lineHeight: 38, fontWeight: '800', color: '#384C4A', maxWidth: 440 },
  headingWide: { fontSize: 36, lineHeight: 44 },
  subtitle: { fontSize: 14, color: '#647672', lineHeight: 23, marginTop: 3, marginBottom: 20 },
  card: { minHeight: 172, borderRadius: 25 },
  cardCaption: { fontSize: 11, letterSpacing: 1.6, fontWeight: '800', color: '#819B89' },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 8 },
  bigMetric: { fontSize: 43, lineHeight: 53, fontWeight: '800', color: '#384C4A' },
  unit: { fontSize: 16, color: '#647672', fontWeight: '600' },
  rule: { height: 1, backgroundColor: '#EDF0EB', marginTop: 8, marginBottom: 12 },
  cardNote: { fontSize: 13, color: '#647672' },
  footerHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 6, height: 6, backgroundColor: '#9FB6A5', borderRadius: 5 },
  footerText: { fontSize: 11, color: '#647672' },
  bottom: { padding: 10, alignItems: 'center' },
  bottomText: { fontSize: 9, letterSpacing: 1.2, color: '#778F80' },
});
