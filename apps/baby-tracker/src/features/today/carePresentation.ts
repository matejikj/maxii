import type { CareEvent, DiaperContents, TimeZoneId } from '../../domain';

export type LastCarePresentation = {
  eventId: string;
  title: string;
  detail: string;
  sortAtMs: number;
};

/** Same sort key the diary adapters use for timelines — care meaning, not write clock. */
export function careSortAtMs(event: CareEvent): number {
  switch (event.type) {
    case 'sleep':
    case 'nursing':
      return event.occurrence.kind === 'known'
        ? event.occurrence.start.instant.epochMs
        : event.occurrence.observedAt.instant.epochMs;
    case 'bottle':
    case 'food':
    case 'diaper':
    case 'note':
    case 'experience':
    case 'milestone':
      return event.occurredAt.instant.epochMs;
    case 'growth':
      return event.measuredOn.instant.epochMs;
  }
}

function diaperLabel(contents: DiaperContents): string {
  switch (contents) {
    case 'wet':
      return 'Mokrá plenka';
    case 'dirty':
      return 'Plenka se stolicí';
    case 'both':
      return 'Plenka — mokrá i stolice';
  }
}

function formatClock(epochMs: number, timeZone: TimeZoneId): string {
  try {
    return new Intl.DateTimeFormat('cs-CZ', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toISOString().slice(11, 16);
  }
}

/**
 * Prefer the care meaning time (occurred/start/measured). Unknown sleep end stays
 * “bez konce” — never invent a wake-up.
 */
export function presentCareEvent(event: CareEvent, timeZone: TimeZoneId): LastCarePresentation {
  const sortAtMs = careSortAtMs(event);
  const clock = formatClock(sortAtMs, timeZone);
  switch (event.type) {
    case 'diaper':
      return {
        eventId: event.eventId,
        title: diaperLabel(event.contents),
        detail: `v ${clock}`,
        sortAtMs,
      };
    case 'bottle': {
      const amountLabel =
        event.amount == null
          ? 'množství neuvedeno'
          : `${event.amount.value} ${event.amount.unit}`;
      return {
        eventId: event.eventId,
        title: 'Lahvička',
        detail: `v ${clock} · ${amountLabel}`,
        sortAtMs,
      };
    }
    case 'food': {
      const amountLabel =
        event.amount == null
          ? event.description
          : `${event.description} · ${event.amount.value} ${event.amount.unit}`;
      return {
        eventId: event.eventId,
        title: 'Jídlo',
        detail: `v ${clock} · ${amountLabel}`,
        sortAtMs,
      };
    }
    case 'growth': {
      const parts = [
        event.weightKg != null ? `${event.weightKg} kg` : null,
        event.lengthCm != null ? `${event.lengthCm} cm` : null,
        event.headCm != null ? `hlava ${event.headCm} cm` : null,
      ].filter(Boolean);
      return {
        eventId: event.eventId,
        title: 'Růst',
        detail: parts.length > 0 ? `měření ${clock} · ${parts.join(', ')}` : `měření ${clock}`,
        sortAtMs,
      };
    }
    case 'note':
      return {
        eventId: event.eventId,
        title: 'Poznámka',
        detail: `v ${clock} · ${event.body.slice(0, 80)}`,
        sortAtMs,
      };
    case 'experience':
      return {
        eventId: event.eventId,
        title: event.title?.trim() ? event.title : 'Zážitek',
        detail: `v ${clock}${event.area ? ` · ${event.area}` : ''}`,
        sortAtMs,
      };
    case 'milestone':
      return {
        eventId: event.eventId,
        title: 'Milník',
        detail: `v ${clock} · ${event.body.slice(0, 80)}`,
        sortAtMs,
      };
    case 'sleep':
      if (event.occurrence.kind === 'known') {
        const start = formatClock(event.occurrence.start.instant.epochMs, timeZone);
        const end = formatClock(event.occurrence.end.instant.epochMs, timeZone);
        return {
          eventId: event.eventId,
          title: 'Spánek',
          detail: `${start}–${end}`,
          sortAtMs,
        };
      }
      return {
        eventId: event.eventId,
        title: 'Spánek',
        detail: `začátek ${formatClock(event.occurrence.observedAt.instant.epochMs, timeZone)} · bez známého konce`,
        sortAtMs,
      };
    case 'nursing': {
      const side =
        event.side === 'left' ? 'levá' : event.side === 'right' ? 'pravá' : 'bez strany';
      if (event.occurrence.kind === 'known') {
        return {
          eventId: event.eventId,
          title: 'Kojení',
          detail: `od ${formatClock(event.occurrence.start.instant.epochMs, timeZone)} · ${side}`,
          sortAtMs,
        };
      }
      return {
        eventId: event.eventId,
        title: 'Kojení',
        detail: `pozorováno ${formatClock(event.occurrence.observedAt.instant.epochMs, timeZone)} · bez známé délky · ${side}`,
        sortAtMs,
      };
    }
  }
}

export function presentLastCare(
  events: readonly CareEvent[],
  timeZone: TimeZoneId,
): LastCarePresentation | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => careSortAtMs(b) - careSortAtMs(a));
  return presentCareEvent(sorted[0]!, timeZone);
}
