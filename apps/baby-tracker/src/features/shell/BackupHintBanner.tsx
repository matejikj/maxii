import React from 'react';
import { View } from 'react-native';
import { LumiButton, LumiCard, LumiText } from '@lumi/forest-design/native';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';

/** One calm portable-backup explanation after the first real care rows. */
export function BackupHintBanner() {
  const { backupHintVisible, dismissBackupHint } = usePersonalPreferences();
  if (!backupHintVisible) return null;
  return (
    <LumiCard>
      <View style={{ gap: 12 }}>
        <LumiText variant="h3">Přenosná záloha</LumiText>
        <LumiText tone="muted">
          Záznamy jsou uložené v tomto zařízení. Pro ochranu před ztrátou telefonu vytvořte v
          profilu přenosnou šifrovanou zálohu a uložte ji mimo telefon. Místní body obnovy ztrátu
          zařízení nepřežijí.
        </LumiText>
        <LumiButton title="Rozumím" onPress={() => void dismissBackupHint()} />
      </View>
    </LumiCard>
  );
}
