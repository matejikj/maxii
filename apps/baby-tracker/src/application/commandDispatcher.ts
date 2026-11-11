import {
  AppError,
  TRASH_RETENTION_MS,
  UNDO_WINDOW_MS,
  buildCareEventFromCommand,
  commandFailed,
  completeSessionWithDuration,
  fingerprintAdjustSleepStart,
  fingerprintCareWrite,
  fingerprintDraft,
  fingerprintEndNursing,
  fingerprintEndSleep,
  fingerprintPauseNursing,
  fingerprintRestore,
  fingerprintResumeNursing,
  fingerprintSoftDelete,
  fingerprintStartNursing,
  fingerprintStartSleep,
  fingerprintSwitchNursingSide,
  fingerprintUndoEndNursing,
  fingerprintUndoEndSleep,
  isAppError,
  nursingOccurrenceFromInterval,
  pauseNursingSession,
  resumeNursingSession,
  savedLocally,
  sleepOccurrenceFromInterval,
  startSession,
  switchNursingSide,
  zonedInstant,
  type AdjustSleepSessionStartCommand,
  type ApplicationCommand,
  type CareEvent,
  type CareMutationCommand,
  type CareWriteRevisionState,
  type Clock,
  type CommandResult,
  type DiscardDraftCommand,
  type DraftRevisionState,
  type EndNursingSessionCommand,
  type EndSleepSessionCommand,
  type EntityId,
  type FaultInjection,
  type Instant,
  type OperationId,
  type OperationReceipt,
  type OutboxPort,
  type PauseNursingSessionCommand,
  type PurgeExpiredTrashCommand,
  type RestoreCareCommand,
  type RestoreRevisionState,
  type ResumeNursingSessionCommand,
  type Revision,
  type RevisionId,
  type SaveDraftCommand,
  type SessionRevisionState,
  type SoftDeleteCareCommand,
  type SoftDeleteRevisionState,
  type SoftDeletedCarePayload,
  type StartNursingSessionCommand,
  type StartSleepSessionCommand,
  type SwitchNursingSideCommand,
  type TimeZoneId,
  type UndoCreateCareCommand,
  type UndoEndNursingSessionCommand,
  type UndoEndSleepSessionCommand,
  type UndoSoftDeleteCommand,
  type UnitOfWork,
  type UnitOfWorkFactory,
  asEntityId,
  asTimeZoneId,
} from '../domain';
import type { ReadModelTopic } from './readModelInvalidation';

export type UndoHandle = {
  availableUntil: Instant;
  kind: 'undoCreateCare' | 'undoSoftDelete' | 'undoEndSleep' | 'undoEndNursing';
  eventId: EntityId;
  basisOperationId: OperationId;
  sessionId?: EntityId;
};

export type DispatchSuccess = Extract<CommandResult, { ok: true }> & {
  topics: readonly ReadModelTopic[];
  undo: UndoHandle | null;
};

export type DispatchFailure = Extract<CommandResult, { ok: false }> & {
  topics: readonly [];
  undo: null;
};

export type DispatchResult = DispatchSuccess | DispatchFailure;

export type CommandDispatcher = {
  dispatch(command: ApplicationCommand): Promise<DispatchResult>;
};

export type DispatchMetricsSink = {
  record(event: {
    operation: string;
    ok: boolean;
    code: string;
    durationMs: number;
    platform: string;
  }): void;
};

