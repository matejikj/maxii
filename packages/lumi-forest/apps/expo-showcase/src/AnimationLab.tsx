import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  composeScene, LUMI_ANIMALS, LUMI_SCENES, LumiAnimatedCharacter, LumiAnimatedProceduralBackground,
  LumiMotionProvider, LumiSceneTransition, useLumiMotion,
  type LumiAnimal, type LumiScene, type CharacterMotion,
} from '@lumi/forest-design';

const MotionStateLabel = () => {
  const { canAnimate, reduceMotion, foreground } = useLumiMotion();
  return (
    <Text style={styles.note} testID="motion-accessibility-state">
      Animace: {canAnimate ? 'aktivní' : 'vypnuté'} · Reduce Motion: {reduceMotion ? 'ano' : 'ne'} · App aktivní: {foreground ? 'ano' : 'ne'}
    </Text>
  );
};

function Toggle({ label, selected, onPress, id }: { label: string; selected: boolean; onPress: () => void; id: string }) {
  return <Pressable testID={id} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
    style={[styles.chip, selected && styles.selected]}>
    <Text style={[styles.chipText, selected && styles.selectedText]}>{label}</Text>
  </Pressable>;
}

function Gallery({ paused }: { paused: boolean }) {
  const [species, setSpecies] = useState<LumiAnimal>('rabbit');
  const [motion, setMotion] = useState<CharacterMotion>('idle');
  const [scene, setScene] = useState<LumiScene>('home');
  const [celebrationKey, setCelebrationKey] = useState(0);
  const document = useMemo(() => composeScene({ scene, seed: 'animation-lab-static', density: 'quiet' }), [scene]);
  return <ScrollView testID="animation-lab" style={styles.scroll} contentContainerStyle={styles.content}>
    <Text style={styles.overline}>ANIMATION ENGINE · V0.6</Text>
    <Text style={styles.title}>Lesní kamarádi ožívají</Text>
    <Text style={styles.subtitle}>Animace mění pouze vlastnosti SVG skupin. Scéna a anatomie se přepočítají jen při změně vstupu.</Text>
    <MotionStateLabel />
    <Text style={styles.subhead}>Postava</Text>
    <View style={styles.row}>
      {LUMI_ANIMALS.map(animal => <Toggle key={animal} id={`motion-animal-${animal}`} label={animal}
        selected={species === animal} onPress={() => setSpecies(animal)}/>)}
    </View>
    <Text style={styles.subhead}>Pohyb</Text>
    <View style={styles.row}>
      {(['idle','sleeping','still'] as const).map(mode => <Toggle key={mode} id={`motion-mode-${mode}`}
        label={mode} selected={motion === mode} onPress={() => setMotion(mode)}/>)}
    </View>
    <View style={styles.characterStage} testID="motion-character-stage">
      <LumiAnimatedCharacter species={species} pose={motion === 'sleeping' ? 'sleeping' : 'sitting'}
        expression={motion === 'sleeping' ? 'sleepy' : 'neutral'}
        motion={motion} playing={!paused} celebrationKey={celebrationKey} width={245} height={250}
        testID="animated-character"/>
    </View>
    <Pressable testID="motion-celebrate" onPress={() => setCelebrationKey(n => n + 1)}
      style={styles.primary} accessibilityRole="button" accessibilityLabel="Oslavit milník">
      <Text style={styles.primaryText}>✦ Oslavit nový milník</Text>
    </Pressable>
    <Text style={styles.subhead}>Pozadí a přechody scén</Text>
    <View style={styles.row}>
      {LUMI_SCENES.map(id => <Toggle key={id} id={`motion-scene-${id}`} label={id}
        selected={scene === id} onPress={() => setScene(id)}/>)}
    </View>
    <View style={styles.sceneStage} testID="motion-scene-stage">
      <LumiSceneTransition document={document} mode="contain" playing={!paused} testID="animated-scene"/>
    </View>
    <Text style={styles.subhead}>Živý procedurální svět s rezervovaným prostorem</Text>
    <View style={styles.proceduralStage} testID="motion-procedural-stage">
      <LumiAnimatedProceduralBackground scene={scene} seed="motion-world" density="quiet"
        animal={species} pose={motion === 'sleeping' ? 'sleeping' : 'sitting'}
        expression={motion === 'sleeping' ? 'sleepy' : 'neutral'} motion={motion}
        safeZones={[{ id: 'text-region', x: 10, y: 18, width: 210, height: 125, padding: 10 }]}
        playing={!paused} celebrationKey={celebrationKey}/>
      <Text style={styles.safeOverlay}>Bezpečná zóna pro UI</Text>
    </View>
    <Text style={styles.note}>Pro výkonové ověření používej release build na fyzickém zařízení. Pokud v iOS/Android zapneš Reduce Motion, všechny smyčky se zastaví a zůstane původní statická ilustrace.</Text>
  </ScrollView>;
}

/** Lab can also simulate app-level pause and a stricter preference than the OS. */
export function AnimationLab() {
  const [preferReduced, setPreferReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  return <LumiMotionProvider preferReducedMotion={preferReduced}>
    <View style={styles.lab}>
      <View style={styles.toolbar}>
        <Toggle label="Bez animací" id="motion-reduce-override" selected={preferReduced} onPress={() => setPreferReduced(v => !v)}/>
        <Toggle label="Pozastavit" id="motion-pause" selected={paused} onPress={() => setPaused(v => !v)}/>
      </View>
      <Gallery paused={paused}/>
    </View>
  </LumiMotionProvider>;
}
const styles = StyleSheet.create({
  lab: { flex: 1 }, scroll: { flex: 1 }, content: { paddingHorizontal: 18, paddingBottom: 60 },
  toolbar: { paddingHorizontal: 18, paddingVertical: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overline: { color: '#73967F', fontWeight: '800', letterSpacing: 1.5, fontSize: 10 },
  title: { color: '#384C4A', fontSize: 24, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#586B64', fontSize: 12, lineHeight: 19, marginTop: 6 },
  subhead: { color: '#384C4A', marginTop: 18, marginBottom: 7, fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#BECABF', paddingHorizontal: 11, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  selected: { backgroundColor: '#384C4A', borderColor: '#384C4A' },
  chipText: { color: '#384C4A', fontSize: 12, fontWeight: '700' },
  selectedText: { color: '#FFFFFF' },
  characterStage: { backgroundColor: '#EFF1E8', borderRadius: 24, height: 270, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  primary: { backgroundColor: '#384C4A', padding: 13, borderRadius: 16, alignItems: 'center', marginTop: 10, minHeight: 44 },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  sceneStage: { height: 290, overflow: 'hidden', borderRadius: 22, backgroundColor: '#F8F6EF', marginTop: 9 },
  proceduralStage: { height: 370, position: 'relative', overflow: 'hidden', borderRadius: 22, marginTop: 8 },
  safeOverlay: { position: 'absolute', top: 40, left: 20, color: '#384C4A', fontSize: 12, fontWeight: '700' },
  note: { color: '#657C70', fontSize: 11, lineHeight: 18, marginTop: 10 },
});
