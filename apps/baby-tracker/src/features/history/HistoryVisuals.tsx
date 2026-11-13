import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LumiCharacter, LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { LumiIconId } from '@lumi/forest-design/core';
import type { CareEvent, TimeZoneId } from '../../domain';
import type { HistorySection } from '../../app/navigation/historyTabState';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { ForestCardLandscape } from '../ui/ForestCardLandscape';
import { ForestIconBadge, type ForestTone } from '../ui/ForestIconBadge';
import { historyDateLabel, historyDayLabel, presentHistoryEvent } from './historyPresentation';

export const HISTORY_TONES: Record<CareEvent['type'] | 'observation', ForestTone> = {
  sleep: 'sleep',
  nursing: 'nursing',
  bottle: 'bottle',
  food: 'food',
  diaper: 'diaper',
  growth: 'growth',
  note: 'experience',
  experience: 'experience',
  milestone: 'development',
  observation: 'development',
};

export function HistoryHero() {
  const { colors, mode, motif } = useLumiTheme();
  const { preferences } = usePersonalPreferences();
  const { width, fontScale } = useWindowDimensions();
  const spacious = fontScale > 1.25 || width < 350;
  const [copyHeight, setCopyHeight] = useState(0);
  return (
    <View
      style={[
        styles.hero,
        {
          backgroundColor: mode === 'dark' ? colors.surfaceSubtle : colors.primary,
          minHeight: Math.max(126, Math.ceil(((copyHeight - 18) * 4) / 3)),
        },
      ]}
      testID="history-hero"
    >
      <ForestCardLandscape variant="dusk" opacity={spacious ? 0.14 : 1} />
      <View
        style={[styles.heroCopy, { maxWidth: spacious ? '100%' : '70%' }]}
        onLayout={(event) => setCopyHeight(event.nativeEvent.layout.height)}
      >
        <LumiText variant="overline" style={styles.heroEyebrow}>
          VÁŠ SPOLEČNÝ PŘÍBĚH
        </LumiText>
        <LumiText style={styles.heroTitle}>Chvíle, které{'\n'}zůstávají.</LumiText>
      </View>
      {!spacious ? (
        <View
          style={styles.character}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <LumiCharacter
            species={preferences.guideSpecies}
            appearanceStyle={preferences.appearanceStyle}
            expression="happy"
            width={motif === 'forest' ? 132 : 118}
            height={motif === 'forest' ? 144 : 132}
          />
        </View>
      ) : null}
    </View>
  );
}

export function HistorySectionTabs({
  value,
  draftsCount,
  trashCount,
  onChange,
}: {
  value: HistorySection;
  draftsCount: number;
  trashCount: number;
  onChange: (value: HistorySection) => void;
}) {
  const { colors } = useLumiTheme();
  const { fontScale, width } = useWindowDimensions();
  const sections: {
    id: HistorySection;
    label: string;
    accessibilityLabel: string;
    icon: LumiIconId;
  }[] = [
    { id: 'timeline', label: 'Záznamy', accessibilityLabel: 'Časová osa záznamů', icon: 'history' },
    {
      id: 'drafts',
      label: 'Koncepty',
      accessibilityLabel: `Koncepty, ${draftsCount}`,
      icon: 'experience',
    },
    {
      id: 'trash',
      label: 'Koš',
      accessibilityLabel: `Nedávno smazané, ${trashCount}`,
      icon: 'care',
    },
  ];
  return (
    <View
      style={[styles.tabs, { backgroundColor: colors.surfaceSubtle }]}
      accessibilityRole="tablist"
      accessibilityLabel="Sekce historie"
    >
      {sections.map((section) => (
        <HistoryTab
          key={section.id}
          {...section}
          selected={section.id === value}
          stacked={fontScale > 1.25 || width < 350}
          onPress={() => onChange(section.id)}
        />
      ))}
    </View>
  );
}

function HistoryTab({
  id,
  label,
  accessibilityLabel,
  icon,
  selected,
  stacked,
  onPress,
}: {
  id: HistorySection;
  label: string;
  accessibilityLabel: string;
  icon: LumiIconId;
  selected: boolean;
  stacked: boolean;
  onPress: () => void;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      testID={`history-tab-${id}`}
      style={({ pressed }) => [
        styles.tab,
        {
          flexDirection: stacked ? 'column' : 'row',
          backgroundColor: selected ? colors.primary : 'transparent',
          opacity: pressed ? 0.8 : 1,
          borderColor: focused ? colors.focus : 'transparent',
        },
      ]}
    >
      <LumiIcon name={icon} size={19} color={selected ? colors.onPrimary : colors.textMuted} />
      <LumiText
        variant="label"
        style={[styles.tabLabel, { color: selected ? colors.onPrimary : colors.textMuted }]}
      >
        {label}
      </LumiText>
    </Pressable>
  );
}

