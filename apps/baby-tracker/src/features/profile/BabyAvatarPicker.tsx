import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LumiBaby, LumiText } from '@lumi/forest-design/native';
import { useBootstrap } from '../../app/session/BootstrapContext';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import {
  SettingsCard,
  SettingsChoice,
  SettingsFeedback,
  useSettingsAction,
} from './SettingsVisuals';
const LABELS = { neutral: 'Miminko', girl: 'Holčička', boy: 'Chlapeček' } as const;
export function BabyAvatarPicker() {
  const { profile } = useBootstrap();
  const { babyAvatar, babyAvatarReady, setBabyAvatar } = usePersonalPreferences();
  const action = useSettingsAction();
  const { width, fontScale } = useWindowDimensions();
  return (
    <SettingsCard
      title="Postavička miminka"
      testID="baby-avatar-picker"
      description={`Vyberte postavičku pro ${profile?.displayName ?? 'vaše dítě'}. Bude si hrát s vaším průvodcem v ukázkách aktivit.`}
    >
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Postavička miminka"
      >
        {(['girl', 'boy', 'neutral'] as const).map((variant) => (
          <View
            key={variant}
            style={{
              flexGrow: 1,
              flexBasis: variant === 'neutral' || width < 350 || fontScale > 1.3 ? '100%' : '45%',
            }}
          >
            <SettingsChoice
              label={LABELS[variant]}
              selected={babyAvatar === variant}
              disabled={!babyAvatarReady || action.busy}
              testID={`baby-avatar-${variant}`}
              onPress={() =>
                void action.run(() => setBabyAvatar(variant), 'Postavička miminka uložená.')
              }
            >
              <View
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                style={{ alignItems: 'center' }}
              >
                <LumiBaby variant={variant} width={88} height={108} />
              </View>
            </SettingsChoice>
          </View>
        ))}
      </View>
      <LumiText variant="caption" tone="muted">
        Volba je nepovinná a ukládá se automaticky pro toto dítě.
      </LumiText>
      <SettingsFeedback action={action} />
    </SettingsCard>
  );
}
