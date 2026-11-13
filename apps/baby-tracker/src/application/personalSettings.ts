import type {
  LengthDisplayUnit,
  UnitOfWorkFactory,
  WeightDisplayUnit,
} from '../domain';
import { asChildId, asTimeZoneId, createChildProfile } from '../domain';

export const META_CHARACTER_MOTION = 'pref_character_motion_v1';
export const META_GUIDE_SPECIES = 'pref_guide_species_v1';
export const META_APPEARANCE_STYLE = 'pref_appearance_style_v1';
export const META_APP_MOTIF = 'pref_app_motif_v1';
export const META_REMINDER_PREFS = 'pref_reminders_v1';
export const META_BACKUP_HINT_SHOWN = 'pref_backup_hint_shown_v1';
export const META_GROWTH_UNITS = 'growth_display_units_v1';

/** Local collection available without a network download. */
export const LOCAL_GUIDE_SPECIES = [
  'rabbit',
  'bear',
  'fox',
  'otter',
  'hedgehog',
  'owl',
  'squirrel',
  'fawn',
  'tiger',
  'hippo',
] as const;

export type GuideSpecies = (typeof LOCAL_GUIDE_SPECIES)[number];

/** Look preference — never an age lock; forest remains the safe default. */
export const LOCAL_APPEARANCE_STYLES = ['forest', 'workshop', 'restrained'] as const;
export type AppearanceStyle = (typeof LOCAL_APPEARANCE_STYLES)[number];

/** App environment is independent of the guide's graphic treatment. */
export const LOCAL_APP_MOTIFS = ['forest', 'garden', 'playground'] as const;
export type AppMotif = (typeof LOCAL_APP_MOTIFS)[number];

export type ReminderPreferences = {
  dailyTogetherEnabled: boolean;
  dailyTogetherHour: number;
  dailyTogetherMinute: number;
  weeklyGlanceEnabled: boolean;
  weeklyGlanceWeekday: number;
  timeZone: string;
};

export type PersonalPreferences = {
  characterMotionEnabled: boolean;
  guideSpecies: GuideSpecies;
  appearanceStyle: AppearanceStyle;
  appMotif: AppMotif;
  reminders: ReminderPreferences;
  backupHintShown: boolean;
  weightUnit: WeightDisplayUnit;
  lengthUnit: LengthDisplayUnit;
};

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  dailyTogetherEnabled: false,
  dailyTogetherHour: 18,
  dailyTogetherMinute: 0,
  weeklyGlanceEnabled: false,
  weeklyGlanceWeekday: 0,
  timeZone: 'Europe/Prague',
};

export function defaultPersonalPreferences(timeZone: string): PersonalPreferences {
  return {
    characterMotionEnabled: true,
    guideSpecies: 'rabbit',
    appearanceStyle: 'forest',
    appMotif: 'forest',
    reminders: { ...DEFAULT_REMINDER_PREFERENCES, timeZone },
    backupHintShown: false,
    weightUnit: 'kg',
    lengthUnit: 'cm',
  };
}

export async function loadPersonalPreferences(
  unitOfWork: UnitOfWorkFactory,
  fallbackTimeZone: string,
): Promise<PersonalPreferences> {
  return unitOfWork.run(async (uow) => {
    const defaults = defaultPersonalPreferences(fallbackTimeZone);
    const motion = await uow.meta.get(META_CHARACTER_MOTION);
    const guide = await uow.meta.get(META_GUIDE_SPECIES);
    const appearance = await uow.meta.get(META_APPEARANCE_STYLE);
    const motif = await uow.meta.get(META_APP_MOTIF);
    const remindersRaw = await uow.meta.get(META_REMINDER_PREFS);
    const backupHint = await uow.meta.get(META_BACKUP_HINT_SHOWN);
    const unitsRaw = await uow.meta.get(META_GROWTH_UNITS);

    let reminders = defaults.reminders;
    if (remindersRaw) {
      try {
        reminders = normalizeReminders(JSON.parse(remindersRaw), fallbackTimeZone);
      } catch {
        reminders = defaults.reminders;
      }
    }

    let weightUnit = defaults.weightUnit;
    let lengthUnit = defaults.lengthUnit;
    if (unitsRaw) {
      try {
        const parsed = JSON.parse(unitsRaw) as { weightUnit?: string; lengthUnit?: string };
        if (parsed.weightUnit === 'kg' || parsed.weightUnit === 'lb') weightUnit = parsed.weightUnit;
        if (parsed.lengthUnit === 'cm' || parsed.lengthUnit === 'in') lengthUnit = parsed.lengthUnit;
      } catch {
        // keep defaults
      }
    }

    return {
      characterMotionEnabled: motion == null ? true : motion === '1',
      guideSpecies: isGuideSpecies(guide) ? guide : 'rabbit',
      appearanceStyle: isAppearanceStyle(appearance) ? appearance : 'forest',
      appMotif: isAppMotif(motif) ? motif : 'forest',
      reminders,
      backupHintShown: backupHint === '1',
      weightUnit,
      lengthUnit,
    };
  });
}

