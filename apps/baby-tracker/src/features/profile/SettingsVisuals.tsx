import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { LumiCard, LumiCharacter, LumiIcon, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import type { LumiIconId } from '@lumi/forest-design/core';
import { LUMI_MOTIFS } from '@lumi/forest-design/core';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { ForestCardLandscape } from '../ui/ForestCardLandscape';
import { ForestIconBadge, type ForestTone } from '../ui/ForestIconBadge';
import { GUIDE_NAMES } from './settingsPresentation';

export function SettingsHero() {
  const { colors, motif } = useLumiTheme();
  const { preferences } = usePersonalPreferences();
  const { width, fontScale } = useWindowDimensions();
  const roomy = width < 350 || fontScale > 1.25;
  return <View style={[styles.hero, { backgroundColor: colors.surfaceSubtle }]} testID="settings-hero">
    <ForestCardLandscape variant="day" opacity={roomy ? 0.16 : 0.75} />
    <View style={[styles.heroCopy, { width: roomy ? '100%' : '70%' }]}>
      <LumiText variant="overline" tone="muted" style={styles.eyebrow}>VÁŠ MALÝ SVĚT</LumiText>
      <LumiText style={styles.heroTitle}>Ať je vám tu{ '\n' }hezky.</LumiText>
      <LumiText variant="caption" tone="muted">Drobné volby pro vaše společné chvíle.</LumiText>
      <View style={[styles.pill, { backgroundColor: colors.surface }]}>
        <LumiIcon name="development" size={16} color={colors.primary} />
        <LumiText variant="caption">{LUMI_MOTIFS[motif].label} · {GUIDE_NAMES[preferences.guideSpecies].name}</LumiText>
      </View>
    </View>
    {!roomy ? <View pointerEvents="none" style={styles.heroGuide} accessible={false}
      importantForAccessibility="no-hide-descendants">
      <LumiCharacter species={preferences.guideSpecies} appearanceStyle={preferences.appearanceStyle}
        expression="happy" width={135} height={155} />
    </View> : null}
  </View>;
}

export function SettingsRow({ title, description, summary, icon, onPress, testID }: {
  title: string; description: string; summary?: string | undefined; icon: ForestTone; onPress: () => void; testID?: string;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable onPress={onPress} accessibilityRole="button" testID={testID}
    accessibilityLabel={`${title}. ${summary ?? description}`} accessibilityHint="Otevřít nastavení této sekce"
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.row, { backgroundColor: colors.surface,
      borderColor: focused ? colors.focus : colors.border, opacity: pressed ? 0.8 : 1 }]}>
    <ForestIconBadge name={icon} size={43} />
    <View style={{ flex: 1, gap: 4 }}>
      <LumiText variant="bodyStrong">{title}</LumiText>
      <LumiText variant="caption" tone="muted">{description}</LumiText>
      {summary ? <LumiText variant="caption" tone="accent">{summary}</LumiText> : null}
    </View>
    <LumiIcon name="arrow-right" color={colors.primary} size={20} />
  </Pressable>;
}

export function SettingsCard({ title, description, children, testID, danger = false }: {
  title: string; description?: string; children: React.ReactNode; testID?: string; danger?: boolean;
}) {
  const { colors } = useLumiTheme();
  return <LumiCard testID={testID} style={[styles.card, danger ? { borderWidth: 1, borderColor: colors.danger } : null]}>
    <LumiText variant="h3" accessibilityRole="header" tone={danger ? 'danger' : 'default'}>{title}</LumiText>
    {description ? <LumiText variant="caption" tone="muted">{description}</LumiText> : null}
    {children}
  </LumiCard>;
}

export function SettingsToggle({ label, description, value, onChange, disabled, testID }: {
  label: string; description?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; testID?: string;
}) {
  const { colors } = useLumiTheme();
  return <View style={styles.toggle}>
    <View style={{ flex: 1, gap: 4 }}>
      <LumiText variant="bodyStrong">{label}</LumiText>
      {description ? <LumiText variant="caption" tone="muted">{description}</LumiText> : null}
    </View>
    <Switch testID={testID} accessibilityLabel={label} accessibilityHint={description} disabled={disabled}
      value={value} onValueChange={onChange} trackColor={{ false: colors.controlBorder, true: colors.primary }}
      thumbColor={colors.surface} />
  </View>;
}