export function createCommandDispatcher(deps: {
  unitOfWork: UnitOfWorkFactory;
  clock: Clock;
  faults?: FaultInjection;
  outbox?: OutboxPort;
  defaultTimeZone?: TimeZoneId;
  onCommitted?: (topics: readonly ReadModelTopic[]) => void;
  /** Optional local metrics — never receives care payloads. */
  metrics?: DispatchMetricsSink;
  metricsPlatform?: string;
}): CommandDispatcher {
  const faults = deps.faults;
  const defaultZone = deps.defaultTimeZone ?? asTimeZoneId('UTC');
  const metricsPlatform = deps.metricsPlatform ?? 'unknown';

  return {
    async dispatch(command) {
      const started = deps.clock.now().epochMs;
      try {
        const outcome: DispatchResult = await deps.unitOfWork.run(async (uow) => {
          const existing = await uow.revisions.findReceipt(command.operationId);
          if (existing) {
            return replayOrConflict(uow, command, existing);
          }

          switch (command.type) {
            case 'recordDiaper':
            case 'recordSleep':
            case 'recordBottle':
            case 'recordNursing':
            case 'recordFood':
            case 'recordGrowth':
            case 'recordNote':
            case 'recordExperience':
            case 'recordMilestone':
              return writeCare(uow, command, deps, faults, defaultZone);
            case 'startSleepSession':
              return startSleepSession(uow, command, deps, faults);
            case 'endSleepSession':
              return endSleepSession(uow, command, deps, faults, defaultZone);
            case 'adjustSleepSessionStart':
              return adjustSleepSessionStart(uow, command, deps, faults);
            case 'undoEndSleepSession':
              return undoEndSleepSession(uow, command, deps, faults);
            case 'startNursingSession':
              return startNursingSession(uow, command, deps, faults);
            case 'endNursingSession':
              return endNursingSession(uow, command, deps, faults, defaultZone);
            case 'pauseNursingSession':
              return pauseNursing(uow, command, deps, faults);
            case 'resumeNursingSession':
              return resumeNursing(uow, command, deps, faults);
            case 'switchNursingSide':
              return switchNursing(uow, command, deps, faults);
            case 'undoEndNursingSession':
              return undoEndNursingSession(uow, command, deps, faults);
            case 'softDeleteCare':
              return softDeleteCare(uow, command, deps, faults);
            case 'restoreCare':
              return restoreCare(uow, command, deps, faults);
            case 'saveDraft':
              return saveDraft(uow, command, deps, faults);
            case 'discardDraft':
              return discardDraft(uow, command, deps, faults);
            case 'undoCreateCare':
              return undoCreateCare(uow, command, deps, faults);
            case 'undoSoftDelete':
              return undoSoftDelete(uow, command, deps, faults);
            case 'purgeExpiredTrash':
              return purgeExpiredTrash(uow, command, deps, faults);
            default: {
              const _exhaustive: never = command;
              throw new AppError('INTERNAL', 'Unsupported application command', {
                details: { reason: 'command_type' },
              });
              void _exhaustive;
            }
          }
        });

        if (faults?.shouldFail('storage_after_commit')) {
          throw new AppError('STORAGE', 'Injected failure after durable commit', {
            details: { reason: 'storage_after_commit' },
            retryable: true,
          });
        }

        if (outcome.ok) {
          // Listeners refresh UI only — a thrown listener must not flip a durable
          // commit into a false save failure for the caregiver.
          try {
            deps.onCommitted?.(outcome.topics);
          } catch {
            /* ignore read-model listener faults */
          }
        }
        recordDispatchMetric(deps.metrics, {
          operation: command.type,
          outcome,
          durationMs: Math.max(0, deps.clock.now().epochMs - started),
          platform: metricsPlatform,
        });
        return outcome;
      } catch (error) {
        const appError = isAppError(error) ? error : wrapUnknownDispatchError(error);
        deps.metrics?.record({
          operation: command.type,
          ok: false,
          code: appError.code,
          durationMs: Math.max(0, deps.clock.now().epochMs - started),
          platform: metricsPlatform,
        });
        return {
          ...commandFailed(command, appError),
          topics: [],
          undo: null,
        };
      }
    },
  };
}

function recordDispatchMetric(
  metrics: DispatchMetricsSink | undefined,
  input: {
    operation: string;
    outcome: DispatchResult;
    durationMs: number;
    platform: string;
  },
): void {
  if (!metrics) return;
  if (input.outcome.ok) {
    metrics.record({
      operation: input.operation,
      ok: true,
      code: 'savedLocally',
      durationMs: input.durationMs,
      platform: input.platform,
    });
    return;
  }
  metrics.record({
    operation: input.operation,
    ok: false,
    code: input.outcome.error.code,
    durationMs: input.durationMs,
    platform: input.platform,
  });
}

async function startSleepSession(
  uow: UnitOfWork,
  command: StartSleepSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const existing = await uow.sessions.getActive(command.childId, 'sleep');
  if (existing) {
    throw new AppError('CONFLICT', 'A local sleep session is already running', {
      details: {
        reason: 'active_session_exists',
        sessionId: existing.sessionId,
        kind: 'sleep',
      },
    });
  }

  const fingerprint = fingerprintStartSleep(command);
  const completedAt = deps.clock.now();
  const session = startSession({
    sessionId: command.sessionId,
    childId: command.childId,
    kind: 'sleep',
    startedAt: command.startedAt,
    monotonicStartMs: command.monotonicStartMs,
  });
  await uow.sessions.save(session);
  maybeFault(faults, 'storage_after_entity');

  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'start',
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.sessionId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  // Start undo is “Upravit začátek” / open the running session — not a soft-delete.
  return success(receipt, ['sessions', 'revisions'], null);
}

