import type { ChildId, IdGenerator, TimeZoneId, ZonedInstant } from '../../domain';
import { asEntityId, asOperationId, asRevisionId, zonedInstant } from '../../domain';
import type {
  AdjustSleepSessionStartCommand,
  EndSleepSessionCommand,
  StartSleepSessionCommand,
  UndoEndSleepSessionCommand,
} from '../../domain';

export function mintSleepIds(ids: IdGenerator) {
  return {
    operationId: asOperationId(ids.createId('op')),
    sessionId: asEntityId(ids.createId('ses')),
    revisionId: asRevisionId(ids.createId('rev')),
    eventId: asEntityId(ids.createId('evt')),
    careRevisionId: asRevisionId(ids.createId('rev')),
    deletionId: asEntityId(ids.createId('del')),
  };
}

/** Prefer performance.now() when the runtime exposes a stable origin for this process. */
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

export function buildStartSleepCommand(input: {
  ids: ReturnType<typeof mintSleepIds>;
  childId: ChildId;
  startedAt: ZonedInstant;
  intentCapturedAtMs: number;
  monotonicStartMs: number | null;
}): StartSleepSessionCommand {
  return {
    type: 'startSleepSession',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.ids.sessionId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    startedAt: input.startedAt,
    monotonicStartMs: input.monotonicStartMs,
  };
}

export function buildEndSleepCommand(input: {
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
}): EndSleepSessionCommand {
  return {
    type: 'endSleepSession',
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

export function buildAdjustSleepStartCommand(input: {
  ids: ReturnType<typeof mintSleepIds>;
  childId: ChildId;
  sessionId: ReturnType<typeof asEntityId>;
  startedAt: ZonedInstant;
  intentCapturedAtMs: number;
  approximateStart?: boolean;
}): AdjustSleepSessionStartCommand {
  return {
    type: 'adjustSleepSessionStart',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    sessionId: input.sessionId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    startedAt: input.startedAt,
    ...(input.approximateStart !== undefined ? { approximateStart: input.approximateStart } : {}),
  };
}

export function buildUndoEndSleepCommand(input: {
  ids: ReturnType<typeof mintSleepIds>;
  childId: ChildId;
  sessionId: ReturnType<typeof asEntityId>;
  eventId: ReturnType<typeof asEntityId>;
  expectedCareRevisionId: ReturnType<typeof asRevisionId>;
  restoreStartedAt: ZonedInstant;
  monotonicStartMs: number | null;
  intentCapturedAtMs: number;
}): UndoEndSleepSessionCommand {
  return {
    type: 'undoEndSleepSession',
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
  };
}

export function nowInZone(epochMs: number, timeZone: TimeZoneId): ZonedInstant {
  return zonedInstant({ epochMs }, timeZone);
}

/**
 * Human elapsed label (“38 min”, “1 h 12 min”). Avoids ambiguous MM:SS alone.
 */
export function formatElapsedUnits(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

/**
 * After a process restart we may lack monotonic continuity. If wall clock moved
 * backwards vs the stored start, surface uncertainty instead of a negative span.
 */
export function sleepClockUncertainty(input: {
  startedAtMs: number;
  nowMs: number;
  monotonicStartMs: number | null;
}): 'ok' | 'clock_moved_back' | 'monotonic_lost' {
  if (input.nowMs < input.startedAtMs) return 'clock_moved_back';
  if (input.monotonicStartMs == null) return 'monotonic_lost';
  return 'ok';
}
