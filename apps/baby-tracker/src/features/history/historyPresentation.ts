import {
  addCalendarDays,
  calendarDateFromParts,
  careSortAtMs,
  compareCareTimelineDesc,
  formatCalendarDate,
  parseCalendarDate,
  type CareEvent,
  type Draft,
  type TimeZoneId,
} from '../../domain';
import { formatIsoCalendarDate } from '../../app/navigation/historyTabState';
import { DEVELOPMENT_AREA_LABELS_CS } from '../../content';
import { presentCareEvent } from '../today/carePresentation';

export const HISTORY_EVENT_LABELS: Record<CareEvent['type'] | 'observation', string> = {
  sleep: 'Spánek',
  nursing: 'Kojení',
  bottle: 'Lahvička',
  food: 'Jídlo',
  diaper: 'Plenka',
  growth: 'Růst',
  note: 'Poznámka',
  experience: 'Zážitek',
  milestone: 'Milník',
  observation: 'Milník',
};

/** Only a complete, real date reaches the diary query. Typing is kept in the picker. */
export function parseHistoryDateInput(value: string): string | null {
  const text = value.trim();
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const date = parseCalendarDate(text);
      return date.year > 0 ? formatCalendarDate(date) : null;
    }
    const match = /^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})$/.exec(text);
    if (!match || Number(match[3]) < 1) return null;
    return formatCalendarDate(
      calendarDateFromParts(Number(match[3]), Number(match[2]), Number(match[1])),
    );
  } catch {
    return null;
  }
}

export function shiftHistoryDay(iso: string, delta: number): string {
  return formatCalendarDate(addCalendarDays(parseCalendarDate(iso), delta));
}

export function historyDateLabel(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

export function historyDayLabel(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Dnes';
  if (iso === shiftHistoryDay(todayIso, -1)) return 'Včera';
  return new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

export function historyClock(epochMs: number, zone: TimeZoneId): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zone,
  }).format(new Date(epochMs));
}

export function historyCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'záznam' : count >= 2 && count <= 4 ? 'záznamy' : 'záznamů'}`;
}

export function groupHistoryByDay(events: readonly CareEvent[], zone: TimeZoneId) {
  const groups = new Map<string, CareEvent[]>();
  for (const event of [...events].sort(compareCareTimelineDesc)) {
    const day = formatIsoCalendarDate(careSortAtMs(event), zone);
    const group = groups.get(day);
    if (group) group.push(event);
    else groups.set(day, [event]);
  }
  return [...groups].map(([day, rows]) => ({ day, events: rows }));
}

export function appendHistoryPage(
  previous: readonly CareEvent[],
  page: readonly CareEvent[],
): CareEvent[] {
  const seen = new Set(previous.map((event) => event.eventId));
  return [
    ...previous,
    ...page.filter((event) => {
      if (seen.has(event.eventId)) return false;
      seen.add(event.eventId);
      return true;
    }),
  ].sort(compareCareTimelineDesc);
}

export function presentHistoryEvent(event: CareEvent, zone: TimeZoneId) {
  const presentation = presentCareEvent(event, zone);
  const clock = historyClock(careSortAtMs(event), zone);
  const prefix = `v ${clock}`;
  let detail = presentation.detail.startsWith(prefix)
    ? presentation.detail.slice(prefix.length).replace(/^ · /, '')
    : presentation.detail;
  if (event.type === 'experience')
    detail = event.area ? DEVELOPMENT_AREA_LABELS_CS[event.area] : 'Společný zážitek';
  if ((event.type === 'sleep' || event.type === 'nursing') && event.occurrence.kind === 'known') {
    const endMs = event.occurrence.end.instant.epochMs;
    const endDay = formatIsoCalendarDate(endMs, zone);
    const startDay = formatIsoCalendarDate(presentation.sortAtMs, zone);
    detail = `${clock}–${historyClock(endMs, zone)}${endDay === startDay ? '' : ` · konec ${historyDateLabel(endDay)}`}`;
    if (event.type === 'nursing')
      detail += ` · ${event.side === 'left' ? 'levá' : event.side === 'right' ? 'pravá' : 'bez strany'}`;
  }
  return {
    ...presentation,
    clock,
    detail,
    note: event.type === 'note' || event.type === 'milestone' ? null : event.note,
  };
}

/** Human-readable draft fields; internal IDs and form implementation keys stay private. */
export function draftPreviewFields(draft: Draft): { label: string; value: string }[] {
  const fields: readonly [string, string][] = [
    ['wallTime', 'Čas události'],
    ['startWall', 'Začátek'],
    ['endWall', 'Konec'],
    ['body', 'Text'],
    ['title', 'Název'],
    ['description', 'Jídlo'],
    ['contents', 'Obsah'],
    ['amount', 'Množství'],
    ['unit', 'Jednotka'],
    ['side', 'Strana'],
    ['area', 'Oblast'],
    ['weightRaw', 'Hmotnost'],
    ['weightUnit', 'Jednotka hmotnosti'],
    ['lengthRaw', 'Délka'],
    ['lengthUnit', 'Jednotka délky'],
    ['headRaw', 'Obvod hlavy'],
    ['note', 'Poznámka'],
  ];
  const values: Record<string, string> = {
    wet: 'Mokrá',
    dirty: 'Stolice',
    both: 'Mokrá i stolice',
    formula: 'Umělé mléko',
    breastMilk: 'Mateřské mléko',
    mixed: 'Smíšené',
    other: 'Jiné',
    left: 'Levá',
    right: 'Pravá',
    unspecified: 'Neuvedeno',
    ...DEVELOPMENT_AREA_LABELS_CS,
  };
  return fields.flatMap(([key, label]) => {
    const raw = draft.payload[key];
    if ((typeof raw !== 'string' && typeof raw !== 'number') || String(raw).trim() === '')
      return [];
    const value = ['contents', 'side', 'area'].includes(key)
      ? (values[String(raw)] ?? String(raw))
      : String(raw);
    return [{ label, value }];
  });
}
