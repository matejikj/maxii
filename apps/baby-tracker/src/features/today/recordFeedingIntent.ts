import type {
  BottleContents,
  ChildId,
  FeedingSide,
  IdGenerator,
  MeasuredQuantity,
  QuantityUnit,
  TimeZoneId,
  ZonedInstant,
} from '../../domain';
import {
  asEntityId,
  asOperationId,
  asRevisionId,
  nursingOccurrenceFromInterval,
  nursingOccurrenceWithoutDuration,
  zonedInstant,
} from '../../domain';
import type {
  EndNursingSessionCommand,
  PauseNursingSessionCommand,
  RecordBottleCommand,
  RecordFoodCommand,
  RecordNursingCommand,
  ResumeNursingSessionCommand,
  StartNursingSessionCommand,
  SwitchNursingSideCommand,
  UndoEndNursingSessionCommand,
} from '../../domain';
import type { QuantityUnitOption } from '../ui';

export function mintFeedingIds(ids: IdGenerator) {
  return {
    operationId: asOperationId(ids.createId('op')),
    sessionId: asEntityId(ids.createId('ses')),
    revisionId: asRevisionId(ids.createId('rev')),
    eventId: asEntityId(ids.createId('evt')),
    careRevisionId: asRevisionId(ids.createId('rev')),
    deletionId: asEntityId(ids.createId('del')),
  };
}

export type FeedingIntentIds = ReturnType<typeof mintFeedingIds>;

/** Accept Czech decimal comma; empty means unknown amount, not zero. */
export function parseMeasuredAmount(
  raw: string,
  unit: QuantityUnitOption,
):
  | { ok: true; amount: MeasuredQuantity }
  | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, amount: null };
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return {
      ok: false,
      message: 'Množství zadejte číslem. Desetinná čárka je v pořádku.',
    };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, message: 'Množství musí být nezáporné číslo.' };
  }
  return { ok: true, amount: { value, unit: unit as QuantityUnit } };
}

export function captureMonotonicStartMs(): number | null {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch {
    /* unavailable */
  }
  return null;
}

export function nowInZone(epochMs: number, timeZone: TimeZoneId): ZonedInstant {
  return zonedInstant({ epochMs }, timeZone);
}

export function buildStartNursingCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  startedAt: ZonedInstant;
  intentCapturedAtMs: number;
  monotonicStartMs: number | null;
  side?: FeedingSide | null;
}): StartNursingSessionCommand {
  return {
    type: 'startNursingSession',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.ids.sessionId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    startedAt: input.startedAt,
    monotonicStartMs: input.monotonicStartMs,
    ...(input.side !== undefined ? { side: input.side } : {}),
  };
}

export function buildEndNursingCommand(input: {
  operationId: ReturnType<typeof asOperationId>;
  revisionId: ReturnType<typeof asRevisionId>;
  sessionId: ReturnType<typeof asEntityId>;
  eventId: ReturnType<typeof asEntityId>;
  careRevisionId: ReturnType<typeof asRevisionId>;
  childId: ChildId;
  intendedEndedAt: ZonedInstant;
  intentCapturedAtMs: number;
  note?: string | null;
  approximateEnd?: boolean;
}): EndNursingSessionCommand {
  return {
    type: 'endNursingSession',
    operationId: input.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.sessionId,
    revisionId: input.revisionId,
    childId: input.childId,
    intendedEndedAt: input.intendedEndedAt,
    eventId: input.eventId,
    careRevisionId: input.careRevisionId,
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.approximateEnd !== undefined ? { approximateEnd: input.approximateEnd } : {}),
  };
}

export function buildPauseNursingCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  sessionId: ReturnType<typeof asEntityId>;
  pausedAt: ZonedInstant;
  intentCapturedAtMs: number;
}): PauseNursingSessionCommand {
  return {
    type: 'pauseNursingSession',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.sessionId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    pausedAt: input.pausedAt,
  };
}

export function buildResumeNursingCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  sessionId: ReturnType<typeof asEntityId>;
  resumedAt: ZonedInstant;
  intentCapturedAtMs: number;
}): ResumeNursingSessionCommand {
  return {
    type: 'resumeNursingSession',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.sessionId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    resumedAt: input.resumedAt,
  };
}

