import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LumiText, useLumiMotion } from '@lumi/forest-design/native';
import { workshopGuidePreviewHint } from '@lumi/forest-design';
import {
  LOCAL_APPEARANCE_STYLES,
  LOCAL_GUIDE_SPECIES,
  type AppearanceStyle,
} from '../../application';
import { usePersonalPreferences } from '../../app/session/PreferencesContext';
import { GuideCompanion } from '../shell/GuideCompanion';
import { AppThemePicker } from './AppThemePicker';
import { GUIDE_NAMES } from './settingsPresentation';
import {
  SettingsCard,
  SettingsChoice,
  SettingsFeedback,
  SettingsToggle,
  SettingsSubnav,
  useSettingsAction,
} from './SettingsVisuals';

const STYLES: Record<AppearanceStyle, { title: string; description: string }> = {
  forest: { title: 'Lesní', description: 'Měkký, útulný vzhled Lumi.' },
  workshop: { title: 'Dílna', description: 'Průvodce s tvořivými doplňky.' },
  restrained: { title: 'Střídmý', description: 'Jemnější vzhled s méně ozdobami.' },
};
export function AppearanceSettings() {
  const { preferences, ready, setGuide, setAppearance, setMotionEnabled } =
    usePersonalPreferences();
  const { reduceMotion } = useLumiMotion();
  const { width, fontScale } = useWindowDimensions();
  const [page, setPage] = useState<'world' | 'guide'>('world');
  const guide = useSettingsAction();
  const appearance = useSettingsAction();
  const motion = useSettingsAction();
  const single = width < 350 || fontScale > 1.3;
  return (
    <View style={{ gap: 22 }}>
      <SettingsSubnav
        value={page}
        onChange={setPage}
        label="Přizpůsobení vzhledu"
        options={[
          { id: 'world', label: 'Prostředí', icon: 'development' },
          { id: 'guide', label: 'Průvodce', icon: 'care' },
        ]}
      />
      <View
        style={{ display: page === 'world' ? 'flex' : 'none' }}
        accessibilityElementsHidden={page !== 'world'}
        importantForAccessibility={page === 'world' ? 'auto' : 'no-hide-descendants'}
      >
        <AppThemePicker />
      </View>
      <View
        style={{ display: page === 'guide' ? 'flex' : 'none', gap: 18 }}
        accessibilityElementsHidden={page !== 'guide'}
        importantForAccessibility={page === 'guide' ? 'auto' : 'no-hide-descendants'}
      >
        <SettingsCard
          title="Váš průvodce"
          description="Kdo vás bude provázet? Výběr se uloží automaticky a vzpomínky zůstanou stejné."
        >
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}
            accessibilityRole="radiogroup"
            accessibilityLabel="Průvodce"
          >
            {LOCAL_GUIDE_SPECIES.map((species) => (
              <View key={species} style={{ width: single ? '100%' : '48%', flexGrow: 1 }}>
                <SettingsChoice
                  label={GUIDE_NAMES[species].name}
                  selected={preferences.guideSpecies === species}
                  disabled={!ready || guide.busy}
                  testID={`settings-guide-${species}`}
                  onPress={() =>
                    void guide.run(
                      () => setGuide(species),
                      `Provází vás ${GUIDE_NAMES[species].name}.`,
                    )
                  }
                >
                  <View
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    style={{ alignItems: 'center' }}
                  >
                    <GuideCompanion
                      species={species}
                      appearanceStyle={preferences.appearanceStyle}
                      semantic="calm"
                      visible={false}
                      width={105}
                      height={112}
                    />
                  </View>
                  <LumiText variant="caption" tone="muted">
                    {GUIDE_NAMES[species].animal}
                  </LumiText>
                </SettingsChoice>
              </View>
            ))}
          </View>
          <SettingsFeedback action={guide} />
        </SettingsCard>
        <SettingsCard
          title="Vzhled průvodce"
          description="Stejný kamarád v trochu jiném kabátku. Vzhled můžete libovolně kombinovat s tématem aplikace."
        >
          <View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={{ alignItems: 'center' }}
          >
            <GuideCompanion
              species={preferences.guideSpecies}
              appearanceStyle={preferences.appearanceStyle}
              semantic="calm"
              visible={false}
              width={128}
              height={138}
            />
          </View>
          <View
            style={{ gap: 8 }}
            accessibilityRole="radiogroup"
            accessibilityLabel="Vzhled průvodce"
          >
            {LOCAL_APPEARANCE_STYLES.map((style) => (
              <SettingsChoice
                key={style}
                label={STYLES[style].title}
                selected={preferences.appearanceStyle === style}
                disabled={!ready || appearance.busy}
                onPress={() =>
                  void appearance.run(() => setAppearance(style), 'Vzhled průvodce uložen.')
                }
              >
                <LumiText variant="caption" tone="muted">
                  {STYLES[style].description}
                </LumiText>
              </SettingsChoice>
            ))}
          </View>
          <LumiText variant="caption" tone="muted">
            {workshopGuidePreviewHint(preferences.guideSpecies, preferences.appearanceStyle)}
          </LumiText>
          <SettingsFeedback action={appearance} />
        </SettingsCard>
        <SettingsCard title="Pohyb postav">
          <SettingsToggle
            label="Jemné animace"
            description="Drobná gesta a pohyb vašich průvodců."
            value={preferences.characterMotionEnabled}
            disabled={!ready || motion.busy}
            onChange={(enabled) =>
              void motion.run(
                () => setMotionEnabled(enabled),
                enabled ? 'Pohyb postav zapnutý.' : 'Pohyb postav vypnutý.',
              )
            }
          />
          {reduceMotion ? (
            <LumiText variant="caption" tone="muted">
              Zařízení má zapnuté omezení pohybu. Postavičky proto zůstávají v klidu.
            </LumiText>
          ) : null}
          <SettingsFeedback action={motion} />
        </SettingsCard>
      </View>
    </View>
  );
}
