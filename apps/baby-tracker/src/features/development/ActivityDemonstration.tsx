import React, { Component, useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { LumiButton, LumiPlayScene, LumiText, useLumiMotion, useLumiTheme } from '@lumi/forest-design/native';
import type { ActivityRevision } from '../../content';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { ForestCardLandscape } from '../ui/ForestCardLandscape';
import { resolveActivityDemonstration } from './activityDemonstrations';

type Props = { revision: ActivityRevision; visible: boolean; onSceneLayout: (height: number) => void; onShowScene: () => void };
const STEP_DURATION_MS = 4200;
class DemonstrationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <LumiText variant="caption" tone="muted">Postup hry najdete v jednotlivých krocích níže.</LumiText> : this.props.children;
  }
}
export function ActivityDemonstration(props: Props) {
  return <DemonstrationBoundary key={props.revision.revisionId}><Demonstration {...props} /></DemonstrationBoundary>;
}
function Demonstration({ revision, visible, onSceneLayout, onShowScene }: Props) {
  const { preferences, babyAvatar } = usePersonalPreferences();
  const { colors, mode } = useLumiTheme();
  const { foreground } = useLumiMotion();
  const focused = useIsFocused();
  const { width, fontScale } = useWindowDimensions();
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused' | 'finished'>('idle');
  const [playback, setPlayback] = useState({ step: 0, cycle: 0 });
  const [displayStep, setDisplayStep] = useState(0);
  const [focusStep, setFocusStep] = useState<number | null>(null);
  const instructionLayoutKey = `${width}/${fontScale}`;
  const [instructionSize, setInstructionSize] = useState({ key: instructionLayoutKey, height: 0 });
  const demo = resolveActivityDemonstration(revision);
  const count = revision.steps.length;
  const active = !!demo && status === 'playing' && visible && focused && foreground;
  const finish = useCallback(() => setStatus('finished'), []);
  function seek(index: number) {
    if (!visible) onShowScene();
    setDisplayStep(index);
    setPlayback((current) => ({ step: index, cycle: current.cycle + 1 }));
    setStatus('playing');
  }
  function togglePlayback() {
    if (active) { setStatus('paused'); return; }
    if (status === 'finished') { seek(0); return; }
    if (!visible) onShowScene();
    setStatus('playing');
  }
  if (!demo) return null;
  const selectedStep = Math.min(displayStep, count - 1);
  const playTitle = active ? 'Pozastavit' : status === 'finished' ? 'Přehrát znovu' : status === 'idle' ? 'Přehrát ukázku' : 'Pokračovat';
  return <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="activity-demonstration">
    <View onLayout={(event) => onSceneLayout(event.nativeEvent.layout.height)}
      style={[styles.stage, { backgroundColor: colors.surfaceSubtle }]} accessible={false}
      importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <ForestCardLandscape variant="day" opacity={mode === 'dark' ? .26 : .32} />
      <View style={styles.sceneTag}><LumiText variant="overline" tone="muted" style={styles.overline}>TAKHLE SI HRAJEME</LumiText></View>
      <LumiPlayScene action={demo.action} babyPose={demo.babyPose} {...(demo.object === undefined ? {} : { object: demo.object })}
        babyVariant={babyAvatar} guideSpecies={preferences.guideSpecies} appearanceStyle={preferences.appearanceStyle}
        colorMode={mode} step={playback.step} stepCount={count} cycle={playback.cycle} playing={active} motionIntent="user"
        onStepChange={setDisplayStep} onComplete={finish}
        stepDurationMs={STEP_DURATION_MS} height={Math.max(180, Math.min(265, (Math.min(width, 620) - 44) * .6))}
        testID="activity-play-scene" />
    </View>
    <View style={styles.body}>
      <View style={styles.topLine}>
        <LumiText variant="bodyStrong" accessibilityRole="header">Malá ukázka hry</LumiText>
        <LumiText variant="caption" tone="muted" testID="activity-demo-position">Krok {selectedStep + 1} z {count}</LumiText>
      </View>
      <View style={styles.steps} accessibilityRole="tablist" accessibilityLabel="Kroky ukázky hry">
        {revision.steps.map((step, index) => <Pressable key={index} accessibilityRole="tab"
          accessibilityLabel={`Krok ${index + 1}: ${step}`} accessibilityState={{ selected: selectedStep === index }}
          testID={`activity-demo-step-${index}`} onFocus={() => setFocusStep(index)} onBlur={() => setFocusStep(null)}
          onPress={() => seek(index)}
          style={({ pressed }) => [styles.step, { backgroundColor: selectedStep === index ? colors.primary : colors.surfaceSubtle,
            borderColor: focusStep === index ? colors.focus : 'transparent', opacity: pressed ? .8 : 1 }]}>
          <LumiText variant="label" style={{ color: selectedStep === index ? colors.onPrimary : colors.textMuted }}>{index + 1}</LumiText>
        </Pressable>)}
      </View>
      <View style={{ minHeight: instructionSize.key === instructionLayoutKey ? instructionSize.height : 0 }}>
        {/* Reserve the tallest instruction so Play/Pause stays under the finger
            as steps change, including at larger accessibility text sizes. */}
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={styles.instructionMeasure}>
          {revision.steps.map((step, index) => <LumiText key={index} style={styles.instructionMeasure}
            onLayout={(event) => {
              const height = Math.ceil(event.nativeEvent.layout.height);
              setInstructionSize((current) => current.key === instructionLayoutKey && current.height >= height
                ? current : { key: instructionLayoutKey, height: Math.max(current.key === instructionLayoutKey ? current.height : 0, height) });
            }}>{step}</LumiText>)}
        </View>
        <LumiText accessibilityLiveRegion="none" testID="activity-demo-instruction">{revision.steps[selectedStep]}</LumiText>
      </View>
      <View style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><LumiButton title={playTitle} fullWidth
          testID="activity-demo-play" variant="secondary" onPress={togglePlayback} /></View>
        <View style={{ flex: 1 }}><LumiButton title="Od začátku" fullWidth variant="ghost" testID="activity-demo-restart"
          onPress={() => seek(0)} /></View>
      </View>
      <LumiText variant="caption" tone="muted" accessibilityLiveRegion="polite" testID="activity-demo-status">
        {status === 'finished' ? 'Ukázka je u konce. Můžete si ji přehrát znovu nebo vybrat jednotlivý krok.'
          : status === 'paused' ? 'Pozastaveno. Pokračování naváže na stejném místě.'
          : status === 'playing' ? 'Průvodce zastupuje dospělého. Postupujte podle pokynů hry.'
          : 'Pusťte si celou ukázku nebo vyberte krok, který chcete vidět.'}
      </LumiText>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { borderRadius: 26, borderWidth: 1, overflow: 'hidden', marginVertical: 6 },
  stage: { overflow: 'hidden', paddingTop: 24, paddingBottom: 2 },
  sceneTag: { position: 'absolute', top: 14, left: 18 },
  overline: { fontSize: 10, lineHeight: 16, letterSpacing: 1.5 },
  body: { padding: 18, gap: 14 },
  topLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { minWidth: 48, minHeight: 48, borderRadius: 16, borderWidth: 2, padding: 10, alignItems: 'center', justifyContent: 'center' },
  instructionMeasure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
});