async function endSleepSession(
  uow: UnitOfWork,
  command: EndSleepSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
  defaultZone: TimeZoneId,
): Promise<DispatchSuccess> {
  const active = await uow.sessions.getActive(command.childId, 'sleep');
  if (!active || active.sessionId !== command.sessionId) {
    throw new AppError('NOT_FOUND', 'Sleep session to end was not found', {
      details: { reason: 'session_missing' },
    });
  }
  if (active.kind !== 'sleep') {
    throw new AppError('VALIDATION', 'Only sleep sessions use this end command', {
      details: { reason: 'session_kind' },
    });
  }

  // Intended end is frozen on the command — never replace with clock.now() here.
  const completed = completeSessionWithDuration(active, command.intendedEndedAt);
  const occurrence = sleepOccurrenceFromInterval(completed.startedAt, completed.endedAt);
  const careCommand = {
    type: 'recordSleep' as const,
    operationId: command.operationId,
    intentCapturedAt: command.intentCapturedAt,
    eventId: command.eventId,
    revisionId: command.careRevisionId,
    childId: command.childId,
    occurrence,
    ...(command.note !== undefined ? { note: command.note } : {}),
  };
  const fingerprint = fingerprintEndSleep(command);
  const completedAt = deps.clock.now();
  const createdAt = zonedInstant(completedAt, completed.startedAt.timeZone ?? defaultZone);
  const event = buildCareEventFromCommand(careCommand, createdAt);

  await uow.care.save(event);
  await uow.sessions.save(completed);
  maybeFault(faults, 'storage_after_entity');

  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'end',
    careEventId: command.eventId,
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(
    command,
    completedAt,
    [command.sessionId, command.eventId],
    [command.revisionId, command.careRevisionId],
  );
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['care', 'sessions', 'revisions'], {
    availableUntil: { epochMs: completedAt.epochMs + UNDO_WINDOW_MS },
    kind: 'undoEndSleep',
    eventId: command.eventId,
    basisOperationId: command.operationId,
    sessionId: command.sessionId,
  });
}

async function adjustSleepSessionStart(
  uow: UnitOfWork,
  command: AdjustSleepSessionStartCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const active = await uow.sessions.getActive(command.childId, 'sleep');
  if (!active || active.sessionId !== command.sessionId || active.status !== 'running') {
    throw new AppError('NOT_FOUND', 'Running sleep session to edit was not found', {
      details: { reason: 'session_missing' },
    });
  }
  if (command.startedAt.instant.epochMs > deps.clock.now().epochMs) {
    throw new AppError('VALIDATION', 'Sleep start cannot be in the future', {
      details: { reason: 'future_start' },
    });
  }

  const fingerprint = fingerprintAdjustSleepStart(command);
  const completedAt = deps.clock.now();
  const next = startSession({
    sessionId: active.sessionId,
    childId: active.childId,
    kind: 'sleep',
    startedAt: command.startedAt,
    monotonicStartMs: active.monotonicStartMs,
  });
  await uow.sessions.save(next);
  maybeFault(faults, 'storage_after_entity');
  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'adjustStart',
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.sessionId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['sessions', 'revisions'], null);
}

async function undoEndSleepSession(
  uow: UnitOfWork,
  command: UndoEndSleepSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const clash = await uow.sessions.getActive(command.childId, 'sleep');
  if (clash && clash.sessionId !== command.sessionId) {
    // Never silently replace a newer local sleep with the restored one.
    throw new AppError('CONFLICT', 'Another local sleep session is already running', {
      details: {
        reason: 'active_session_exists',
        sessionId: clash.sessionId,
        kind: 'sleep',
      },
    });
  }

  const event = await uow.care.getById(command.eventId);
  if (!event) {
    throw new AppError('NOT_FOUND', 'Completed sleep event to undo was not found', {
      details: { reason: 'care_missing' },
    });
  }
  if (event.revisionId !== command.expectedCareRevisionId) {
    throw new AppError('CONFLICT', 'Sleep event changed since the end was recorded', {
      details: { reason: 'revision_conflict' },
    });
  }
  const existingTrash = await uow.revisions.findDeletionByEntityId(command.eventId);
  if (existingTrash) {
    throw new AppError('CONFLICT', 'Sleep event is already in trash', {
      details: { reason: 'already_deleted' },
    });
  }

  const fingerprint = fingerprintUndoEndSleep(command);
  const completedAt = deps.clock.now();
  await uow.care.delete(command.eventId);
  const restored = startSession({
    sessionId: command.sessionId,
    childId: command.childId,
    kind: 'sleep',
    startedAt: command.restoreStartedAt,
    monotonicStartMs: command.monotonicStartMs,
  });
  await uow.sessions.save(restored);
  maybeFault(faults, 'storage_after_entity');

  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'undoEnd',
    careEventId: command.eventId,
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  await uow.revisions.saveDeletion({
    deletionId: command.deletionId,
    entityId: command.eventId,
    entityType: event.type,
    deletedAt: completedAt,
    revisionId: command.revisionId,
    retainUntil: { epochMs: completedAt.epochMs + TRASH_RETENTION_MS },
    payload: { kind: 'careEvent', event } satisfies SoftDeletedCarePayload,
    payloadPurged: false,
  });
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(
    command,
    completedAt,
    [command.sessionId, command.eventId],
    [command.revisionId],
  );
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['care', 'sessions', 'revisions'], null);
}

