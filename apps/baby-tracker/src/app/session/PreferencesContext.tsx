import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultPersonalPreferences,
  loadPersonalPreferences,
  markBackupHintShown,
  saveGrowthDisplayUnits,
  saveReminderPreferences,
  setAppearanceStyle,
  setCharacterMotionEnabled,
  setGuideSpecies,
  shouldShowBackupHint,
  updateSummaryTimeZone,
  type AppearanceStyle,
  type GuideSpecies,
  type PersonalPreferences,
  type ReminderPreferences,
} from '../../application';
import type { LengthDisplayUnit, WeightDisplayUnit } from '../../domain';
import { useBootstrap } from './BootstrapContext';

type PreferencesContextValue = {
  preferences: PersonalPreferences;
  backupHintVisible: boolean;
  refresh: () => Promise<void>;
  setMotionEnabled: (enabled: boolean) => Promise<void>;
  setGuide: (species: GuideSpecies) => Promise<void>;
  setAppearance: (style: AppearanceStyle) => Promise<void>;
  setReminders: (prefs: ReminderPreferences) => Promise<void>;
  setUnits: (units: {
    weightUnit: WeightDisplayUnit;
    lengthUnit: LengthDisplayUnit;
  }) => Promise<void>;
  setTimeZone: (timeZone: string) => Promise<void>;
  dismissBackupHint: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { runtime, profile } = useBootstrap();
  const [preferences, setPreferences] = useState<PersonalPreferences>(
    defaultPersonalPreferences('Europe/Prague'),
  );
  const [backupHintVisible, setBackupHintVisible] = useState(false);

  const refresh = useCallback(async () => {
    if (!runtime) return;
    const zone = profile?.settings.summaryTimeZone ?? 'Europe/Prague';
    const next = await loadPersonalPreferences(runtime.unitOfWork, zone);
    setPreferences(next);
    setBackupHintVisible(await shouldShowBackupHint(runtime.unitOfWork));
  }, [profile?.settings.summaryTimeZone, runtime]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      backupHintVisible,
      refresh,
      async setMotionEnabled(enabled) {
        if (!runtime) return;
        await setCharacterMotionEnabled(runtime.unitOfWork, enabled);
        setPreferences((current) => ({ ...current, characterMotionEnabled: enabled }));
      },
      async setGuide(species) {
        if (!runtime) return;
        await setGuideSpecies(runtime.unitOfWork, species);
        setPreferences((current) => ({ ...current, guideSpecies: species }));
      },
      async setAppearance(style) {
        if (!runtime) return;
        await setAppearanceStyle(runtime.unitOfWork, style);
        setPreferences((current) => ({ ...current, appearanceStyle: style }));
      },
      async setReminders(prefs) {
        if (!runtime) return;
        const saved = await saveReminderPreferences(runtime.unitOfWork, prefs);
        await runtime.reminders.syncSchedules(saved);
        setPreferences((current) => ({ ...current, reminders: saved }));
      },
      async setUnits(units) {
        if (!runtime) return;
        await saveGrowthDisplayUnits(runtime.unitOfWork, units);
        setPreferences((current) => ({
          ...current,
          weightUnit: units.weightUnit,
          lengthUnit: units.lengthUnit,
        }));
      },
      async setTimeZone(timeZone) {
        if (!runtime || !profile) return;
        await updateSummaryTimeZone(runtime.unitOfWork, profile.childId, timeZone);
        setPreferences((current) => ({
          ...current,
          reminders: { ...current.reminders, timeZone },
        }));
      },
      async dismissBackupHint() {
        if (!runtime) return;
        await markBackupHintShown(runtime.unitOfWork);
        setBackupHintVisible(false);
      },
    }),
    [backupHintVisible, preferences, profile, refresh, runtime],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePersonalPreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('Preferences context is unavailable.');
  }
  return value;
}
