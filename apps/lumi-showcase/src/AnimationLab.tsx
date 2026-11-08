import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CHARACTER_COLLECTION, CHARACTER_SEMANTIC_STATES, LUMI_ANIMALS,
  LumiAnimatedCharacter, LumiAnimatedProceduralBackground, LumiCharacter,
  LumiMotionProvider, LumiSceneTransition, composeScene, listSignatureActionIds,
  resolveCompanionPresentation, useCompanionPlaying, useLumiMotion,
  type CharacterSemanticState, type LumiAnimal, type LumiScene,
} from '@lumi/forest-design';

const MotionStateLabel = () => {
  const { canAnimate, reduceMotion, foreground, enabled } = useLumiMotion();
  return (
    <Text style={styles.note} testID="motion-accessibility-state">
      Animace: {canAnimate ? 'aktivní' : 'vypnuté'} · Pohyb postav: {enabled ? 'ano' : 'ne'} · Reduce Motion:{' '}
      {reduceMotion ? 'ano' : 'ne'} · App aktivní: {foreground ? 'ano' : 'ne'}
    </Text>
  );
};

function Toggle({
  label,
  selected,
  onPress,
  id,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  id: string;
}) {
  return (
    <Pressable
      testID={id}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.chipText, selected && styles.selectedText]}>{label}</Text>
    </Pressable>
  );
}

function Gallery({ paused }: { paused: boolean }) {
  const [species, setSpecies] = useState<LumiAnimal>('rabbit');
  const [semantic, setSemantic] = useState<CharacterSemanticState>('calm');
  const [signatureAction, setSignatureAction] = useState<string | null>(null);
  const [scene, setScene] = useState<LumiScene>('home');
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const playing = useCompanionPlaying(!paused);
  const document = useMemo(
    () => composeScene({ scene, seed: 'animation-lab-static', density: 'quiet' }),
    [scene],
  );
  const presentation = useMemo(
    () =>
      resolveCompanionPresentation({
        species,
        semantic: signatureAction ? null : semantic,
        signatureAction,
        animate: playing,
      }),
    [species, semantic, signatureAction, playing, burstKey],
  );
  const actions = listSignatureActionIds(species);

  return (
    <ScrollView testID="animation-lab" style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.overline}>ANIMATION ENGINE · V0.6</Text>
      <Text style={styles.title}>Lesní kamarádi ožívají</Text>
      <Text style={styles.subtitle}>
        Sémantické stavy a signature akce se mapují na rig bez produktových dat. Přerušení, rychlé
        opakování a změna postavy během gesta musí zůstat bezpečné.
      </Text>
      <MotionStateLabel />
      <Text style={styles.subhead}>Postava</Text>
      <View style={styles.row}>
        {LUMI_ANIMALS.map((animal) => (
          <Toggle
            key={animal}
            id={`motion-animal-${animal}`}
            label={animal}
            selected={species === animal}
            onPress={() => {
              setSpecies(animal);
              setSignatureAction(null);
              setBurstKey((n) => n + 1);
            }}
          />
        ))}
      </View>
      <Text style={styles.subhead}>Sémantický stav</Text>
      <View style={styles.row}>
        {CHARACTER_SEMANTIC_STATES.map((state) => (
          <Toggle
            key={state}
            id={`motion-semantic-${state}`}
            label={state}
            selected={signatureAction == null && semantic === state}
            onPress={() => {
              setSignatureAction(null);
              setSemantic(state);
              setBurstKey((n) => n + 1);
            }}
          />
        ))}
      </View>
      <Text style={styles.subhead}>Signature akce · {CHARACTER_COLLECTION[species].displayName}</Text>
      <View style={styles.row}>
        {actions.map((actionId) => (
          <Toggle
            key={actionId}
            id={`motion-action-${actionId}`}
            label={actionId}
            selected={signatureAction === actionId}
            onPress={() => {
              setSignatureAction(actionId);
              setBurstKey((n) => n + 1);
            }}
          />
        ))}
        <Toggle
          label="opakovat gesto"
          id="motion-replay-gesture"
          selected={false}
          onPress={() => setBurstKey((n) => n + 1)}
        />
      </View>
      <View style={styles.characterStage} testID="motion-character-stage">
        {presentation.animate ? (
          <LumiAnimatedCharacter
            species={presentation.species}
            pose={presentation.pose}
            expression={presentation.expression}
            motion={presentation.motion}
            playing={playing}
            {...(presentation.prop ? { prop: presentation.prop } : {})}
            celebrationKey={celebrationKey}
            width={245}
            height={250}
            testID="animated-character"
          />
        ) : (
          <LumiCharacter
            species={presentation.species}
            pose={presentation.pose}
            expression={presentation.expression}
            {...(presentation.prop ? { prop: presentation.prop } : {})}
            width={245}
            height={250}
          />
        )}
      </View>
      <Pressable
        testID="motion-celebrate"
        onPress={() => setCelebrationKey((n) => n + 1)}
        style={styles.primary}
        accessibilityRole="button"
        accessibilityLabel="Oslavit milník"
      >
        <Text style={styles.primaryText}>✦ Oslavit potvrzený zápis</Text>
      </Pressable>
      <Text style={styles.subhead}>Pozadí a přechody scén</Text>
      <View style={styles.row}>
        {(['home', 'growth', 'sleep', 'feeding', 'milestones'] as const).map((id) => (
          <Toggle
            key={id}
            id={`motion-scene-${id}`}
            label={id}
            selected={scene === id}
            onPress={() => setScene(id)}
          />
        ))}
      </View>
      <View style={styles.sceneStage} testID="motion-scene-stage">
        <LumiSceneTransition document={document} mode="contain" playing={playing} testID="animated-scene" />
      </View>
      <Text style={styles.subhead}>Živý procedurální svět s rezervovaným prostorem</Text>
      <View style={styles.proceduralStage} testID="motion-procedural-stage">
        <LumiAnimatedProceduralBackground
          scene={scene}
          seed="motion-world"
          density="quiet"
          animal={presentation.species}
          pose={presentation.pose}
          expression={presentation.expression}
          motion={presentation.motion}
          safeZones={[{ id: 'text-region', x: 10, y: 18, width: 210, height: 125, padding: 10 }]}
          playing={playing}
          celebrationKey={celebrationKey}
        />
        <Text style={styles.safeOverlay}>Bezpečná zóna pro UI</Text>
      </View>
      <Text style={styles.note}>
        Showcase přerušení: změň postavu nebo akci během gesta, zapni „Bez animací“, nebo pozastav
        obrazovku. Na fyzickém zařízení porovnej klid, animaci a vypnutý pohyb (frame/CPU/energie);
        JS benchmark sám nestačí.
      </Text>
    </ScrollView>
  );
}