async function startNursingSession(
  uow: UnitOfWork,
  command: StartNursingSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const existing = await uow.sessions.getActive(command.childId, 'nursing');
  if (existing) {
    throw new AppError('CONFLICT', 'A local nursing session is already running', {
      details: {
        reason: 'active_session_exists',
        sessionId: existing.sessionId,
        kind: 'nursing',
      },
    });
  }

  const fingerprint = fingerprintStartNursing(command);
  const completedAt = deps.clock.now();
  const session = startSession({
    sessionId: command.sessionId,
    childId: command.childId,
    kind: 'nursing',
    startedAt: command.startedAt,
    monotonicStartMs: command.monotonicStartMs,
    ...(command.side !== undefined ? { side: command.side } : {}),
  });
  await uow.sessions.save(session);
  maybeFault(faults, 'storage_after_entity');

  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'start',
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.sessionId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['sessions', 'revisions'], null);
}

async function endNursingSession(
  uow: UnitOfWork,
  command: EndNursingSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
  defaultZone: TimeZoneId,
): Promise<DispatchSuccess> {
  const active = await uow.sessions.getActive(command.childId, 'nursing');
  if (!active || active.sessionId !== command.sessionId) {
    throw new AppError('NOT_FOUND', 'Nursing session to end was not found', {
      details: { reason: 'session_missing' },
    });
  }
  if (active.kind !== 'nursing') {
    throw new AppError('VALIDATION', 'Only nursing sessions use this end command', {
      details: { reason: 'session_kind' },
    });
  }

  // Intended end is frozen on the command — never replace with clock.now() here.
  const completed = completeSessionWithDuration(active, command.intendedEndedAt);
  const occurrence = nursingOccurrenceFromInterval(completed.startedAt, completed.endedAt);
  const careCommand = {
    type: 'recordNursing' as const,
    operationId: command.operationId,
    intentCapturedAt: command.intentCapturedAt,
    eventId: command.eventId,
    revisionId: command.careRevisionId,
    childId: command.childId,
    occurrence,
    side: completed.side,
    activeSegments: completed.activeSegments,
    ...(command.note !== undefined ? { note: command.note } : {}),
  };
  const fingerprint = fingerprintEndNursing(command);
  const completedAt = deps.clock.now();
  const createdAt = zonedInstant(completedAt, completed.startedAt.timeZone ?? defaultZone);
  const event = buildCareEventFromCommand(careCommand, createdAt);

  await uow.care.save(event);
  await uow.sessions.save(completed);
  maybeFault(faults, 'storage_after_entity');

  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'end',
    careEventId: command.eventId,
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(
    command,
    completedAt,
    [command.sessionId, command.eventId],
    [command.revisionId, command.careRevisionId],
  );
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['care', 'sessions', 'revisions'], {
    availableUntil: { epochMs: completedAt.epochMs + UNDO_WINDOW_MS },
    kind: 'undoEndNursing',
    eventId: command.eventId,
    basisOperationId: command.operationId,
    sessionId: command.sessionId,
  });
}

async function pauseNursing(
  uow: UnitOfWork,
  command: PauseNursingSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const active = await uow.sessions.getActive(command.childId, 'nursing');
  if (!active || active.sessionId !== command.sessionId || active.status !== 'running') {
    throw new AppError('NOT_FOUND', 'Running nursing session to pause was not found', {
      details: { reason: 'session_missing' },
    });
  }
  const fingerprint = fingerprintPauseNursing(command);
  const completedAt = deps.clock.now();
  const next = pauseNursingSession(active, command.pausedAt);
  await uow.sessions.save(next);
  maybeFault(faults, 'storage_after_entity');
  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'pause',
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.sessionId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['sessions', 'revisions'], null);
}

async function resumeNursing(
  uow: UnitOfWork,
  command: ResumeNursingSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const active = await uow.sessions.getActive(command.childId, 'nursing');
  if (!active || active.sessionId !== command.sessionId || active.status !== 'paused') {
    throw new AppError('NOT_FOUND', 'Paused nursing session to resume was not found', {
      details: { reason: 'session_missing' },
    });
  }
  const fingerprint = fingerprintResumeNursing(command);
  const completedAt = deps.clock.now();
  const next = resumeNursingSession(active, command.resumedAt);
  await uow.sessions.save(next);
  maybeFault(faults, 'storage_after_entity');
  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'resume',
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.sessionId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['sessions', 'revisions'], null);
}

