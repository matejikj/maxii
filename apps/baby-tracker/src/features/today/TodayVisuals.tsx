import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LumiCard, LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { GuideCompanion } from '../shell/GuideCompanion';
import { ForestCardLandscape } from '../ui/ForestCardLandscape';
import { ForestIconBadge, forestTone, type ForestTone } from '../ui/ForestIconBadge';
import { PRODUCT_COPY } from '../ui/productCopy';
import type { LastCarePresentation } from './carePresentation';
import type { QuickActionId } from './quickActions';

export function TodayHero({ childName, calendarDate, celebrationKey, visible }: {
  childName: string; calendarDate: string; celebrationKey: number; visible: boolean;
}) {
  const { colors, motif } = useLumiTheme();
  const { preferences } = usePersonalPreferences();
  const { width, fontScale } = useWindowDimensions();
  const spacious = width < 350 || fontScale > 1.25;
  const [copyHeight, setCopyHeight] = useState(0);
  const heroHeight = Math.max(188, (Math.min(width, 620) - 40) / 2, Math.ceil((copyHeight - 22) * 4 / 3));
  const characterWidth = motif === 'forest' ? 160 : 132;
  const date = calendarDate
    ? new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(`${calendarDate}T12:00:00Z`))
    : 'Místní deník bez účtu';
  return (
    <View style={[styles.hero, { minHeight: heroHeight, backgroundColor: colors.surfaceSubtle }]} testID="today-forest-hero">
      <ForestCardLandscape variant="day" opacity={spacious ? 0.14 : 1} />
      <View onLayout={(event) => setCopyHeight(event.nativeEvent.layout.height)}
        style={[styles.heroCopy, { maxWidth: spacious ? '100%' : '68%' }]}>
        <View style={styles.dateLine}>
          <LumiIcon name="today" color={colors.textMuted} size={15} />
          <LumiText testID="today-date" variant="caption" tone="muted" style={styles.dateText}>{date}</LumiText>
        </View>
        <LumiText variant="h1" accessibilityRole="header" style={styles.heroTitle}>Dnes s {childName}</LumiText>
        <LumiText variant="caption" tone="muted" style={styles.heroDescription}>
          Malé chvíle.{ '\n' }Váš společný příběh.
        </LumiText>
      </View>
      {!spacious ? (
        <View style={styles.heroCharacter} pointerEvents="none" accessible={false}
          importantForAccessibility="no-hide-descendants">
          <GuideCompanion species={preferences.guideSpecies} appearanceStyle={preferences.appearanceStyle}
            semantic="gentleJoy" visible={visible} celebrationKey={celebrationKey}
            width={characterWidth} height={motif === 'forest' ? 174 : 150} testID="today-guide" />
        </View>
      ) : null}
    </View>
  );
}

const QUICK_TONES: Record<QuickActionId, ForestTone> = {
  feeding: 'nursing', sleep: 'sleep', diaper: 'diaper', experience: 'experience',
};
const QUICK_HINTS: Record<QuickActionId, string> = {
  feeding: 'Kojení, lahvička i jídlo', sleep: 'Spustit měření odpočinku',
  diaper: 'Rychle zapsat přebalení', experience: 'Chvíle, kterou si uchovat',
};

export function TodayQuickAction({ id, title, running, pending, editing, onPress }: {
  id: QuickActionId; title: string; running: boolean; pending: boolean;
  editing: boolean; onPress: () => void;
}) {
  const { colors, mode, motif } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  const tone = forestTone(mode, QUICK_TONES[id], motif);
  const hint = editing ? 'Posunout akci dopředu'
    : running ? (id === 'sleep' ? 'Přejít na běžící měření' : 'Otevřít krmení a měření') : QUICK_HINTS[id];
  return (
    <Pressable onPress={onPress} disabled={pending} testID={`quick-${id}`}
      accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint}
      accessibilityState={{ disabled: pending, busy: pending }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => [styles.quickAction, { backgroundColor: tone.background,
        opacity: pressed || pending ? 0.75 : 1, borderColor: focused ? colors.focus : 'transparent' }]}>
      <View style={styles.quickTop}>
        <View style={[styles.quickIcon, { backgroundColor: colors.surface }]}>
          <LumiIcon name={QUICK_TONES[id]} color={tone.ink} accentColor={tone.accent} size={27} />
        </View>
        {pending ? <ActivityIndicator color={tone.ink} size="small" /> : (
          <LumiIcon name={editing ? 'arrow-right' : running ? 'history' : 'plus'} color={tone.ink} size={17} />
        )}
      </View>
      <View style={{ gap: 3 }}>
        <LumiText variant="bodyStrong" style={{ color: tone.ink }}>{title}</LumiText>
        <LumiText variant="caption" tone="muted" style={styles.quickHint}>{hint}</LumiText>
      </View>
    </Pressable>
  );
}