/** Lab can also simulate app-level pause and a stricter preference than the OS. */
export function AnimationLab() {
  const [preferReduced, setPreferReduced] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  return (
    <LumiMotionProvider enabled={enabled} preferReducedMotion={preferReduced}>
      <View style={styles.lab}>
        <View style={styles.toolbar}>
          <Toggle
            label="Pohyb postav"
            id="motion-user-enabled"
            selected={enabled}
            onPress={() => setEnabled((v) => !v)}
          />
          <Toggle
            label="Bez animací"
            id="motion-reduce-override"
            selected={preferReduced}
            onPress={() => setPreferReduced((v) => !v)}
          />
          <Toggle
            label="Pozastavit"
            id="motion-pause"
            selected={paused}
            onPress={() => setPaused((v) => !v)}
          />
        </View>
        <Gallery paused={paused} />
      </View>
    </LumiMotionProvider>
  );
}

const styles = StyleSheet.create({
  lab: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 60 },
  toolbar: { paddingHorizontal: 18, paddingVertical: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overline: { color: '#73967F', fontWeight: '800', letterSpacing: 1.5, fontSize: 10 },
  title: { color: '#384C4A', fontSize: 24, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#586B64', fontSize: 12, lineHeight: 19, marginTop: 6 },
  subhead: { color: '#384C4A', marginTop: 18, marginBottom: 7, fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BECABF',
    paddingHorizontal: 11,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  selected: { backgroundColor: '#384C4A', borderColor: '#384C4A' },
  chipText: { color: '#384C4A', fontSize: 12, fontWeight: '700' },
  selectedText: { color: '#FFFFFF' },
  characterStage: {
    backgroundColor: '#EFF1E8',
    borderRadius: 24,
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: '#384C4A',
    padding: 13,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 44,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  sceneStage: { height: 290, overflow: 'hidden', borderRadius: 22, backgroundColor: '#F8F6EF', marginTop: 9 },
  proceduralStage: { height: 370, position: 'relative', overflow: 'hidden', borderRadius: 22, marginTop: 8 },
  safeOverlay: { position: 'absolute', top: 40, left: 20, color: '#384C4A', fontSize: 12, fontWeight: '700' },
  note: { color: '#657C70', fontSize: 11, lineHeight: 18, marginTop: 10 },
});
