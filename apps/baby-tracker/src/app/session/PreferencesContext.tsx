import { loadBabyAvatar, saveBabyAvatar, type BabyAvatarVariant } from '../../application/babyAvatar';
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
  setAppMotif,
  setCharacterMotionEnabled,
  setGuideSpecies,
  shouldShowBackupHint,
  updateSummaryTimeZone,
  type AppearanceStyle,
  type AppMotif,
  type GuideSpecies,
  type PersonalPreferences,
  type ReminderPreferences,
} from '../../application';
import type { LengthDisplayUnit, WeightDisplayUnit } from '../../domain';
import { useBootstrap } from './BootstrapContext';

type PreferencesContextValue = {
  preferences: PersonalPreferences;
  ready: boolean;
  backupHintVisible: boolean;
  babyAvatar: BabyAvatarVariant;
  babyAvatarReady: boolean;
  setBabyAvatar: (variant: BabyAvatarVariant) => Promise<void>;
  refresh: () => Promise<void>;
  setMotionEnabled: (enabled: boolean) => Promise<void>;
  setGuide: (species: GuideSpecies) => Promise<void>;
  setAppearance: (style: AppearanceStyle) => Promise<void>;
  setMotif: (motif: AppMotif) => Promise<void>;
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
  const [baby, setBaby] = useState<{ childId: string; variant: BabyAvatarVariant } | null>(null);
  const [backupHintVisible, setBackupHintVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!runtime) return;
    const zone = profile?.settings.summaryTimeZone ?? 'Europe/Prague';
    const childId = profile?.childId;
    const [next, avatar] = await Promise.all([loadPersonalPreferences(runtime.unitOfWork, zone),
      childId ? loadBabyAvatar(runtime.unitOfWork, childId) : Promise.resolve('neutral' as const)]);
    if (childId) setBaby({ childId, variant: avatar });
    setPreferences(next);
    setReady(true);
    setBackupHintVisible(await shouldShowBackupHint(runtime.unitOfWork));
  }, [profile?.childId, profile?.settings.summaryTimeZone, runtime]);

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
      ready,
      backupHintVisible,
      babyAvatar: baby?.childId === profile?.childId ? baby?.variant ?? 'neutral' : 'neutral',
      babyAvatarReady: ready && baby?.childId === profile?.childId,
      async setBabyAvatar(variant) {
        if (!runtime || !profile) throw new Error('Profil ještě není připravený.');
        await saveBabyAvatar(runtime.unitOfWork, profile.childId, variant);
        setBaby({ childId: profile.childId, variant });
      },
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
      async setMotif(motif) {
        if (!runtime) throw new Error('Nastavení deníku ještě není připravené.');
        await setAppMotif(runtime.unitOfWork, motif);
        setPreferences((current) => ({ ...current, appMotif: motif }));
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
    [baby, backupHintVisible, preferences, profile, ready, refresh, runtime],
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