async function switchNursing(
  uow: UnitOfWork,
  command: SwitchNursingSideCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const active = await uow.sessions.getActive(command.childId, 'nursing');
  if (!active || active.sessionId !== command.sessionId || active.status !== 'running') {
    throw new AppError('NOT_FOUND', 'Running nursing session to switch side was not found', {
      details: { reason: 'session_missing' },
    });
  }
  const fingerprint = fingerprintSwitchNursingSide(command);
  const completedAt = deps.clock.now();
  const next = switchNursingSide(active, command.switchedAt, command.side);
  await uow.sessions.save(next);
  maybeFault(faults, 'storage_after_entity');
  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'switchSide',
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.sessionId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['sessions', 'revisions'], null);
}

async function undoEndNursingSession(
  uow: UnitOfWork,
  command: UndoEndNursingSessionCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const clash = await uow.sessions.getActive(command.childId, 'nursing');
  if (clash && clash.sessionId !== command.sessionId) {
    throw new AppError('CONFLICT', 'Another local nursing session is already running', {
      details: {
        reason: 'active_session_exists',
        sessionId: clash.sessionId,
        kind: 'nursing',
      },
    });
  }

  const event = await uow.care.getById(command.eventId);
  if (!event) {
    throw new AppError('NOT_FOUND', 'Completed nursing event to undo was not found', {
      details: { reason: 'care_missing' },
    });
  }
  if (event.revisionId !== command.expectedCareRevisionId) {
    throw new AppError('CONFLICT', 'Nursing event changed since the end was recorded', {
      details: { reason: 'revision_conflict' },
    });
  }
  const existingTrash = await uow.revisions.findDeletionByEntityId(command.eventId);
  if (existingTrash) {
    throw new AppError('CONFLICT', 'Nursing event is already in trash', {
      details: { reason: 'already_deleted' },
    });
  }

  const fingerprint = fingerprintUndoEndNursing(command);
  const completedAt = deps.clock.now();
  await uow.care.delete(command.eventId);
  const restored = startSession({
    sessionId: command.sessionId,
    childId: command.childId,
    kind: 'nursing',
    startedAt: command.restoreStartedAt,
    monotonicStartMs: command.monotonicStartMs,
    ...(command.restoreSide !== undefined ? { side: command.restoreSide } : {}),
  });
  await uow.sessions.save(restored);
  maybeFault(faults, 'storage_after_entity');

  const state: SessionRevisionState = {
    kind: 'session',
    fingerprint,
    sessionId: command.sessionId,
    childId: command.childId,
    phase: 'undoEnd',
    careEventId: command.eventId,
  };
  await uow.revisions.saveRevision(makeRevision(command, command.sessionId, completedAt, state));
  await uow.revisions.saveDeletion({
    deletionId: command.deletionId,
    entityId: command.eventId,
    entityType: event.type,
    deletedAt: completedAt,
    revisionId: command.revisionId,
    retainUntil: { epochMs: completedAt.epochMs + TRASH_RETENTION_MS },
    payload: { kind: 'careEvent', event } satisfies SoftDeletedCarePayload,
    payloadPurged: false,
  });
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(
    command,
    completedAt,
    [command.sessionId, command.eventId],
    [command.revisionId],
  );
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['care', 'sessions', 'revisions'], null);
}

