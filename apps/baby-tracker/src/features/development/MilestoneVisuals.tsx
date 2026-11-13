import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { LumiBaby, LumiCharacter, LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { MilestoneCategory, MilestoneDefinition } from '../../content/milestones';
import { MILESTONE_CATEGORIES } from '../../content/milestones';
import type { MilestoneCareEvent, TimeZoneId } from '../../domain';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { ForestCardLandscape } from '../ui/ForestCardLandscape';
import { forestTone } from '../ui/ForestIconBadge';
import { milestoneMemoryDate } from './milestonePresentation';

/** Soft botanical seals. Their color follows the environment, never a child's age. */
export function MilestoneEmblem({ category, size = 56 }: { category: MilestoneCategory; size?: number }) {
  const { mode, motif } = useLumiTheme();
  const tone = forestTone(mode, 'development', motif);
  return <Svg width={size} height={size} viewBox="0 0 80 80" accessible={false} pointerEvents="none">
    <Path d="M40 3C52 0 57 9 65 14S80 28 76 40 77 59 65 65 51 80 39 76 20 77 14 65 0 51 4 39 3 21 15 14 29 1 40 3Z"
      fill={tone.background} />
    <Circle cx={40} cy={40} r={30} fill="none" stroke={tone.accent} strokeWidth={.8} opacity={.5} />
    <G stroke={tone.ink} strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {category === 'communication' ? <><Path d="M23 28Q23 23 29 23H51Q57 23 57 29V43Q57 49 51 49H38L29 57V49Q23 49 23 43Z" />
        <Path d="M31 33H48M31 40H43" /><Path d="M55 55Q61 51 63 44Q54 45 55 55Z" fill={tone.accent} stroke="none" /></> : null}
      {category === 'movement' ? <><Ellipse cx={32} cy={45} rx={6} ry={10} transform="rotate(-18 32 45)" />
        <Ellipse cx={49} cy={36} rx={6} ry={10} transform="rotate(18 49 36)" />
        <Path d="M27 29V27M34 29V26M46 20V18M53 22V19" /><Path d="M46 57Q53 55 55 50" stroke={tone.accent} /></> : null}
      {category === 'connection' ? <><Path d="M40 56C35 51 22 43 23 33C24 22 36 23 40 30C44 23 56 22 57 33C58 43 45 51 40 56Z" />
        <Path d="M40 55V36M40 48Q29 47 29 38Q38 38 40 48ZM40 44Q50 43 51 35Q42 35 40 44Z" stroke={tone.accent} /></> : null}
      {category === 'discovery' ? <><Path d="M40 58V41M40 53Q27 54 26 45Q36 44 40 53M40 49Q52 49 54 40Q44 39 40 49" />
        {[0,72,144,216,288].map((angle) => <Ellipse key={angle} cx={40} cy={26} rx={5} ry={8}
          transform={`rotate(${angle} 40 34)`} fill={tone.accent} stroke="none" />)}
        <Circle cx={40} cy={34} r={5} fill={tone.ink} stroke="none" /></> : null}
      {category === 'independence' ? <><Path d="M25 59Q40 54 55 59M40 57V35M40 47Q24 45 24 30Q39 29 40 47ZM40 40Q55 40 57 23Q42 22 40 40Z" />
        <Path d="M28 35L36 43M52 28L44 36" stroke={tone.accent} /></> : null}
    </G>
    <Circle cx={62} cy={58} r={2} fill={tone.accent} />
  </Svg>;
}

export function MilestoneHero() {
  const { colors, mode, motif } = useLumiTheme();
  const { preferences, babyAvatar } = usePersonalPreferences();
  const tone = forestTone(mode, 'development', motif);
  return <View style={[styles.hero, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]} testID="milestones-hero">
    <ForestCardLandscape variant="day" opacity={mode === 'dark' ? .2 : .3} />
    <View style={styles.heroCopy}>
      <LumiText variant="overline" tone="muted" style={styles.eyebrow}>KNIHA MALÝCH POPRVÉ</LumiText>
      <LumiText accessibilityRole="header" style={styles.heroTitle}>Malé okamžiky.{ '\n' }Velké vzpomínky.</LumiText>
      <LumiText variant="caption" tone="muted">Každý objev má svůj příběh. A každé dítě své tempo.</LumiText>
    </View>
    <View style={styles.meadow} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height={176} viewBox="0 0 400 176" preserveAspectRatio="xMidYMid meet">
        <Ellipse cx={204} cy={148} rx={175} ry={23} fill={tone.background} />
        <Path d="M52 153C103 111 147 162 204 132S300 144 357 110" fill="none" stroke={tone.accent} strokeWidth={2} strokeDasharray="2 8" opacity={.55} />
        {[{ x: 42, y: 116 }, { x: 344, y: 94 }, { x: 326, y: 144 }].map(({ x,y }) => <G key={x} transform={`translate(${x} ${y})`}>
          <Path d="M0 23V0M0 16Q-12 15 -12 6Q-2 5 0 16M0 9Q10 9 11 0Q2 0 0 9" fill="none" stroke={tone.ink} strokeWidth={1.5} opacity={.7} />
          {[0,72,144,216,288].map((angle) => <Ellipse key={angle} cx={0} cy={-5} rx={3} ry={5} transform={`rotate(${angle})`} fill={tone.accent} />)}
          <Circle r={2.5} fill={tone.ink} />
        </G>)}
        <Path d="M201 31Q211 16 219 27Q222 39 204 48Q188 39 189 30Q191 21 201 31Z" fill={tone.accent} opacity={.8} />
        <Circle cx={240} cy={20} r={2.5} fill={tone.accent} /><Circle cx={174} cy={19} r={1.5} fill={tone.accent} />
      </Svg>
      <View style={styles.guide}><LumiCharacter species={preferences.guideSpecies} appearanceStyle={preferences.appearanceStyle}
        expression="happy" width={130} height={150} /></View>
      <View style={styles.baby}><LumiBaby variant={babyAvatar} pose="sitting" width={109} height={133} /></View>
    </View>
  </View>;
}

export function MilestoneAtlasCard({ item, memory, onPress }: {
  item: MilestoneDefinition; memory: MilestoneCareEvent | undefined; onPress: () => void;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint="Otevřít popis, orientační období a nápady na podporu"
    accessibilityLabel={`${item.title}. ${item.age.label}.${memory ? ' Máte uloženou vzpomínku.' : ''}`}
    testID={`milestone-${item.id}`} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: focused ? colors.focus : colors.border, opacity: pressed ? .82 : 1 }]}>
    <View style={styles.row}>
      <MilestoneEmblem category={item.category} />
      <View style={styles.copy}>
        <LumiText variant="caption" tone="muted">{MILESTONE_CATEGORIES.find((category) => category.id === item.category)?.label}</LumiText>
        <LumiText variant="bodyStrong">{item.title}</LumiText>
      </View>
      <LumiIcon name="arrow-right" size={19} color={colors.primary} />
    </View>
    <View style={[styles.age, { backgroundColor: colors.surfaceSubtle }]}>
      <LumiIcon name="history" size={15} color={colors.textMuted} />
      <LumiText variant="caption" tone="muted" style={{ flex: 1 }}>{item.age.label}</LumiText>
    </View>
    {memory ? <LumiText variant="caption" tone="muted">Vzpomínka už má své místo ve vašem deníku</LumiText> : null}
  </Pressable>;
}