export async function setCharacterMotionEnabled(
  unitOfWork: UnitOfWorkFactory,
  enabled: boolean,
): Promise<void> {
  await unitOfWork.run((uow) => uow.meta.set(META_CHARACTER_MOTION, enabled ? '1' : '0'));
}

export async function setGuideSpecies(
  unitOfWork: UnitOfWorkFactory,
  species: GuideSpecies,
): Promise<void> {
  await unitOfWork.run((uow) => uow.meta.set(META_GUIDE_SPECIES, species));
}

export async function setAppearanceStyle(
  unitOfWork: UnitOfWorkFactory,
  style: AppearanceStyle,
): Promise<void> {
  await unitOfWork.run((uow) => uow.meta.set(META_APPEARANCE_STYLE, style));
}

export async function setAppMotif(unitOfWork: UnitOfWorkFactory, motif: AppMotif): Promise<void> {
  if (!isAppMotif(motif)) throw new RangeError('Neznámý motiv aplikace.');
  await unitOfWork.run((uow) => uow.meta.set(META_APP_MOTIF, motif));
}

export async function saveReminderPreferences(
  unitOfWork: UnitOfWorkFactory,
  prefs: ReminderPreferences,
): Promise<ReminderPreferences> {
  const normalized = normalizeReminders(prefs, prefs.timeZone);
  await unitOfWork.run((uow) => uow.meta.set(META_REMINDER_PREFS, JSON.stringify(normalized)));
  return normalized;
}

export async function markBackupHintShown(unitOfWork: UnitOfWorkFactory): Promise<void> {
  await unitOfWork.run((uow) => uow.meta.set(META_BACKUP_HINT_SHOWN, '1'));
}

export async function saveGrowthDisplayUnits(
  unitOfWork: UnitOfWorkFactory,
  units: { weightUnit: WeightDisplayUnit; lengthUnit: LengthDisplayUnit },
): Promise<void> {
  await unitOfWork.run((uow) =>
    uow.meta.set(
      META_GROWTH_UNITS,
      JSON.stringify({ weightUnit: units.weightUnit, lengthUnit: units.lengthUnit }),
    ),
  );
}

export async function updateSummaryTimeZone(
  unitOfWork: UnitOfWorkFactory,
  childId: string,
  timeZone: string,
): Promise<void> {
  const zone = asTimeZoneId(timeZone);
  await unitOfWork.run(async (uow) => {
    const profile = await uow.profiles.get(asChildId(childId));
    if (!profile) return;
    const next = createChildProfile({
      childId: profile.childId,
      displayName: profile.displayName,
      birthDate: profile.birthDate,
      summaryTimeZone: zone,
    });
    await uow.profiles.save(next);
  });
}

/**
 * After the first real care rows, show a single calm portable-backup hint.
 * Never repeats once acknowledged.
 */
export async function shouldShowBackupHint(
  unitOfWork: UnitOfWorkFactory,
): Promise<boolean> {
  return unitOfWork.run(async (uow) => {
    const shown = await uow.meta.get(META_BACKUP_HINT_SHOWN);
    if (shown === '1') return false;
    const profiles = await uow.profiles.list();
    for (const profile of profiles) {
      const recent = await uow.care.listRecent(profile.childId, 1);
      if (recent.length > 0) return true;
    }
    return false;
  });
}

function isGuideSpecies(value: string | null): value is GuideSpecies {
  return value != null && (LOCAL_GUIDE_SPECIES as readonly string[]).includes(value);
}

function isAppearanceStyle(value: string | null): value is AppearanceStyle {
  return value != null && (LOCAL_APPEARANCE_STYLES as readonly string[]).includes(value);
}

function isAppMotif(value: unknown): value is AppMotif {
  return typeof value === 'string' && (LOCAL_APP_MOTIFS as readonly string[]).includes(value);
}

function normalizeReminders(raw: ReminderPreferences, fallbackTimeZone: string): ReminderPreferences {
  const hour = clampInt(raw.dailyTogetherHour, 0, 23, 18);
  const minute = clampInt(raw.dailyTogetherMinute, 0, 59, 0);
  const weekday = clampInt(raw.weeklyGlanceWeekday, 0, 6, 0);
  return {
    dailyTogetherEnabled: Boolean(raw.dailyTogetherEnabled),
    dailyTogetherHour: hour,
    dailyTogetherMinute: minute,
    weeklyGlanceEnabled: Boolean(raw.weeklyGlanceEnabled),
    weeklyGlanceWeekday: weekday,
    timeZone: typeof raw.timeZone === 'string' && raw.timeZone.length > 0 ? raw.timeZone : fallbackTimeZone,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