export function HistoryDayArrow({
  previous = false,
  disabled,
  onPress,
}: {
  previous?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={previous ? 'Předchozí den' : 'Následující den'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      testID={previous ? 'history-previous-day' : 'history-next-day'}
      style={({ pressed }) => [
        styles.dayArrow,
        {
          backgroundColor: colors.surfaceSubtle,
          borderColor: focused ? colors.focus : 'transparent',
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={previous ? { transform: [{ rotate: '180deg' }] } : undefined}>
        <LumiIcon name="arrow-right" size={20} color={colors.primary} />
      </View>
    </Pressable>
  );
}

export function HistoryPeriodButton({
  label,
  selected,
  onPress,
  testID,
  wide = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  wide?: boolean;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.periodButton,
        {
          flex: wide ? 1.5 : 1,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: focused ? colors.focus : selected ? colors.primary : colors.controlBorder,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <LumiText
        variant="label"
        style={{
          fontSize: 12,
          lineHeight: 18,
          textAlign: 'center',
          color: selected ? colors.onPrimary : colors.text,
        }}
      >
        {label}
      </LumiText>
    </Pressable>
  );
}

export function HistoryDayHeading({ day, todayIso }: { day: string; todayIso: string }) {
  const { colors } = useLumiTheme();
  return (
    <View style={styles.dayHeading}>
      <View style={[styles.dayDot, { backgroundColor: colors.secondary }]}>
        <LumiIcon name="today" size={19} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <LumiText variant="h2" accessibilityRole="header" style={styles.dayTitle}>
          {historyDayLabel(day, todayIso)}
        </LumiText>
        <LumiText variant="caption" tone="muted">
          {historyDateLabel(day)}
        </LumiText>
      </View>
    </View>
  );
}

export function HistoryEventRow({
  event,
  zone,
  onPress,
  last,
}: {
  event: CareEvent;
  zone: TimeZoneId;
  onPress?: () => void;
  last: boolean;
}) {
  const { colors } = useLumiTheme();
  const { fontScale, width } = useWindowDimensions();
  const stacked = fontScale > 1.25 || width < 350;
  const [focused, setFocused] = useState(false);
  const item = presentHistoryEvent(event, zone);
  return (
    <View style={[styles.timelineRow, { flexDirection: stacked ? 'column' : 'row' }]}>
      <View style={[styles.timeRail, stacked ? styles.timeStacked : null]}>
        <LumiText variant="caption" tone="muted" style={styles.time}>
          {item.clock}
        </LumiText>
        {!last && !stacked ? (
          <View style={[styles.rail, { backgroundColor: colors.border }]} />
        ) : null}
      </View>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${item.title}, ${item.clock}${item.detail ? `, ${item.detail}` : ''}${item.note ? `, ${item.note}` : ''}`}
        accessibilityHint={onPress ? 'Otevřít detail záznamu' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        testID={`history-event-${event.eventId}`}
        style={({ pressed }) => [
          styles.eventCard,
          stacked ? styles.eventStacked : null,
          {
            backgroundColor: colors.surface,
            borderColor: focused ? colors.focus : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={styles.eventTop}>
          <ForestIconBadge name={HISTORY_TONES[event.type]} size={38} />
          <LumiText variant="bodyStrong" style={{ flex: 1 }}>
            {item.title}
          </LumiText>
          {onPress ? <LumiIcon name="arrow-right" size={17} color={colors.primary} /> : null}
        </View>
        {item.detail ? (
          <LumiText variant="caption" tone="muted">
            {item.detail}
          </LumiText>
        ) : null}
        {item.note ? (
          <LumiText variant="caption" tone="muted" numberOfLines={2}>
            {item.note}
          </LumiText>
        ) : null}
      </Pressable>
    </View>
  );
}

export function HistoryEmpty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const { colors } = useLumiTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ForestIconBadge name="history" size={48} />
      <LumiText variant="bodyStrong">{title}</LumiText>
      <LumiText variant="caption" tone="muted">
        {description}
      </LumiText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 27, overflow: 'hidden' },
  heroCopy: { padding: 18, gap: 8 },
  heroEyebrow: { color: '#E3EAD8', fontSize: 9, lineHeight: 15, letterSpacing: 1.5 },
  heroTitle: {
    color: '#FFF9EB',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  character: { position: 'absolute', bottom: -8, right: -2 },
  tabs: { flexDirection: 'row', gap: 4, padding: 5, borderRadius: 22 },
  tab: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 10,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: { fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: 'center' },
  dayArrow: {
    width: 48,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodButton: {
    minWidth: 0,
    minHeight: 48,
    padding: 8,
    borderWidth: 1.5,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 4 },
  dayDot: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTitle: { textTransform: 'capitalize', fontSize: 20, lineHeight: 27 },
  timelineRow: { gap: 10, alignItems: 'stretch' },
  timeRail: { width: 48, paddingTop: 16, alignItems: 'center', gap: 10 },
  timeStacked: { width: 'auto', paddingTop: 2, alignItems: 'flex-start' },
  time: { fontSize: 12, lineHeight: 19, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rail: { flex: 1, width: 1, minHeight: 8, marginBottom: -12 },
  eventCard: { flex: 1, padding: 14, gap: 9, borderWidth: 2, borderRadius: 22, minHeight: 56 },
  eventStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  eventTop: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  empty: { padding: 22, gap: 12, borderWidth: 1, borderRadius: 25 },
});
