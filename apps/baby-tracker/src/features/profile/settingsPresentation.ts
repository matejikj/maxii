import type { GuideSpecies } from '../../application';

export const GUIDE_NAMES: Record<GuideSpecies, { name: string; animal: string }> = {
  rabbit: { name: 'Lumi', animal: 'Králík' }, bear: { name: 'Momo', animal: 'Medvěd' },
  fox: { name: 'Nori', animal: 'Liška' }, otter: { name: 'Kiko', animal: 'Vydra' },
  hedgehog: { name: 'Piko', animal: 'Ježek' }, owl: { name: 'Eli', animal: 'Sova' },
  squirrel: { name: 'Tili', animal: 'Veverka' }, fawn: { name: 'Runi', animal: 'Koloušek' },
};
export const SETTINGS_SECTIONS = [
  { id: 'appearance', title: 'Vzhled a průvodce', description: 'Váš svět, postavička a pohyb', icon: 'development', group: 'personal' },
  { id: 'children', title: 'Dítě a rodina', description: 'Přezdívka, narozeniny a další děti', icon: 'care', group: 'personal' },
  { id: 'reminders', title: 'Připomínky', description: 'Čas na společné chvíle', icon: 'today', group: 'personal' },
  { id: 'units', title: 'Jednotky a čas', description: 'Měření růstu a časové pásmo', icon: 'growth', group: 'personal' },
  { id: 'backup', title: 'Zálohy a fotografie', description: 'Uchování vzpomínek a místo v zařízení', icon: 'experience', group: 'data' },
  { id: 'privacy', title: 'Soukromí a zabezpečení', description: 'Zámek aplikace a správa místních dat', icon: 'care', group: 'data' },
  { id: 'help', title: 'Pomoc a informace', description: 'Jak se ukládají data a podklady pro podporu', icon: 'history', group: 'data' },
] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number]['id'];

/** Route parameters can originate in a deep link; unknown sections open the hub. */
export function resolveSettingsSection(value: unknown): SettingsSection | null {
  return SETTINGS_SECTIONS.some((section) => section.id === value) ? value as SettingsSection : null;
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
/** Validate before persisting: blank or malformed input must never silently become midnight. */
export function parseReminderTime(raw: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error('Zadejte čas od 00:00 do 23:59, například 18:30.');
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}
