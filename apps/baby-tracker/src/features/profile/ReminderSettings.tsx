import React, { useState } from 'react';
import { View } from 'react-native';
import { LumiButton, LumiInput, LumiText } from '@lumi/forest-design/native';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { formatReminderTime, parseReminderTime } from './settingsPresentation';
import {
  SettingsCard,
  SettingsFeedback,
  SettingsToggle,
  useSettingsAction,
} from './SettingsVisuals';

const DAYS = [
  'Každou neděli',
  'Každé pondělí',
  'Každé úterý',
  'Každou středu',
  'Každý čtvrtek',
  'Každý pátek',
  'Každou sobotu',
];
export function ReminderSettings() {
  const { runtime, profile } = useBootstrap();
  const { preferences, ready, setReminders } = usePersonalPreferences();
  const saved = preferences.reminders;
  const [time, setTime] = useState(
    formatReminderTime(saved.dailyTogetherHour, saved.dailyTogetherMinute),
  );
  const action = useSettingsAction();
  const [feedbackAt, setFeedbackAt] = useState<'daily' | 'weekly'>('daily');
  if (!runtime || !profile) return null;
  const caps = runtime.reminders.getCapabilities();
  const disabled = !ready || action.busy;
  async function toggle(kind: 'dailyTogetherEnabled' | 'weeklyGlanceEnabled', enabled: boolean) {
    setFeedbackAt(kind === 'dailyTogetherEnabled' ? 'daily' : 'weekly');
    await action.run(
      async () => {
        if (enabled && caps.osLocalNotifications) {
          const permission = await runtime!.reminders.requestPermission();
          if (permission !== 'granted')
            throw new Error(
              'Oznámení nejsou povolená. Zapněte je v nastavení zařízení a zkuste to znovu.',
            );
        }
        await setReminders({
          ...saved,
          [kind]: enabled,
          timeZone: profile!.settings.summaryTimeZone,
        });
      },
      enabled ? 'Připomínka zapnutá.' : 'Připomínka vypnutá.',
    );
  }
  return (
    <View style={{ gap: 16 }}>
      <LumiText variant="caption" tone="muted">
        Připomenutí jsou dobrovolná. Zvolte si, co vám zpříjemní den.
      </LumiText>
      {!caps.osLocalNotifications ? (
        <SettingsCard title="Upozornění v prohlížeči">
          <LumiText variant="caption" tone="muted">
            Při zavřeném prohlížeči upozornění nepřijde. Týdenní ohlédnutí najdete i uvnitř
            aplikace.
          </LumiText>
        </SettingsCard>
      ) : null}
      <SettingsCard title="Každý den spolu">
        <SettingsToggle
          label="Denní připomínka"
          description="Malé pozvání ke společné chvíli."
          value={saved.dailyTogetherEnabled}
          disabled={disabled}
          testID="settings-daily-reminder"
          onChange={(enabled) => void toggle('dailyTogetherEnabled', enabled)}
        />
        <LumiInput
          label="Čas připomínky"
          hint="24hodinový formát, například 18:30."
          value={time}
          onChangeText={setTime}
          autoCapitalize="none"
          autoCorrect={false}
          testID="settings-reminder-time"
          editable={!disabled}
          maxLength={5}
        />
        <LumiButton
          title="Uložit čas"
          fullWidth
          variant="secondary"
          disabled={disabled}
          testID="settings-save-reminder-time"
          onPress={() => {
            setFeedbackAt('daily');
            void action.run(async () => {
              const parsed = parseReminderTime(time);
              await setReminders({
                ...saved,
                dailyTogetherHour: parsed.hour,
                dailyTogetherMinute: parsed.minute,
                timeZone: profile.settings.summaryTimeZone,
              });
              setTime(formatReminderTime(parsed.hour, parsed.minute));
            }, 'Čas připomínky uložen.');
          }}
        />
        <LumiText variant="caption" tone="muted">
          {saved.dailyTogetherEnabled ? 'Připomínka přijde' : 'Uložený čas'} v{' '}
          {formatReminderTime(saved.dailyTogetherHour, saved.dailyTogetherMinute)}. Čas se řídí
          pásmem zařízení.
        </LumiText>
        {feedbackAt === 'daily' ? <SettingsFeedback action={action} /> : null}
      </SettingsCard>
      <SettingsCard title="Ohlédnutí za týdnem">
        <SettingsToggle
          label="Týdenní ohlédnutí"
          description={`Chvíle na vaše vzpomínky. ${DAYS[saved.weeklyGlanceWeekday]} v 10:00.`}
          value={saved.weeklyGlanceEnabled}
          disabled={disabled}
          testID="settings-weekly-reminder"
          onChange={(enabled) => void toggle('weeklyGlanceEnabled', enabled)}
        />
        {feedbackAt === 'weekly' ? <SettingsFeedback action={action} /> : null}
      </SettingsCard>
    </View>
  );
}
