import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LumiCharacter, LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { LumiIconId } from '@lumi/forest-design/core';
import type { ActivityRevision } from '../../content';
import { DEVELOPMENT_AREA_LABELS_CS } from '../../content';
import type { DevelopmentArea } from '../../domain';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { ForestCardLandscape } from '../ui/ForestCardLandscape';
import { ForestIconBadge, forestTone, type ForestTone } from '../ui/ForestIconBadge';
import { activityAgeLabel, activityDurationLabel } from './developmentPresentation';

export type DevelopmentSection = 'inspiration' | 'library' | 'together' | 'milestones';
const SECTIONS: readonly { id: DevelopmentSection; label: string; icon: LumiIconId }[] = [
  { id: 'inspiration', label: 'Pro vás', icon: 'development' },
  { id: 'library', label: 'Aktivity', icon: 'experience' },
  { id: 'together', label: 'Společně', icon: 'care' },
  { id: 'milestones', label: 'Milníky', icon: 'growth' },
];
const AREA_TONES: Record<DevelopmentArea, ForestTone> = {
  relationship: 'care', speech: 'experience', movement: 'development', senses: 'today',
  attention: 'sleep', spaceQuantity: 'bottle', creationRhythm: 'food', autonomy: 'growth',
};

export function DevelopmentHero() {
  const { colors, motif } = useLumiTheme();
  const { preferences } = usePersonalPreferences();
  const { width, fontScale } = useWindowDimensions();
  const spacious = width < 350 || fontScale > 1.25;
  const [copyHeight, setCopyHeight] = useState(0);
  return (
    <View style={[styles.hero, { backgroundColor: colors.surfaceSubtle,
      minHeight: Math.max(190, (Math.min(width, 620) - 40) / 2, Math.ceil((copyHeight - 20) * 4 / 3)) }]}
      testID="development-hero">
      <ForestCardLandscape variant="day" opacity={spacious ? 0.14 : 1} />
      <View style={[styles.heroCopy, { maxWidth: spacious ? '100%' : '69%' }]}
        onLayout={(event) => setCopyHeight(event.nativeEvent.layout.height)}>
        <LumiText variant="overline" tone="muted" style={styles.eyebrow}>SPOLEČNĚ ROSTEME</LumiText>
        <LumiText accessibilityRole="header" style={styles.heroTitle}>Malé objevy.{ '\n' }Velká blízkost.</LumiText>
        <LumiText variant="caption" tone="muted" style={styles.heroHint}>Hravě. S láskou. Vlastním tempem.</LumiText>
      </View>
      {!spacious ? <View style={styles.character} pointerEvents="none" accessible={false}
        importantForAccessibility="no-hide-descendants">
        <LumiCharacter species={preferences.guideSpecies} appearanceStyle={preferences.appearanceStyle}
          expression="curious" width={motif === 'forest' ? 150 : 130} height={motif === 'forest' ? 164 : 148} />
      </View> : null}
    </View>
  );
}

export function DevelopmentTabs({ value, onChange }: {
  value: DevelopmentSection; onChange: (section: DevelopmentSection) => void;
}) {
  const { colors } = useLumiTheme();
  const { width, fontScale } = useWindowDimensions();
  return (
    <View style={[styles.tabs, { backgroundColor: colors.surfaceSubtle }]}
      accessibilityRole="tablist" accessibilityLabel="Sekce rozvoje">
      {SECTIONS.map((section) => <DevelopmentTab key={section.id} {...section}
        selected={value === section.id} onPress={() => onChange(section.id)}
        stacked={fontScale > 1.1 || width < 480} />)}
    </View>
  );
}

function DevelopmentTab({ id, label, icon, selected, stacked, onPress }: {
  id: DevelopmentSection; label: string; icon: LumiIconId; selected: boolean; stacked: boolean; onPress: () => void;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }}
    aria-selected={selected}
    accessibilityLabel={label} testID={`development-tab-${id}`}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.tab, { flexDirection: stacked ? 'column' : 'row',
      backgroundColor: selected ? colors.primary : 'transparent', opacity: pressed ? 0.8 : 1,
      borderColor: focused ? colors.focus : 'transparent' }]}>
    <LumiIcon name={icon} size={19} color={selected ? colors.onPrimary : colors.textMuted} />
    <LumiText variant="label" style={[styles.tabLabel, { color: selected ? colors.onPrimary : colors.textMuted }]}>{label}</LumiText>
  </Pressable>;
}