export function SettingsChoice({ label, selected, disabled, onPress, children, testID, compact = false }: {
  label: string; selected: boolean; disabled?: boolean; onPress: () => void; children?: React.ReactNode;
  testID?: string; compact?: boolean;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} testID={testID}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.choice, compact ? { flexGrow: 1, flexBasis: '42%' } : null,
      { backgroundColor: selected ? colors.surfaceSubtle : colors.surface,
        borderColor: focused ? colors.focus : selected ? colors.primary : colors.border,
        opacity: disabled ? 0.65 : pressed ? 0.8 : 1 }]}>
    {children}
    <View style={styles.choiceLabel}>
      <LumiText variant="label" style={{ flex: 1 }}>{label}</LumiText>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.controlBorder }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </View>
  </Pressable>;
}

/** Per-section state: errors and save status stay beside the relevant controls. */
export function useSettingsAction() {
  const guard = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  async function run(action: () => Promise<unknown>, success?: string) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      if (success) setFeedback({ text: success, error: false });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'Změnu se nepodařilo uložit. Zkuste to znovu.', error: true });
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return { busy, feedback, run };
}
export function SettingsFeedback({ action }: { action: ReturnType<typeof useSettingsAction> }) {
  return <View accessibilityLiveRegion="polite">
    {action.busy ? <LumiText variant="caption" tone="muted">Ukládám…</LumiText> : action.feedback ?
      <LumiText variant="caption" tone={action.feedback.error ? 'danger' : 'success'}>{action.feedback.text}</LumiText> : null}
  </View>;
}
export function SettingsSubnav<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (id: T) => void; options: readonly { id: T; label: string; icon: LumiIconId }[]; label: string;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState<T | null>(null);
  return <View accessibilityRole="tablist" accessibilityLabel={label}
    style={{ flexDirection: 'row', padding: 5, gap: 5, borderRadius: 22, backgroundColor: colors.surfaceSubtle }}>
    {options.map((option) => <Pressable key={option.id} accessibilityRole="tab" accessibilityLabel={option.label}
      accessibilityState={{ selected: value === option.id }} onPress={() => onChange(option.id)} testID={`settings-appearance-${option.id}`}
      onFocus={() => setFocused(option.id)} onBlur={() => setFocused(null)}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 11, gap: 6,
        minHeight: 52, borderRadius: 18, borderWidth: 2, borderColor: focused === option.id ? colors.focus : 'transparent',
        backgroundColor: value === option.id ? colors.primary : 'transparent', opacity: pressed ? 0.8 : 1 })}>
      <LumiIcon name={option.icon} size={21} color={value === option.id ? colors.onPrimary : colors.textMuted} />
      <LumiText variant="label" style={{ textAlign: 'center', color: value === option.id ? colors.onPrimary : colors.textMuted }}>{option.label}</LumiText>
    </Pressable>)}
  </View>;
}

export function SettingsDisclosureButton({ title, expanded, onPress, disabled = false, testID }: {
  title: string; expanded: boolean; onPress: () => void; disabled?: boolean; testID?: string;
}) {
  const { colors } = useLumiTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded, disabled }}
    disabled={disabled} onPress={onPress} testID={testID} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 15, borderWidth: 2, borderColor: focused ? colors.focus : colors.border,
      padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.6 : pressed ? 0.8 : 1 })}>
    <LumiText variant="label" tone="accent" style={{ flex: 1 }}>{title}</LumiText>
    <View style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}>
      <LumiIcon name="arrow-right" size={18} color={colors.primary} />
    </View>
  </Pressable>;
}

export function SettingsSectionIntro({ icon, title, description }: { icon: LumiIconId; title: string; description: string }) {
  const { colors } = useLumiTheme();
  return <View style={styles.intro}>
    <LumiIcon name={icon} size={34} color={colors.primary} />
    <LumiText variant="h1" accessibilityRole="header">{title}</LumiText>
    <LumiText tone="muted">{description}</LumiText>
  </View>;
}
const styles = StyleSheet.create({
  hero: { borderRadius: 28, overflow: 'hidden', minHeight: 235 },
  heroCopy: { padding: 22, paddingBottom: 52, gap: 10 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.6 },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 },
  heroGuide: { position: 'absolute', right: -2, bottom: 2 },
  pill: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', alignItems: 'center',
    gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 23, borderWidth: 2, minHeight: 88 },
  card: { borderRadius: 24, gap: 14 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52 },
  choice: { borderRadius: 20, borderWidth: 2, padding: 13, gap: 8, minHeight: 52 },
  choiceLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  intro: { gap: 10, paddingVertical: 8 },
});
