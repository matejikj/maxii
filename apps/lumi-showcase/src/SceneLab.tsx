import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LumiProceduralBackground, LUMI_SCENES, SCENE_CATALOG, type LumiDensity, type LumiScene,
  type SafeZone } from '@lumi/forest-design';

const DENSITIES: readonly LumiDensity[] = ['quiet', 'regular', 'playful'];
/** Live showcase: UI rectangles are passed to the engine as exclusion zones, not painted over decorations. */
export function SceneLab() {
  const { width } = useWindowDimensions();
  const [scene, setScene] = useState<LumiScene>('home');
  const [density, setDensity] = useState<LumiDensity>('regular');
  const [seedNo, setSeedNo] = useState(1);
  const [previewWidth, setPreviewWidth] = useState(Math.min(840, width - 36));
  const zones = useMemo<readonly SafeZone[]>(() => [
    { id: 'heading', x: 18, y: 18, width: Math.min(310, previewWidth - 36), height: 78, padding: 8 },
    { id: 'metric-card', x: 18, y: 130, width: Math.min(308, Math.max(150, previewWidth * .67)), height: 143, padding: 10 },
    { id: 'primary-action', x: 18, y: 387, width: Math.min(128, previewWidth * .4), height: 49, padding: 8 },
  ], [previewWidth]);
  return (
    <ScrollView testID="procedural-scene-lab" contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PROCEDURAL SCENE ENGINE · v0.4</Text>
      <Text style={styles.heading}>Živý pohádkový svět</Text>
      <Text style={styles.subtitle}>Krajina se sestaví podle rozměru plochy. Dekorace a zvířátko se vyhýbají vyznačeným oblastem UI.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {LUMI_SCENES.map(id => <Pressable key={id} testID={`procedural-scene-${id}`}
          onPress={() => setScene(id)} style={[styles.chip, scene === id && styles.chipActive]}>
          <Text style={[styles.chipLabel, scene === id && styles.chipLabelActive]}>{id}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={styles.controls}>
        {DENSITIES.map(id => <Pressable key={id} testID={`procedural-density-${id}`}
          onPress={() => setDensity(id)} style={[styles.chip, density === id && styles.chipActive]}>
          <Text style={[styles.chipLabel, density === id && styles.chipLabelActive]}>{id}</Text>
        </Pressable>)}
        <Pressable testID="procedural-variation" onPress={() => setSeedNo(n => n + 1)} style={styles.variation}>
          <Text style={styles.variationText}>Nová varianta ↻</Text>
        </Pressable>
      </View>
      <View testID="procedural-preview" onLayout={e => setPreviewWidth(prev => Math.abs(prev - e.nativeEvent.layout.width) < .5
        ? prev : e.nativeEvent.layout.width)} style={styles.preview}>
        <LumiProceduralBackground scene={scene} density={density} seed={`showcase-${seedNo}`} safeZones={zones} />
        {/* These are real UI overlays occupying the same rectangles we reserve. */}
        <View style={[styles.titleOverlay, { width: zones[0]!.width }]}>
          <Text style={styles.overline}>TVŮJ PŘÍBĚH</Text>
          <Text style={styles.title}>Ahoj, maličký!</Text>
        </View>
        <View style={[styles.cardOverlay, { width: zones[1]!.width }]}>
          <Text style={styles.overline}>DNEŠNÍ PŘEHLED</Text>
          <Text style={styles.metric}>6 <Text style={styles.metricUnit}>měsíců</Text></Text>
          <Text style={styles.cardNote}>Každý den nové dobrodružství.</Text>
        </View>
        <View style={styles.actionOverlay}><Text style={styles.actionText}>Přidat záznam +</Text></View>
      </View>
      <Text style={styles.hint}>Pozadí se generuje lokálně. Scéna „{scene}“ používá {SCENE_CATALOG[scene].defaultAnimal}; obsazené oblasti se nikdy nepoužijí k umístění zvířátka ani dekorací. Pokud už není volné místo, objekty se vynechají.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '800', color: '#829C8A', letterSpacing: 1.5 },
  heading: { fontSize: 25, fontWeight: '800', color: '#384C4A' },
  subtitle: { fontSize: 13, lineHeight: 20, color: '#657672' },
  chips: { flexDirection: 'row', gap: 7, paddingVertical: 4 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  chip: { borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderColor: '#E3E7DF', borderWidth: 1 },
  chipActive: { backgroundColor: '#384C4A', borderColor: '#384C4A' },
  chipLabel: { fontWeight: '700', color: '#63756B', fontSize: 11, textTransform: 'capitalize' },
  chipLabelActive: { color: '#FFFFFF' },
  variation: { paddingVertical: 8, paddingHorizontal: 10, marginLeft: 'auto' },
  variationText: { color: '#6B8974', fontWeight: '800', fontSize: 11 },
  preview: { height: 456, width: '100%', maxWidth: 840, alignSelf: 'center', borderRadius: 26,
    borderWidth: 1, borderColor: '#E3E8DD', overflow: 'hidden', backgroundColor: '#FAF7F1' },
  titleOverlay: { position: 'absolute', left: 18, top: 18, height: 78, justifyContent: 'center' },
  overline: { fontSize: 9, letterSpacing: 1.5, color: '#91A99B', fontWeight: '800' },
  title: { fontSize: 23, fontWeight: '800', color: '#384C4A', marginTop: 7 },
  cardOverlay: { position: 'absolute', left: 18, top: 130, height: 143, padding: 17, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.91)' },
  metric: { fontSize: 36, fontWeight: '800', color: '#384C4A', marginTop: 7 },
  metricUnit: { fontSize: 14, fontWeight: '600' },
  cardNote: { color: '#667A71', fontSize: 10, marginTop: 4 },
  actionOverlay: { position: 'absolute', left: 18, top: 387, width: 128, height: 49, borderRadius: 18, backgroundColor: '#384C4A', justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  hint: { color: '#80938A', fontSize: 11, lineHeight: 17 },
});
