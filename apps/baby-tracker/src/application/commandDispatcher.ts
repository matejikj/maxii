import {
  AppError,
  TRASH_RETENTION_MS,
  UNDO_WINDOW_MS,
  buildCareEventFromCommand,
  commandFailed,
  fingerprintCareWrite,
  fingerprintDraft,
  fingerprintRestore,
  fingerprintSoftDelete,
  isAppError,
  savedLocally,
  zonedInstant,
  type ApplicationCommand,
  type CareEvent,
  type CareMutationCommand,
  type CareWriteRevisionState,
  type Clock,
  type CommandResult,
  type DiscardDraftCommand,
  type DraftRevisionState,
  type EntityId,
  type FaultInjection,
  type Instant,
  type OperationId,
  type OperationReceipt,
  type OutboxPort,
  type PurgeExpiredTrashCommand,
  type RestoreCareCommand,
  type RestoreRevisionState,
  type Revision,
  type RevisionId,
  type SaveDraftCommand,
  type SoftDeleteCareCommand,
  type SoftDeleteRevisionState,
  type SoftDeletedCarePayload,
  type TimeZoneId,
  type UndoCreateCareCommand,
  type UndoSoftDeleteCommand,
  type UnitOfWork,
  type UnitOfWorkFactory,
  asEntityId,
  asTimeZoneId,
} from '../domain';
import type { ReadModelTopic } from './readModelInvalidation';

export type UndoHandle = {
  availableUntil: Instant;
  kind: 'undoCreateCare' | 'undoSoftDelete';
  eventId: EntityId;
  basisOperationId: OperationId;
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

export function createCommandDispatcher(deps: {
  unitOfWork: UnitOfWorkFactory;
  clock: Clock;
  faults?: FaultInjection;
  outbox?: OutboxPort;
  defaultTimeZone?: TimeZoneId;
  onCommitted?: (topics: readonly ReadModelTopic[]) => void;
}): CommandDispatcher {
  const faults = deps.faults;
  const defaultZone = deps.defaultTimeZone ?? asTimeZoneId('UTC');

  return {
    async dispatch(command) {
      try {
        const outcome = await deps.unitOfWork.run(async (uow) => {
          const existing = await uow.revisions.findReceipt(command.operationId);
          if (existing) {
            return replayOrConflict(uow, command, existing);
          }

          switch (command.type) {
            case 'recordDiaper':
            case 'recordSleep':
            case 'recordBottle':
            case 'recordGrowth':
              return writeCare(uow, command, deps, faults, defaultZone);
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
          deps.onCommitted?.(outcome.topics);
        }
        return outcome;
      } catch (error) {
        const appError = isAppError(error)
          ? error
          : new AppError('INTERNAL', 'Command dispatch failed', {
              details: { reason: 'dispatch' },
              cause: error,
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
    case 'recordGrowth':
      return fingerprintCareWrite(command);
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
      return command.occurredAt.timeZone;
    case 'recordSleep':
      return command.occurrence.kind === 'known'
        ? command.occurrence.start.timeZone
        : command.occurrence.observedAt.timeZone;
    case 'recordGrowth':
      return command.measuredOn.timeZone;
    default:
      return fallback;
  }
}