export function TodayIdleMeasurement({ message }: { message: string | null }) {
  const { colors } = useLumiTheme();
  return (
    <View style={[styles.idle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ForestIconBadge name="sleep" size={34} />
      <View style={{ flex: 1, gap: 3 }}>
        <LumiText variant="caption" tone="muted">{PRODUCT_COPY.measurement.none}</LumiText>
        {message ? <LumiText variant="caption" accessibilityLiveRegion="polite">{message}</LumiText> : null}
      </View>
    </View>
  );
}

const LAST_ICONS: Record<LastCarePresentation['kind'], ForestTone> = {
  sleep: 'sleep', nursing: 'nursing', bottle: 'bottle', food: 'food', diaper: 'diaper',
  growth: 'growth', note: 'experience', experience: 'experience', milestone: 'development',
};

export function TodayLastCareCard({ lastCare, onOpenEvent }: {
  lastCare: LastCarePresentation | null; onOpenEvent?: (id: string) => void;
}) {
  const { colors } = useLumiTheme();
  return (
    <LumiCard padding="none" style={styles.lastCare}>
      <View style={styles.lastHeading}>
        <LumiText variant="h2" accessibilityRole="header">{PRODUCT_COPY.today.lastCare}</LumiText>
        <LumiIcon name="history" color={colors.textMuted} size={22} />
      </View>
      {lastCare ? (
        <Pressable disabled={!onOpenEvent} accessibilityRole={onOpenEvent ? 'button' : undefined}
          accessibilityLabel={`${lastCare.title}, ${lastCare.detail}`}
          onPress={() => onOpenEvent?.(lastCare.eventId)} testID="today-last-care"
          style={({ pressed }) => [styles.lastRecord, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <ForestIconBadge name={LAST_ICONS[lastCare.kind]} size={46} />
          <View style={{ flex: 1, gap: 4 }}>
            <LumiText variant="bodyStrong">{lastCare.title}</LumiText>
            <LumiText variant="caption" tone="muted">{lastCare.detail}</LumiText>
          </View>
          {onOpenEvent ? <LumiIcon name="arrow-right" color={colors.primary} size={20} /> : null}
        </Pressable>
      ) : (
        <View style={styles.lastEmpty}>
          <ForestIconBadge name="care" size={42} />
          <LumiText tone="muted" variant="caption" style={{ flex: 1 }}>{PRODUCT_COPY.empty.noLastCare}</LumiText>
        </View>
      )}
    </LumiCard>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 188, borderRadius: 28, overflow: 'hidden', backgroundColor: '#E4ECD8' },
  heroCopy: { padding: 22, gap: 11 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { flex: 1, fontSize: 11, lineHeight: 17 },
  heroTitle: { fontSize: 29, lineHeight: 35, letterSpacing: -0.8, fontWeight: '700' },
  heroDescription: { fontSize: 12, lineHeight: 18 },
  heroCharacter: { position: 'absolute', right: -8, bottom: -9 },
  quickAction: { flex: 1, padding: 15, minHeight: 141, borderRadius: 23, gap: 13, borderWidth: 2 },
  quickTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  quickIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quickHint: { fontSize: 11, lineHeight: 17 },
  idle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderRadius: 20 },
  lastCare: { borderRadius: 26 },
  lastHeading: { padding: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lastRecord: { marginHorizontal: 20, paddingTop: 16, paddingBottom: 20, borderTopWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 82 },
  lastEmpty: { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
