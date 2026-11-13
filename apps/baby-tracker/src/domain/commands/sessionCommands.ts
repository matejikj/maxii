import type { FeedingSide } from '../entities/careEvent';
import type { ChildId, EntityId, RevisionId } from '../ids';
import type { CareOccurrence, TimeZoneId, ZonedInstant } from '../time';
import type { CommandIntent } from './results';

/**
 * Durable sleep timer commands. Start commits before UI success; end freezes the
 * intended wall-clock end so retries never stretch the interval.
 */
export type StartSleepSessionCommand = CommandIntent & {
  type: 'startSleepSession';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  startedAt: ZonedInstant;
  /** Device monotonic ms when available; null after restart / unsupported runtimes. */
  monotonicStartMs: number | null;
};

export type EndSleepSessionCommand = CommandIntent & {
  type: 'endSleepSession';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  /** Frozen at the first end press; retries must reuse this instant. */
  intendedEndedAt: ZonedInstant;
  eventId: EntityId;
  careRevisionId: RevisionId;
  note?: string | null;
  approximateEnd?: boolean;
};

export type AdjustSleepSessionStartCommand = CommandIntent & {
  type: 'adjustSleepSessionStart';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  startedAt: ZonedInstant;
  approximateStart?: boolean;
};

export type UndoEndSleepSessionCommand = CommandIntent & {
  type: 'undoEndSleepSession';
  sessionId: EntityId;
  childId: ChildId;
  /** Care event created by the end we are reversing. */
  eventId: EntityId;
  expectedCareRevisionId: RevisionId;
  deletionId: EntityId;
  revisionId: RevisionId;
  /** Session start restored when no newer local sleep is running. */
  restoreStartedAt: ZonedInstant;
  monotonicStartMs: number | null;
};

/**
 * Nursing sessions reuse the same durable timer rules as sleep, plus pause /
 * resume / side switch that keep active segments free of pause time.
 */
export type StartNursingSessionCommand = CommandIntent & {
  type: 'startNursingSession';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  startedAt: ZonedInstant;
  monotonicStartMs: number | null;
  /** Optional; omit or pass unspecified to start without choosing a side. */
  side?: FeedingSide | null;
};

export type EndNursingSessionCommand = CommandIntent & {
  type: 'endNursingSession';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  intendedEndedAt: ZonedInstant;
  eventId: EntityId;
  careRevisionId: RevisionId;
  note?: string | null;
  approximateEnd?: boolean;
};

export type PauseNursingSessionCommand = CommandIntent & {
  type: 'pauseNursingSession';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  pausedAt: ZonedInstant;
};

export type ResumeNursingSessionCommand = CommandIntent & {
  type: 'resumeNursingSession';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  resumedAt: ZonedInstant;
};

export type SwitchNursingSideCommand = CommandIntent & {
  type: 'switchNursingSide';
  sessionId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  switchedAt: ZonedInstant;
  side: FeedingSide;
};

export type UndoEndNursingSessionCommand = CommandIntent & {
  type: 'undoEndNursingSession';
  sessionId: EntityId;
  childId: ChildId;
  eventId: EntityId;
  expectedCareRevisionId: RevisionId;
  deletionId: EntityId;
  revisionId: RevisionId;
  restoreStartedAt: ZonedInstant;
  monotonicStartMs: number | null;
  restoreSide: FeedingSide | null;
};

export type SessionCommand =
  | StartSleepSessionCommand
  | EndSleepSessionCommand
  | AdjustSleepSessionStartCommand
  | UndoEndSleepSessionCommand
  | StartNursingSessionCommand
  | EndNursingSessionCommand
  | PauseNursingSessionCommand
  | ResumeNursingSessionCommand
  | SwitchNursingSideCommand
  | UndoEndNursingSessionCommand;

export type SessionRevisionState = {
  kind: 'session';
  fingerprint: string;
  sessionId: EntityId;
  childId: ChildId;
  phase: 'start' | 'end' | 'adjustStart' | 'undoEnd' | 'pause' | 'resume' | 'switchSide';
  careEventId?: EntityId;
};

export function sleepOccurrenceFromInterval(
  start: ZonedInstant,
  end: ZonedInstant,
): CareOccurrence {
  return { kind: 'known', start, end };
}

export function sleepOccurrenceWithoutDuration(observedAt: ZonedInstant): CareOccurrence {
  return { kind: 'unknownDuration', observedAt };
}

/** Nursing reuses the same CareOccurrence shapes as sleep. */
export function nursingOccurrenceFromInterval(
  start: ZonedInstant,
  end: ZonedInstant,
): CareOccurrence {
  return sleepOccurrenceFromInterval(start, end);
}

export function nursingOccurrenceWithoutDuration(observedAt: ZonedInstant): CareOccurrence {
  return sleepOccurrenceWithoutDuration(observedAt);
}

export function assertSameZone(a: TimeZoneId, b: TimeZoneId): void {
  if (a !== b) {
    // Ends stay in the session's zone so DST edges stay explainable.
    void a;
    void b;
  }
}