export function MilestoneMemoryCard({ event, category, zone, onPress }: {
  event: MilestoneCareEvent; category: MilestoneCategory; zone: TimeZoneId; onPress: () => void;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable onPress={onPress} accessibilityRole="button" testID={`milestone-memory-${event.eventId}`}
    accessibilityLabel={`${event.body}. ${milestoneMemoryDate(event, zone)}. Otevřít vzpomínku.`}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: focused ? colors.focus : colors.border, opacity: pressed ? .82 : 1 }]}>
    <View style={styles.row}><MilestoneEmblem category={category} size={48} />
      <View style={styles.copy}><LumiText variant="caption" tone="muted">{milestoneMemoryDate(event, zone)}</LumiText>
        <LumiText variant="bodyStrong">{event.body}</LumiText></View>
      <LumiIcon name="arrow-right" size={19} color={colors.primary} />
    </View>
    {event.note ? <LumiText variant="caption" tone="muted" numberOfLines={3}>{event.note}</LumiText> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  hero: { borderRadius: 30, overflow: 'hidden', borderWidth: 1 },
  heroCopy: { padding: 22, paddingBottom: 0, gap: 12 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.7 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -.9 },
  meadow: { height: 176, overflow: 'hidden', width: '100%', maxWidth: 450, alignSelf: 'center' },
  guide: { position: 'absolute', bottom: 6, left: '15%' },
  baby: { position: 'absolute', bottom: 7, right: '16%' },
  card: { padding: 17, borderRadius: 25, borderWidth: 2, gap: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, gap: 4 },
  age: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 11 },
});
