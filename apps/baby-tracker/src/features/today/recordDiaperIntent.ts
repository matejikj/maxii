import type {
  ChildId,
  DiaperContents,
  IdGenerator,
  RecordDiaperCommand,
  RevisionId,
  TimeZoneId,
  ZonedInstant,
} from '../../domain';
import { asEntityId, asOperationId, asRevisionId, zonedInstant } from '../../domain';

export type DiaperIntentIds = {
  operationId: ReturnType<typeof asOperationId>;
  eventId: ReturnType<typeof asEntityId>;
  revisionId: RevisionId;
};

export function mintDiaperIds(ids: IdGenerator): DiaperIntentIds {
  return {
    operationId: asOperationId(ids.createId('op')),
    eventId: asEntityId(ids.createId('evt')),
    revisionId: asRevisionId(ids.createId('rev')),
  };
}

/**
 * Builds a create (or update when expectedRevisionId is set). Retries must reuse
 * the same ids and intentCapturedAt so double-submit cannot fork two diapers.
 */
export function buildRecordDiaperCommand(input: {
  ids: DiaperIntentIds;
  childId: ChildId;
  contents: DiaperContents;
  occurredAt: ZonedInstant;
  intentCapturedAtMs: number;
  note?: string | null;
  expectedRevisionId?: RevisionId;
}): RecordDiaperCommand {
  return {
    type: 'recordDiaper',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurredAt: input.occurredAt,
    contents: input.contents,
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.expectedRevisionId !== undefined
      ? { expectedRevisionId: input.expectedRevisionId }
      : {}),
  };
}

export function nowOccurrence(epochMs: number, timeZone: TimeZoneId): ZonedInstant {
  return zonedInstant({ epochMs }, timeZone);
}

/** Parses the explicit wall time field used by the detailed diaper form. */
export function parseWallDateTime(
  value: string,
  timeZone: TimeZoneId,
): { ok: true; occurredAt: ZonedInstant } | { ok: false; message: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return { ok: false, message: 'Zadejte čas jako RRRR-MM-DD HH:MM.' };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const asUtcGuess = Date.UTC(year, month - 1, day, hour, minute);
  if (!Number.isFinite(asUtcGuess)) {
    return { ok: false, message: 'Čas události není platný.' };
  }
  // Interpret digits in the child's summary zone via a formatter round-trip.
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    // Binary search a UTC instant whose zoned parts match the typed wall clock.
    let lo = asUtcGuess - 36 * 3_600_000;
    let hi = asUtcGuess + 36 * 3_600_000;
    for (let i = 0; i < 40; i += 1) {
      const mid = Math.floor((lo + hi) / 2);
      const parts = Object.fromEntries(
        formatter.formatToParts(new Date(mid)).map((part) => [part.type, part.value]),
      ) as Record<string, string>;
      const stamp = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
      const target = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      if (stamp === target) {
        return { ok: true, occurredAt: zonedInstant({ epochMs: mid }, timeZone) };
      }
      if (stamp < target) lo = mid + 1;
      else hi = mid - 1;
    }
  } catch {
    /* fall through */
  }
  return { ok: false, message: 'Čas se nepodařilo převést do zvolené zóny.' };
}

export function formatWallDateTime(epochMs: number, timeZone: TimeZoneId): string {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(epochMs))
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
  } catch {
    return new Date(epochMs).toISOString().slice(0, 16).replace('T', ' ');
  }
}