async function writeCare(
  uow: UnitOfWork,
  command: CareMutationCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
  defaultZone: TimeZoneId,
): Promise<DispatchSuccess> {
  const fingerprint = fingerprintCareWrite(command);
  const completedAt = deps.clock.now();
  const createdAt = zonedInstant(completedAt, eventZone(command, defaultZone));
  const event = buildCareEventFromCommand(command, createdAt);

  if (command.expectedRevisionId) {
    const current = await uow.care.getById(command.eventId);
    if (!current) {
      throw new AppError('NOT_FOUND', 'Care event to update was not found', {
        details: { reason: 'care_missing' },
      });
    }
    if (current.revisionId !== command.expectedRevisionId) {
      throw new AppError('CONFLICT', 'Care event changed since the edit started', {
        details: { reason: 'revision_conflict' },
      });
    }
  } else {
    const existing = await uow.care.getById(command.eventId);
    if (existing) {
      throw new AppError('CONFLICT', 'Care event id already exists', {
        details: { reason: 'entity_exists' },
      });
    }
  }

  await uow.care.save(event);
  maybeFault(faults, 'storage_after_entity');

  const state: CareWriteRevisionState = { kind: 'careWrite', fingerprint, entity: event };
  await uow.revisions.saveRevision(makeRevision(command, event.eventId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');

  const receipt = makeReceipt(command, completedAt, [event.eventId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);

  return success(receipt, ['care', 'revisions'], {
    availableUntil: { epochMs: completedAt.epochMs + UNDO_WINDOW_MS },
    kind: 'undoCreateCare',
    eventId: event.eventId,
    basisOperationId: command.operationId,
  });
}

async function softDeleteCare(
  uow: UnitOfWork,
  command: SoftDeleteCareCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const fingerprint = fingerprintSoftDelete(command);
  const event = await uow.care.getById(command.eventId);
  if (!event) {
    throw new AppError('NOT_FOUND', 'Care event to delete was not found', {
      details: { reason: 'care_missing' },
    });
  }
  const existingTrash = await uow.revisions.findDeletionByEntityId(command.eventId);
  if (existingTrash) {
    throw new AppError('CONFLICT', 'Care event is already in trash', {
      details: { reason: 'already_deleted' },
    });
  }

  const completedAt = deps.clock.now();
  await uow.care.delete(command.eventId);
  maybeFault(faults, 'storage_after_entity');

  const state: SoftDeleteRevisionState = { kind: 'softDelete', fingerprint, entity: event };
  await uow.revisions.saveRevision(makeRevision(command, command.eventId, completedAt, state));
  await uow.revisions.saveDeletion({
    deletionId: command.deletionId,
    entityId: command.eventId,
    entityType: event.type,
    deletedAt: completedAt,
    revisionId: command.revisionId,
    retainUntil: { epochMs: completedAt.epochMs + TRASH_RETENTION_MS },
    payload: { kind: 'careEvent', event } satisfies SoftDeletedCarePayload,
    payloadPurged: false,
  });
  maybeFault(faults, 'storage_before_receipt');

  const receipt = makeReceipt(command, completedAt, [command.eventId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);

  return success(receipt, ['care', 'revisions'], {
    availableUntil: { epochMs: completedAt.epochMs + UNDO_WINDOW_MS },
    kind: 'undoSoftDelete',
    eventId: command.eventId,
    basisOperationId: command.operationId,
  });
}

async function restoreCare(
  uow: UnitOfWork,
  command: RestoreCareCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const fingerprint = fingerprintRestore(command);
  const marker = await uow.revisions.findDeletion(command.deletionId);
  if (!marker || marker.entityId !== command.eventId) {
    throw new AppError('NOT_FOUND', 'Trash item was not found', {
      details: { reason: 'trash_missing' },
    });
  }
  if (marker.revisionId !== command.expectedDeletionRevisionId) {
    throw new AppError('CONFLICT', 'Trash item changed since restore started', {
      details: { reason: 'revision_conflict' },
    });
  }
  if (marker.payloadPurged || marker.payload == null) {
    throw new AppError('NOT_FOUND', 'Trash payload was already purged', {
      details: { reason: 'payload_purged' },
    });
  }
  const completedAt = deps.clock.now();
  if (marker.retainUntil.epochMs < completedAt.epochMs) {
    throw new AppError('NOT_FOUND', 'Trash retention window has expired', {
      details: { reason: 'retention_expired' },
    });
  }
  const active = await uow.care.getById(command.eventId);
  if (active) {
    throw new AppError('CONFLICT', 'A newer care event already occupies this id', {
      details: { reason: 'entity_exists' },
    });
  }

  const payload = marker.payload as SoftDeletedCarePayload;
  const restored: CareEvent = { ...payload.event, revisionId: command.revisionId };
  await uow.care.save(restored);
  maybeFault(faults, 'storage_after_entity');
  await uow.revisions.removeDeletion(command.deletionId);

  const state: RestoreRevisionState = { kind: 'restore', fingerprint, entity: restored };
  await uow.revisions.saveRevision(makeRevision(command, command.eventId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');

  const receipt = makeReceipt(command, completedAt, [command.eventId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);

  return success(receipt, ['care', 'revisions'], null);
}

async function saveDraft(
  uow: UnitOfWork,
  command: SaveDraftCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const fingerprint = fingerprintDraft(command);
  const completedAt = deps.clock.now();
  await uow.drafts.save(command.draft);
  maybeFault(faults, 'storage_after_entity');

  const state: DraftRevisionState = {
    kind: 'draftSave',
    fingerprint,
    draftId: command.draft.draftId,
  };
  await uow.revisions.saveRevision(
    makeRevision(command, command.draft.draftId, completedAt, state),
  );
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.draft.draftId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['drafts', 'revisions'], null);
}

async function discardDraft(
  uow: UnitOfWork,
  command: DiscardDraftCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const completedAt = deps.clock.now();
  await uow.drafts.delete(command.draftId);
  maybeFault(faults, 'storage_after_entity');
  const state: DraftRevisionState = {
    kind: 'draftDiscard',
    fingerprint: `discard:${command.draftId}`,
    draftId: command.draftId,
  };
  await uow.revisions.saveRevision(makeRevision(command, command.draftId, completedAt, state));
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [command.draftId], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['drafts', 'revisions'], null);
}

async function undoCreateCare(
  uow: UnitOfWork,
  command: UndoCreateCareCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const event = await uow.care.getById(command.eventId);
  if (!event) {
    throw new AppError('NOT_FOUND', 'Created care event is no longer present', {
      details: { reason: 'care_missing' },
    });
  }
  if (event.revisionId !== command.expectedRevisionId) {
    throw new AppError('CONFLICT', 'A newer edit prevents undoing this create', {
      details: { reason: 'revision_conflict' },
    });
  }
  return softDeleteCare(
    uow,
    {
      type: 'softDeleteCare',
      operationId: command.operationId,
      intentCapturedAt: command.intentCapturedAt,
      eventId: command.eventId,
      deletionId: command.deletionId,
      revisionId: command.revisionId,
    },
    deps,
    faults,
  );
}

async function undoSoftDelete(
  uow: UnitOfWork,
  command: UndoSoftDeleteCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  return restoreCare(
    uow,
    {
      type: 'restoreCare',
      operationId: command.operationId,
      intentCapturedAt: command.intentCapturedAt,
      eventId: command.eventId,
      deletionId: command.deletionId,
      revisionId: command.revisionId,
      expectedDeletionRevisionId: command.expectedDeletionRevisionId,
    },
    deps,
    faults,
  );
}

async function purgeExpiredTrash(
  uow: UnitOfWork,
  command: PurgeExpiredTrashCommand,
  deps: { clock: Clock; outbox?: OutboxPort },
  faults: FaultInjection | undefined,
): Promise<DispatchSuccess> {
  const completedAt = deps.clock.now();
  const markers = await uow.revisions.listDeletions();
  const expired = markers.filter(
    (marker) => !marker.payloadPurged && marker.retainUntil.epochMs <= completedAt.epochMs,
  );
  for (const marker of expired) {
    await uow.revisions.saveDeletion({
      ...marker,
      payload: null,
      payloadPurged: true,
    });
  }
  maybeFault(faults, 'storage_after_entity');
  const state = { kind: 'purgeExpiredTrash' as const, purged: expired.length };
  await uow.revisions.saveRevision(
    makeRevision(command, asEntityId('system_trash_purge'), completedAt, state),
  );
  maybeFault(faults, 'storage_before_receipt');
  const receipt = makeReceipt(command, completedAt, [], [command.revisionId]);
  await uow.revisions.saveReceipt(receipt);
  await appendOutbox(deps.outbox, command.type, command.operationId, completedAt, state);
  return success(receipt, ['revisions'], null);
}

async function replayOrConflict(
  uow: UnitOfWork,
  command: ApplicationCommand,
  receipt: OperationReceipt,
): Promise<DispatchSuccess> {
  const revisionId = receipt.revisionIds[0];
  const expected = expectedFingerprint(command);
  if (expected != null && revisionId) {
    const revision = await uow.revisions.findRevision(revisionId);
    const actual =
      revision &&
      typeof revision.state === 'object' &&
      revision.state !== null &&
      'fingerprint' in revision.state
        ? String((revision.state as { fingerprint: string }).fingerprint)
        : null;
    if (actual != null && expected !== actual) {
      throw new AppError('CONFLICT', 'Same operation id was reused with a different body', {
        details: { reason: 'operation_body_mismatch' },
      });
    }
  }

  return {
    ...savedLocally(command, receipt.completedAt, receipt.entityIds, receipt.revisionIds),
    topics: [],
    undo: null,
  };
}

function expectedFingerprint(command: ApplicationCommand): string | null {
  switch (command.type) {
    case 'recordDiaper':
    case 'recordSleep':
    case 'recordBottle':
    case 'recordNursing':
    case 'recordFood':
    case 'recordGrowth':
    case 'recordNote':
    case 'recordExperience':
    case 'recordMilestone':
      return fingerprintCareWrite(command);
    case 'startSleepSession':
      return fingerprintStartSleep(command);
    case 'endSleepSession':
      return fingerprintEndSleep(command);
    case 'adjustSleepSessionStart':
      return fingerprintAdjustSleepStart(command);
    case 'undoEndSleepSession':
      return fingerprintUndoEndSleep(command);
    case 'startNursingSession':
      return fingerprintStartNursing(command);
    case 'endNursingSession':
      return fingerprintEndNursing(command);
    case 'pauseNursingSession':
      return fingerprintPauseNursing(command);
    case 'resumeNursingSession':
      return fingerprintResumeNursing(command);
    case 'switchNursingSide':
      return fingerprintSwitchNursingSide(command);
    case 'undoEndNursingSession':
      return fingerprintUndoEndNursing(command);
    case 'softDeleteCare':
      return fingerprintSoftDelete(command);
    case 'undoCreateCare':
      return fingerprintSoftDelete({
        type: 'softDeleteCare',
        operationId: command.operationId,
        intentCapturedAt: command.intentCapturedAt,
        eventId: command.eventId,
        deletionId: command.deletionId,
        revisionId: command.revisionId,
      });
    case 'restoreCare':
      return fingerprintRestore(command);
    case 'undoSoftDelete':
      return fingerprintRestore({
        type: 'restoreCare',
        operationId: command.operationId,
        intentCapturedAt: command.intentCapturedAt,
        eventId: command.eventId,
        deletionId: command.deletionId,
        revisionId: command.revisionId,
        expectedDeletionRevisionId: command.expectedDeletionRevisionId,
      });
    case 'saveDraft':
      return fingerprintDraft(command);
    case 'discardDraft':
    case 'purgeExpiredTrash':
      return null;
  }
}

function makeRevision(
  command: { operationId: OperationId; type: string; revisionId: RevisionId },
  entityId: EntityId,
  createdAt: Instant,
  state: unknown,
): Revision {
  return {
    revisionId: command.revisionId,
    entityId,
    operationId: command.operationId,
    parentRevisionIds: [],
    commandType: command.type,
    createdAt,
    deviceId: null,
    actorId: null,
    state,
  };
}

function makeReceipt(
  command: { operationId: OperationId; type: string; intentCapturedAt: Instant },
  completedAt: Instant,
  entityIds: EntityId[],
  revisionIds: RevisionId[],
): OperationReceipt {
  return {
    operationId: command.operationId,
    commandType: command.type,
    intentCapturedAt: command.intentCapturedAt,
    completedAt,
    entityIds,
    revisionIds,
    resultCode: 'savedLocally',
  };
}

function success(
  receipt: OperationReceipt,
  topics: ReadModelTopic[],
  undo: UndoHandle | null,
): DispatchSuccess {
  return {
    ...savedLocally(
      { operationId: receipt.operationId, intentCapturedAt: receipt.intentCapturedAt },
      receipt.completedAt,
      receipt.entityIds,
      receipt.revisionIds,
    ),
    topics,
    undo,
  };
}

function maybeFault(
  faults: FaultInjection | undefined,
  kind: 'storage_after_entity' | 'storage_before_receipt',
) {
  if (faults?.shouldFail(kind)) {
    throw new AppError('STORAGE', `Injected failure at ${kind}`, {
      details: { reason: kind },
      retryable: true,
    });
  }
}

/** Map raw SQLite/SQLCipher failures to allowlisted STORAGE reasons — never care text. */
function wrapUnknownDispatchError(error: unknown): AppError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  let reason = 'dispatch';
  let retryable = false;
  if (lower.includes('foreign key')) reason = 'foreign_key';
  else if (lower.includes('file is not a database') || lower.includes('notadb')) reason = 'sqlcipher';
  else if (lower.includes('no such table')) reason = 'schema_missing';
  else if (lower.includes('sqlite_full') || lower.includes('disk i/o') || lower.includes('database or disk is full')) {
    reason = 'storage_full';
    retryable = true;
  } else if (lower.includes('database is locked') || lower.includes('sqlite_busy') || lower.includes('locked')) {
    reason = 'storage_busy';
    retryable = true;
  }
  return new AppError('STORAGE', 'Command dispatch failed', {
    details: { reason },
    cause: error,
    retryable,
  });
}

async function appendOutbox(
  outbox: OutboxPort | undefined,
  commandType: string,
  operationId: OperationId,
  enqueuedAt: Instant,
  payload: unknown,
) {
  if (!outbox?.append) return;
  await outbox.append({ operationId, commandType, enqueuedAt, payload });
}

function eventZone(command: CareMutationCommand, fallback: TimeZoneId): TimeZoneId {
  switch (command.type) {
    case 'recordDiaper':
    case 'recordBottle':
    case 'recordFood':
    case 'recordNote':
    case 'recordExperience':
    case 'recordMilestone':
      return command.occurredAt.timeZone;
    case 'recordSleep':
    case 'recordNursing':
      return command.occurrence.kind === 'known'
        ? command.occurrence.start.timeZone
        : command.occurrence.observedAt.timeZone;
    case 'recordGrowth':
      return command.measuredOn.timeZone;
    default:
      return fallback;
  }
}