export function buildSwitchNursingSideCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  sessionId: ReturnType<typeof asEntityId>;
  switchedAt: ZonedInstant;
  side: FeedingSide;
  intentCapturedAtMs: number;
}): SwitchNursingSideCommand {
  return {
    type: 'switchNursingSide',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.sessionId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    switchedAt: input.switchedAt,
    side: input.side,
  };
}

export function buildUndoEndNursingCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  sessionId: ReturnType<typeof asEntityId>;
  eventId: ReturnType<typeof asEntityId>;
  expectedCareRevisionId: ReturnType<typeof asRevisionId>;
  restoreStartedAt: ZonedInstant;
  monotonicStartMs: number | null;
  restoreSide: FeedingSide | null;
  intentCapturedAtMs: number;
}): UndoEndNursingSessionCommand {
  return {
    type: 'undoEndNursingSession',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.sessionId,
    childId: input.childId,
    eventId: input.eventId,
    expectedCareRevisionId: input.expectedCareRevisionId,
    deletionId: input.ids.deletionId,
    revisionId: input.ids.revisionId,
    restoreStartedAt: input.restoreStartedAt,
    monotonicStartMs: input.monotonicStartMs,
    restoreSide: input.restoreSide,
  };
}

export function buildRecordBottleCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  occurredAt: ZonedInstant;
  contents: BottleContents;
  intentCapturedAtMs: number;
  amount?: MeasuredQuantity;
  note?: string | null;
  expectedRevisionId?: ReturnType<typeof asRevisionId>;
}): RecordBottleCommand & { expectedRevisionId?: ReturnType<typeof asRevisionId> } {
  return {
    type: 'recordBottle',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurredAt: input.occurredAt,
    contents: input.contents,
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.expectedRevisionId !== undefined
      ? { expectedRevisionId: input.expectedRevisionId }
      : {}),
  };
}

export function buildRecordFoodCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  occurredAt: ZonedInstant;
  description: string;
  intentCapturedAtMs: number;
  amount?: MeasuredQuantity;
  note?: string | null;
  expectedRevisionId?: ReturnType<typeof asRevisionId>;
}): RecordFoodCommand & { expectedRevisionId?: ReturnType<typeof asRevisionId> } {
  return {
    type: 'recordFood',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurredAt: input.occurredAt,
    description: input.description,
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.expectedRevisionId !== undefined
      ? { expectedRevisionId: input.expectedRevisionId }
      : {}),
  };
}

export function buildRecordNursingPastCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  start: ZonedInstant;
  end: ZonedInstant;
  intentCapturedAtMs: number;
  side?: FeedingSide | null;
  note?: string | null;
}): RecordNursingCommand {
  return {
    type: 'recordNursing',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurrence: nursingOccurrenceFromInterval(input.start, input.end),
    activeSegments: [
      {
        startMs: input.start.instant.epochMs,
        endMs: input.end.instant.epochMs,
      },
    ],
    ...(input.side !== undefined ? { side: input.side } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  };
}

export function buildRecordNursingNoDurationCommand(input: {
  ids: FeedingIntentIds;
  childId: ChildId;
  observedAt: ZonedInstant;
  intentCapturedAtMs: number;
  side?: FeedingSide | null;
  note?: string | null;
}): RecordNursingCommand {
  return {
    type: 'recordNursing',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurrence: nursingOccurrenceWithoutDuration(input.observedAt),
    activeSegments: null,
    ...(input.side !== undefined ? { side: input.side } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
  };
}

/** Active nursing elapsed excludes closed pauses and the open segment start. */
export function nursingElapsedMs(input: {
  status: 'running' | 'paused';
  activeSegments: readonly { startMs: number; endMs: number }[];
  currentSegmentStartedAtMs?: number;
  nowMs: number;
}): number {
  let closed = 0;
  for (const segment of input.activeSegments) {
    closed += Math.max(0, segment.endMs - segment.startMs);
  }
  if (input.status === 'running' && input.currentSegmentStartedAtMs != null) {
    closed += Math.max(0, input.nowMs - input.currentSegmentStartedAtMs);
  }
  return closed;
}

export function sideLabel(side: FeedingSide | null | undefined): string {
  switch (side) {
    case 'left':
      return 'Levá';
    case 'right':
      return 'Pravá';
    default:
      return 'Bez strany';
  }
}
