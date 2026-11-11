import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumiButton, LumiCard, LumiInput, LumiText, useLumiTheme } from '@lumi/forest-design/native';
import { createChildProfile, parseCalendarDate } from '../../domain';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { FamilyConflictsPanel } from '../family/FamilyConflictsPanel';
import { BackupRestorePanel } from './BackupRestorePanel';
import { ChildrenPanel } from './ChildrenPanel';
import { SettingsPanel } from './SettingsPanel';

type ProfileScreenProps = {
  onClose: () => void;
};

/**
 * Optional profile edits. Name and birth date are never required to keep writing care.
 */
export function ProfileScreen({ onClose }: ProfileScreenProps) {
  const { colors } = useLumiTheme();
  const { profile, saveProfile } = useBootstrap();
  const [displayName, setDisplayName] = useState(profile?.displayName ?? 'Miminko');
  const [birthDate, setBirthDate] = useState(
    profile?.birthDate
      ? `${profile.birthDate.year}-${String(profile.birthDate.month).padStart(2, '0')}-${String(profile.birthDate.day).padStart(2, '0')}`
      : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const settingsY = useRef(0);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <LumiText>Profil ještě není připravený.</LumiText>
        <LumiButton title="Zpět" onPress={onClose} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <LumiText variant="h1" accessibilityRole="header" style={{ flexShrink: 1 }}>Profil</LumiText>
          <LumiButton title="Vybrat téma" variant="secondary" testID="profile-open-themes"
            onPress={() => scrollRef.current?.scrollTo({ y: settingsY.current, animated: false })} />
        </View>
        <LumiText tone="muted">
          Přezdívku a narozeniny doplňte, až budete chtít. Tracker funguje i bez nich.
        </LumiText>
        <LumiCard>
          <View style={styles.fields}>
            <LumiInput
              label="Přezdívka"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
            <LumiInput
              label="Datum narození (volitelné, RRRR-MM-DD)"
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="nevyplněno"
              autoCapitalize="none"
            />
            {error ? <LumiText tone="muted">{error}</LumiText> : null}
          </View>
        </LumiCard>
        <LumiButton
          title="Uložit profil"
          loading={saving}
          fullWidth
          onPress={() => {
            setSaving(true);
            setError(null);
            try {
              const next = createChildProfile({
                childId: profile.childId,
                displayName: displayName.trim() || 'Miminko',
                birthDate: parseOptionalBirthDate(birthDate),
                summaryTimeZone: profile.settings.summaryTimeZone,
              });
              void saveProfile(next)
                .then(onClose)
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'Uložení selhalo');
                })
                .finally(() => setSaving(false));
            } catch (err) {
              setSaving(false);
              setError(err instanceof Error ? err.message : 'Neplatný profil');
            }
          }}
        />
        <ChildrenPanel />
        <View onLayout={(event) => { settingsY.current = event.nativeEvent.layout.y; }}>
          <SettingsPanel />
        </View>
        <FamilyConflictsPanel />
        <BackupRestorePanel />
        <LumiButton title="Zavřít" variant="ghost" onPress={onClose} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

function parseOptionalBirthDate(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parseCalendarDate(trimmed);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 24,
    gap: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  fields: { gap: 16 },
});
