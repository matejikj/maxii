import { AppError } from '../errors';
import type { ChildId, EntityId } from '../ids';
import type { FeedingSide } from './careEvent';
import type { EpochInterval, ZonedInstant } from '../time';
import { assertChronological } from '../time';

export type SessionKind = 'sleep' | 'nursing';

/**
 * Session lifecycle states are distinct schema variants. A null end must never
 * mean both "still running" and "completed without duration".
 */
export type RunningSession = {
  status: 'running';
  sessionId: EntityId;
  childId: ChildId;
  kind: SessionKind;
  startedAt: ZonedInstant;
  /** Monotonic reference captured at start for clock-skew checks while open. */
  monotonicStartMs: number | null;
  side: FeedingSide | null;
  activeSegments: EpochInterval[];
  /** Wall-clock start of the open active span; null only while paused. */
  currentSegmentStartedAtMs: number;
};

export type PausedNursingSession = {
  status: 'paused';
  sessionId: EntityId;
  childId: ChildId;
  kind: 'nursing';
  startedAt: ZonedInstant;
  monotonicStartMs: number | null;
  side: FeedingSide | null;
  activeSegments: EpochInterval[];
  pausedAt: ZonedInstant;
};

export type CompletedKnownDurationSession = {
  status: 'completedKnownDuration';
  sessionId: EntityId;
  childId: ChildId;
  kind: SessionKind;
  startedAt: ZonedInstant;
  endedAt: ZonedInstant;
  side: FeedingSide | null;
  activeSegments: EpochInterval[];
};

export type CompletedUnknownDurationSession = {
  status: 'completedUnknownDuration';
  sessionId: EntityId;
  childId: ChildId;
  kind: SessionKind;
  observedAt: ZonedInstant;
  side: FeedingSide | null;
};

export type ActiveSession = RunningSession | PausedNursingSession;
export type SessionRecord =
  | RunningSession
  | PausedNursingSession
  | CompletedKnownDurationSession
  | CompletedUnknownDurationSession;

export type SessionStatus = SessionRecord['status'];

const ALLOWED_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  running: ['paused', 'completedKnownDuration', 'completedUnknownDuration'],
  paused: ['running', 'completedKnownDuration', 'completedUnknownDuration'],
  completedKnownDuration: [],
  completedUnknownDuration: [],
};

export function assertSessionTransition(from: SessionStatus, to: SessionStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new AppError('CONFLICT', 'Session status transition is not allowed', {
      details: { from, to },
    });
  }
}

export function startSession(input: {
  sessionId: EntityId;
  childId: ChildId;
  kind: SessionKind;
  startedAt: ZonedInstant;
  monotonicStartMs?: number | null;
  side?: FeedingSide | null;
}): RunningSession {
  return {
    status: 'running',
    sessionId: input.sessionId,
    childId: input.childId,
    kind: input.kind,
    startedAt: input.startedAt,
    monotonicStartMs: input.monotonicStartMs ?? null,
    side: input.kind === 'nursing' ? (input.side ?? 'unspecified') : null,
    activeSegments: [],
    currentSegmentStartedAtMs: input.startedAt.instant.epochMs,
  };
}

export function pauseNursingSession(
  session: RunningSession,
  pausedAt: ZonedInstant,
): PausedNursingSession {
  if (session.kind !== 'nursing') {
    throw new AppError('VALIDATION', 'Only nursing sessions can pause', {
      details: { reason: 'pause_kind' },
    });
  }
  assertSessionTransition(session.status, 'paused');
  assertChronological(session.startedAt.instant, pausedAt.instant);
  if (pausedAt.instant.epochMs < session.currentSegmentStartedAtMs) {
    throw new AppError('VALIDATION', 'Pause cannot precede the open nursing segment', {
      details: { reason: 'pause_order' },
    });
  }

  return {
    status: 'paused',
    sessionId: session.sessionId,
    childId: session.childId,
    kind: 'nursing',
    startedAt: session.startedAt,
    monotonicStartMs: session.monotonicStartMs,
    side: session.side,
    activeSegments: [
      ...session.activeSegments,
      {
        startMs: session.currentSegmentStartedAtMs,
        endMs: pausedAt.instant.epochMs,
      },
    ],
    pausedAt,
  };
}

export function resumeNursingSession(
  session: PausedNursingSession,
  resumedAt: ZonedInstant,
): RunningSession {
  assertSessionTransition(session.status, 'running');
  assertChronological(session.pausedAt.instant, resumedAt.instant);
  return {
    status: 'running',
    sessionId: session.sessionId,
    childId: session.childId,
    kind: 'nursing',
    startedAt: session.startedAt,
    monotonicStartMs: session.monotonicStartMs,
    side: session.side,
    activeSegments: session.activeSegments,
    currentSegmentStartedAtMs: resumedAt.instant.epochMs,
  };
}

/**
 * Close the open nursing segment and open a new one on the chosen side in one
 * transition — never leave two overlapping active spans.
 */
export function switchNursingSide(
  session: RunningSession,
  switchedAt: ZonedInstant,
  side: FeedingSide,
): RunningSession {
  if (session.kind !== 'nursing') {
    throw new AppError('VALIDATION', 'Only nursing sessions can switch side', {
      details: { reason: 'side_kind' },
    });
  }
  assertChronological(session.startedAt.instant, switchedAt.instant);
  if (switchedAt.instant.epochMs < session.currentSegmentStartedAtMs) {
    throw new AppError('VALIDATION', 'Side switch cannot precede the open nursing segment', {
      details: { reason: 'side_order' },
    });
  }
  return {
    status: 'running',
    sessionId: session.sessionId,
    childId: session.childId,
    kind: 'nursing',
    startedAt: session.startedAt,
    monotonicStartMs: session.monotonicStartMs,
    side,
    activeSegments: [
      ...session.activeSegments,
      {
        startMs: session.currentSegmentStartedAtMs,
        endMs: switchedAt.instant.epochMs,
      },
    ],
    currentSegmentStartedAtMs: switchedAt.instant.epochMs,
  };
}

export function completeSessionWithDuration(
  session: ActiveSession,
  endedAt: ZonedInstant,
): CompletedKnownDurationSession {
  assertSessionTransition(session.status, 'completedKnownDuration');
  assertChronological(session.startedAt.instant, endedAt.instant);

  let activeSegments: EpochInterval[];
  if (session.status === 'running') {
    if (session.kind === 'sleep') {
      activeSegments = [
        {
          startMs: session.startedAt.instant.epochMs,
          endMs: endedAt.instant.epochMs,
        },
      ];
    } else {
      activeSegments = [
        ...session.activeSegments,
        {
          startMs: session.currentSegmentStartedAtMs,
          endMs: endedAt.instant.epochMs,
        },
      ];
    }
  } else {
    activeSegments = session.activeSegments;
  }

  return {
    status: 'completedKnownDuration',
    sessionId: session.sessionId,
    childId: session.childId,
    kind: session.kind,
    startedAt: session.startedAt,
    endedAt,
    side: session.side,
    activeSegments,
  };
}

export function completeSessionUnknownDuration(
  session: ActiveSession,
  observedAt: ZonedInstant,
): CompletedUnknownDurationSession {
  assertSessionTransition(session.status, 'completedUnknownDuration');
  return {
    status: 'completedUnknownDuration',
    sessionId: session.sessionId,
    childId: session.childId,
    kind: session.kind,
    observedAt,
    side: session.side,
  };
}

export { ALLOWED_TRANSITIONS as SESSION_TRANSITIONS };