export function DevelopmentHeading({ title, subtitle, icon = 'development' }: {
  title: string; subtitle?: string; icon?: ForestTone;
}) {
  return <View style={styles.heading}>
    <ForestIconBadge name={icon} size={42} />
    <View style={styles.flexCopy}>
      <LumiText variant="h2" accessibilityRole="header">{title}</LumiText>
      {subtitle ? <LumiText variant="caption" tone="muted">{subtitle}</LumiText> : null}
    </View>
  </View>;
}

export function ActivityMetadata({ revision }: { revision: ActivityRevision }) {
  const { colors } = useLumiTheme();
  return <View style={styles.metadata}>
    <View style={styles.metaItem}>
      <LumiIcon name="history" size={14} color={colors.textMuted} />
      <LumiText variant="caption" tone="muted">{activityDurationLabel(revision)}</LumiText>
    </View>
    <LumiText variant="caption" tone="muted">{activityAgeLabel(revision)}</LumiText>
    {revision.materials.length === 0 ? <LumiText variant="caption" tone="muted">Bez pomůcek</LumiText> : null}
  </View>;
}

export function DevelopmentActivityCard({ revision, featured = false, reason, tried = false, onPress, testID }: {
  revision: ActivityRevision; featured?: boolean; reason?: string; tried?: boolean; onPress: () => void; testID?: string;
}) {
  const { colors, mode, motif } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  const tone = forestTone(mode, AREA_TONES[revision.primaryArea], motif);
  return <Pressable onPress={onPress} accessibilityRole="button"
    accessibilityLabel={`${revision.title}. ${DEVELOPMENT_AREA_LABELS_CS[revision.primaryArea]}. ${activityDurationLabel(revision)}. ${activityAgeLabel(revision)}${tried ? '. Dnes vyzkoušeno' : ''}`}
    accessibilityHint="Otevřít postup a podmínky aktivity"
    testID={testID} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.activity, featured ? styles.featured : null,
      { backgroundColor: featured ? tone.background : colors.surface,
        borderColor: focused ? colors.focus : featured ? tone.background : colors.border,
        opacity: pressed ? 0.8 : 1 }]}>
    <View style={styles.activityTop}>
      <ForestIconBadge name={AREA_TONES[revision.primaryArea]} size={featured ? 48 : 40} />
      <LumiText variant="caption" style={[styles.area, { color: tone.ink }]}>
        {DEVELOPMENT_AREA_LABELS_CS[revision.primaryArea]}
      </LumiText>
      {!featured ? <LumiIcon name="arrow-right" size={19} color={colors.primary} /> : null}
    </View>
    <LumiText variant="bodyStrong" style={featured ? styles.featuredTitle : undefined}>{revision.title}</LumiText>
    <ActivityMetadata revision={revision} />
    {reason ? <LumiText variant="caption" tone="muted">{reason}</LumiText> : null}
    {tried ? <LumiText variant="caption" tone="success">Dnes už jste vyzkoušeli</LumiText> : null}
    {featured ? <View style={[styles.openActivity, { backgroundColor: colors.primary }]}>
      <LumiText variant="label" style={{ color: colors.onPrimary, flex: 1 }}>Objevit aktivitu</LumiText>
      <LumiIcon name="arrow-right" size={20} color={colors.onPrimary} />
    </View> : null}
  </Pressable>;
}

export function DevelopmentEmpty({ title, description, icon = 'development', children }: {
  title: string; description: string; icon?: ForestTone; children?: React.ReactNode;
}) {
  const { colors } = useLumiTheme();
  return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <ForestIconBadge name={icon} size={50} />
    <LumiText variant="bodyStrong">{title}</LumiText>
    <LumiText variant="caption" tone="muted">{description}</LumiText>
    {children}
  </View>;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, overflow: 'hidden' },
  heroCopy: { padding: 20, gap: 10 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.6 },
  heroTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  heroHint: { fontSize: 12, lineHeight: 18 },
  character: { position: 'absolute', bottom: -8, right: -5 },
  tabs: { flexDirection: 'row', padding: 5, borderRadius: 22, gap: 4 },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: 48,
    paddingHorizontal: 4, paddingVertical: 10, borderRadius: 18, gap: 6, borderWidth: 2 },
  tabLabel: { fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flexCopy: { flex: 1, gap: 3 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  metaItem: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  activity: { padding: 17, borderRadius: 24, borderWidth: 2, gap: 10, minHeight: 48 },
  featured: { padding: 20, gap: 14, borderRadius: 27 },
  activityTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  area: { flex: 1, fontWeight: '600' },
  featuredTitle: { fontSize: 23, lineHeight: 30, letterSpacing: -0.4 },
  openActivity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: 14, minHeight: 50, borderRadius: 17 },
  empty: { padding: 22, borderRadius: 25, borderWidth: 1, gap: 12 },
});
