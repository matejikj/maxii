import { BabyAvatarPicker } from './BabyAvatarPicker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LUMI_MOTIFS } from '@lumi/forest-design/core';
import { LumiButton, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { createChildProfile, parseCalendarDate, type ChildProfile } from '../../domain';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { FamilyConflictsPanel } from '../family/FamilyConflictsPanel';
import { BackupRestorePanel } from './BackupRestorePanel';
import { PhotoStoragePanel } from './PhotoStoragePanel';
import { FamilyAccountPanel } from './FamilyAccountPanel';
import { ChildrenPanel } from './ChildrenPanel';
import { SettingsPanel } from './SettingsPanel';
import { GUIDE_NAMES, SETTINGS_SECTIONS, resolveSettingsSection, type SettingsSection } from './settingsPresentation';
import { SettingsCard, SettingsFeedback, SettingsHero, SettingsRow, SettingsSectionIntro, useSettingsAction } from './SettingsVisuals';

type ProfileScreenProps = { onClose: () => void; initialSection?: SettingsSection | undefined };

/** Optional settings. Opening a section never requires saving unrelated preferences. */
export function ProfileScreen({ onClose, initialSection }: ProfileScreenProps) {
  const { colors } = useLumiTheme();
  const { profile } = useBootstrap();
  const { preferences, ready } = usePersonalPreferences();
  const initial = resolveSettingsSection(initialSection);
  const [section, setSection] = useState<SettingsSection | null>(initial);
  const [visited, setVisited] = useState<SettingsSection[]>(initial ? [initial] : []);
  const isFocused = useIsFocused();
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const open = (next: SettingsSection) => {
    Keyboard.dismiss();
    setVisited((current) => current.includes(next) ? current : [...current, next]);
    setSection(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const back = useCallback(() => {
    Keyboard.dismiss();
    if (section) { setSection(null); scroll.current?.scrollTo({ y: 0, animated: false }); }
    else onClose();
  }, [section, onClose]);
  useEffect(() => {
    if (!isFocused || !section) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; }
      back();
      return true;
    });
    return () => listener.remove();
  }, [isFocused, section, back]);
  const current = SETTINGS_SECTIONS.find((item) => item.id === section);
  const reminders = preferences.reminders;
  const reminderSummary = [reminders.dailyTogetherEnabled ? 'Denní' : '', reminders.weeklyGlanceEnabled ? 'Týdenní' : ''].filter(Boolean).join(' · ') || 'Vypnuté';
  const summaries: Partial<Record<SettingsSection, string>> = {
    appearance: `${LUMI_MOTIFS[preferences.appMotif].label} · ${GUIDE_NAMES[preferences.guideSpecies].name}`,
    children: profile?.displayName ?? 'Profil dítěte', reminders: reminderSummary,
    units: `${preferences.weightUnit} · ${preferences.lengthUnit}`,
  };
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <LumiText variant={section ? 'caption' : 'h1'} tone={section ? 'muted' : 'default'}
          accessibilityRole={section ? undefined : 'header'}>Nastavení</LumiText>
        {section ? <LumiText variant="label">{current?.title}</LumiText> : null}
      </View>
      <LumiButton title={section ? 'Zpět' : 'Hotovo'} variant="secondary" onPress={back} testID="settings-back" />
    </View>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={{ display: section ? 'none' : 'flex', gap: 22 }} accessibilityElementsHidden={!!section}
          importantForAccessibility={section ? 'no-hide-descendants' : 'auto'}>
          <SettingsHero />
          {(['personal', 'data'] as const).map((group) => <View key={group} style={{ gap: 10 }}>
            <LumiText variant="overline" tone="muted" style={styles.groupTitle} accessibilityRole="header">
              {group === 'personal' ? 'PODLE VÁS' : 'VZPOMÍNKY V BEZPEČÍ'}
            </LumiText>
            {SETTINGS_SECTIONS.filter((item) => item.group === group).map((item) => <SettingsRow key={item.id}
              title={item.title} description={item.description} icon={item.icon}
              summary={ready ? summaries[item.id] : undefined} onPress={() => open(item.id)}
              testID={item.id === 'appearance' ? 'profile-open-themes' : `settings-open-${item.id}`} />)}
          </View>)}
          <LumiText variant="caption" tone="muted" style={styles.footer}>S péčí o vaše společné chvíle.{ '\n' }Lumi · váš malý svět</LumiText>
        </View>
        {visited.map((id) => {
          const info = SETTINGS_SECTIONS.find((item) => item.id === id)!;
          const visible = section === id;
          return <View key={id} style={{ display: visible ? 'flex' : 'none', gap: 22 }}
            accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
            <SettingsSectionIntro title={info.title} description={info.description} icon={info.icon} />
            {id === 'children' ? <>
              {profile ? <ChildProfileEditor key={profile.childId} profile={profile} /> : null}
              <BabyAvatarPicker /><ChildrenPanel /><FamilyAccountPanel /><FamilyConflictsPanel />
            </> : id === 'backup' ? <><BackupRestorePanel /><PhotoStoragePanel /></> :
              ready ? (id !== 'privacy' || visible) && <SettingsPanel section={id} key={id === 'units' ? `${id}-${profile?.childId}` : id} /> :
                <LumiText tone="muted">Načítám vaše nastavení…</LumiText>}
          </View>;
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function ChildProfileEditor({ profile }: { profile: ChildProfile }) {
  const { saveProfile } = useBootstrap();
  const [name, setName] = useState(profile.displayName);
  const [birthDate, setBirthDate] = useState(profile.birthDate
    ? `${profile.birthDate.year}-${String(profile.birthDate.month).padStart(2, '0')}-${String(profile.birthDate.day).padStart(2, '0')}` : '');
  const action = useSettingsAction();
  return <SettingsCard title="O vašem dítěti" description="Přezdívka a narozeniny jsou volitelné. Datum narození pomáhá vybírat inspiraci podle věku.">
    <LumiInput label="Přezdívka" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} editable={!action.busy} />
    <LumiInput label="Datum narození" hint="Rok-měsíc-den, například 2026-04-15. Můžete ponechat prázdné."
      value={birthDate} onChangeText={setBirthDate} placeholder="RRRR-MM-DD" autoCapitalize="none"
      autoCorrect={false} maxLength={10} editable={!action.busy} />
    <LumiButton title="Uložit profil dítěte" fullWidth loading={action.busy} onPress={() => void action.run(async () => {
      let parsed: ChildProfile['birthDate'] = null;
      try { parsed = birthDate.trim() ? parseCalendarDate(birthDate.trim()) : null; }
      catch { throw new Error('Zadejte platné datum ve tvaru RRRR-MM-DD, například 2026-04-15.'); }
      await saveProfile(createChildProfile({ ...profile, displayName: name.trim() || 'Miminko', birthDate: parsed,
        summaryTimeZone: profile.settings.summaryTimeZone }));
    }, 'Profil dítěte uložen.')} />
    <SettingsFeedback action={action} />
  </SettingsCard>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22,
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  content: { padding: 20, paddingBottom: 36, maxWidth: 640, width: '100%', alignSelf: 'center' },
  groupTitle: { fontSize: 10, lineHeight: 17, letterSpacing: 1.6, paddingHorizontal: 5, paddingTop: 2 },
  footer: { textAlign: 'center', lineHeight: 22, padding: 10 },
});
