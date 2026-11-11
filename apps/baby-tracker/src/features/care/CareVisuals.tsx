import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LumiCharacter, LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { ForestIconBadge as CareIconBadge, type ForestTone } from '../ui/ForestIconBadge';
import { ForestCardLandscape } from '../ui/ForestCardLandscape';

export { CareIconBadge };

type CareTone = ForestTone;

/** A small forest vignette; actual care data stays in the read-model cards. */
export function CareHero() {
  const { motif, mode, colors } = useLumiTheme();
  const { preferences } = usePersonalPreferences();
  const { fontScale, width } = useWindowDimensions();
  const spacious = fontScale > 1.25 || width < 350;
  const [copyHeight, setCopyHeight] = useState(0);
  const heroHeight = Math.max(184, (Math.min(width, 620) - 40) / 2, Math.ceil((copyHeight - 22) * 4 / 3));
  return (
    <View style={[styles.hero, { minHeight: heroHeight,
      backgroundColor: mode === 'dark' ? colors.surfaceSubtle : colors.primary }]} testID="care-forest-hero">
      <ForestCardLandscape opacity={spacious ? 0.14 : 1} />
      <View onLayout={(event) => setCopyHeight(event.nativeEvent.layout.height)}
        style={[styles.heroCopy, { maxWidth: spacious ? '100%' : '65%' }]}>
        <LumiText variant="overline" style={styles.heroEyebrow}>VÁŠ MALÝ SVĚT</LumiText>
        <LumiText style={styles.heroTitle}>Každý den{ '\n' }po svém.</LumiText>
        <LumiText variant="caption" style={styles.heroDescription}>
          Spánek, krmení a růst.{ '\n' }V klidu, na jednom místě.
        </LumiText>
      </View>
      {!spacious ? (
        <View style={styles.heroCharacter} pointerEvents="none" accessible={false}
          importantForAccessibility="no-hide-descendants">
          <LumiCharacter species={preferences.guideSpecies} appearanceStyle={preferences.appearanceStyle}
            expression="happy" width={motif === 'forest' ? 158 : 132} height={motif === 'forest' ? 174 : 150} />
        </View>
      ) : null}
    </View>
  );
}

export function CareSectionHeading({ title, subtitle, icon }: {
  title: string; subtitle?: string; icon: CareTone;
}) {
  return (
    <View style={styles.sectionHeading}>
      <CareIconBadge name={icon} size={42} />
      <View style={{ flex: 1, gap: 2 }}>
        <LumiText variant="h2" accessibilityRole="header">{title}</LumiText>
        {subtitle ? <LumiText variant="caption" tone="muted">{subtitle}</LumiText> : null}
      </View>
    </View>
  );
}

export function CareRecordAction({ title, subtitle, icon, onPress, testID }: {
  title: string; subtitle: string; icon: 'sleep' | 'nursing'; onPress: () => void; testID: string;
}) {
  const { colors } = useLumiTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress} testID={testID}
      style={({ pressed }) => [styles.recordAction, { backgroundColor: pressed ? colors.secondary : colors.surface,
        borderColor: colors.border }]}>
      <CareIconBadge name={icon} size={46} />
      <View style={{ flex: 1, gap: 3 }}>
        <LumiText variant="bodyStrong">{title}</LumiText>
        <LumiText variant="caption" tone="muted">{subtitle}</LumiText>
      </View>
      <LumiIcon name="plus" color={colors.primary} size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 184, borderRadius: 28, overflow: 'hidden', backgroundColor: '#2A493B' },
  heroCopy: { padding: 22, gap: 9 },
  heroEyebrow: { color: '#D4DDBD', fontSize: 10, lineHeight: 16, letterSpacing: 1.8 },
  heroTitle: { color: '#FFF9EB', fontSize: 29, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  heroDescription: { color: '#E3EAD8', fontSize: 12, lineHeight: 18 },
  heroCharacter: { position: 'absolute', right: -4, bottom: -9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordAction: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 21,
    padding: 15, minHeight: 86, borderWidth: 1 },
});
