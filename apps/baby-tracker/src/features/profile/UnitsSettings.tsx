import React, { useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiInput, LumiText } from '@lumi/forest-design/native';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { asTimeZoneId, createChildProfile } from '../../domain';
import {
  SettingsCard,
  SettingsChoice,
  SettingsDisclosureButton,
  SettingsFeedback,
  useSettingsAction,
} from './SettingsVisuals';

export function UnitsSettings() {
  const { profile, saveProfile } = useBootstrap();
  const { preferences, ready, setUnits, setTimeZone } = usePersonalPreferences();
  const [zone, setZone] = useState(profile?.settings.summaryTimeZone ?? 'Europe/Prague');
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [customZone, setCustomZone] = useState(zone !== 'Europe/Prague' && zone !== deviceZone);
  const units = useSettingsAction();
  const timeZone = useSettingsAction();
  if (!profile) return null;
  return (
    <View style={{ gap: 16 }}>
      <SettingsCard
        title="Měření růstu"
        description="Změní se jednotky zobrazení. Uložená měření zůstanou zachovaná."
      >
        <LumiText variant="label">Hmotnost</LumiText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          accessibilityRole="radiogroup"
          accessibilityLabel="Jednotka hmotnosti"
        >
          {(['kg', 'lb'] as const).map((value) => (
            <SettingsChoice
              key={value}
              label={value === 'kg' ? 'Kilogramy · kg' : 'Libry · lb'}
              compact
              selected={preferences.weightUnit === value}
              disabled={!ready || units.busy}
              onPress={() =>
                void units.run(
                  () => setUnits({ weightUnit: value, lengthUnit: preferences.lengthUnit }),
                  'Jednotky uloženy.',
                )
              }
            />
          ))}
        </View>
        <LumiText variant="label">Délka</LumiText>
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          accessibilityRole="radiogroup"
          accessibilityLabel="Jednotka délky"
        >
          {(['cm', 'in'] as const).map((value) => (
            <SettingsChoice
              key={value}
              label={value === 'cm' ? 'Centimetry · cm' : 'Palce · in'}
              compact
              selected={preferences.lengthUnit === value}
              disabled={!ready || units.busy}
              onPress={() =>
                void units.run(
                  () => setUnits({ weightUnit: preferences.weightUnit, lengthUnit: value }),
                  'Jednotky uloženy.',
                )
              }
            />
          ))}
        </View>
        <SettingsFeedback action={units} />
      </SettingsCard>
      <SettingsCard
        title="Časové pásmo deníku"
        description="Určuje, kdy začíná nový den v přehledech. Časy původních záznamů se nepřepisují."
      >
        <LumiText variant="caption" tone="muted">
          Používá se pro dítě: {profile.displayName}
        </LumiText>
        <View
          style={{ gap: 8 }}
          accessibilityRole="radiogroup"
          accessibilityLabel="Časové pásmo deníku"
        >
          <SettingsChoice
            label="Česko · Praha"
            selected={zone === 'Europe/Prague'}
            disabled={timeZone.busy}
            onPress={() => setZone('Europe/Prague')}
          />
          {deviceZone !== 'Europe/Prague' ? (
            <SettingsChoice
              label={`Pásmo zařízení · ${deviceZone}`}
              selected={zone === deviceZone}
              disabled={timeZone.busy}
              onPress={() => setZone(deviceZone)}
            />
          ) : null}
        </View>
        <SettingsDisclosureButton
          title="Jiné časové pásmo"
          expanded={customZone}
          disabled={timeZone.busy}
          onPress={() => setCustomZone(!customZone)}
        />
        {customZone ? (
          <LumiInput
            label="Vlastní časové pásmo"
            hint="Například Europe/London nebo America/New_York."
            value={zone}
            onChangeText={setZone}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!timeZone.busy}
            testID="settings-time-zone"
          />
        ) : null}
        <LumiText variant="caption" tone="muted">
          Uložené pásmo: {profile.settings.summaryTimeZone}
        </LumiText>
        <LumiButton
          title="Uložit časové pásmo"
          fullWidth
          loading={timeZone.busy}
          disabled={!ready}
          onPress={() =>
            void timeZone.run(async () => {
              try {
                asTimeZoneId(zone.trim());
              } catch {
                throw new Error(
                  'Časové pásmo se nepodařilo rozpoznat. Zkuste například Europe/Prague.',
                );
              }
              const next = createChildProfile({ ...profile, summaryTimeZone: zone.trim() });
              await setTimeZone(next.settings.summaryTimeZone);
              await saveProfile(next);
            }, 'Časové pásmo uloženo.')
          }
        />
        <SettingsFeedback action={timeZone} />
      </SettingsCard>
    </View>
  );
}
