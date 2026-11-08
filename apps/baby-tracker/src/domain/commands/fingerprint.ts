import type { CareWriteCommand } from './careCommands';
import type {
  CareMutationCommand,
  SoftDeleteCareCommand,
  RestoreCareCommand,
  SaveDraftCommand,
} from './lifecycleCommands';
import type {
  AdjustSleepSessionStartCommand,
  EndSleepSessionCommand,
  StartSleepSessionCommand,
  UndoEndSleepSessionCommand,
} from './sessionCommands';

/**
 * Stable request body fingerprint for idempotent retries. Same operationId with
 * a different fingerprint is a conflict, not a silent overwrite.
 */
export function fingerprintCareWrite(command: CareMutationCommand): string {
  return stableStringify({
    type: command.type,
    eventId: command.eventId,
    revisionId: command.revisionId,
    childId: command.childId,
    expectedRevisionId: command.expectedRevisionId ?? null,
    body: careBody(command),
  });
}

export function fingerprintSoftDelete(command: SoftDeleteCareCommand): string {
  return stableStringify({
    type: command.type,
    eventId: command.eventId,
    deletionId: command.deletionId,
    revisionId: command.revisionId,
  });
}

export function fingerprintRestore(command: RestoreCareCommand): string {
  return stableStringify({
    type: command.type,
    eventId: command.eventId,
    deletionId: command.deletionId,
    revisionId: command.revisionId,
    expectedDeletionRevisionId: command.expectedDeletionRevisionId,
  });
}

export function fingerprintDraft(command: SaveDraftCommand): string {
  return stableStringify({
    type: command.type,
    draftId: command.draft.draftId,
    updatedAtMs: command.draft.updatedAt.epochMs,
    payload: command.draft.payload,
  });
}

export function fingerprintStartSleep(command: StartSleepSessionCommand): string {
  return stableStringify({
    type: command.type,
    sessionId: command.sessionId,
    childId: command.childId,
    startedAtMs: command.startedAt.instant.epochMs,
    timeZone: command.startedAt.timeZone,
    monotonicStartMs: command.monotonicStartMs,
  });
}

export function fingerprintEndSleep(command: EndSleepSessionCommand): string {
  return stableStringify({
    type: command.type,
    sessionId: command.sessionId,
    childId: command.childId,
    intendedEndedAtMs: command.intendedEndedAt.instant.epochMs,
    eventId: command.eventId,
    careRevisionId: command.careRevisionId,
    note: command.note ?? null,
    approximateEnd: command.approximateEnd ?? false,
  });
}

export function fingerprintAdjustSleepStart(command: AdjustSleepSessionStartCommand): string {
  return stableStringify({
    type: command.type,
    sessionId: command.sessionId,
    childId: command.childId,
    startedAtMs: command.startedAt.instant.epochMs,
    approximateStart: command.approximateStart ?? false,
  });
}

export function fingerprintUndoEndSleep(command: UndoEndSleepSessionCommand): string {
  return stableStringify({
    type: command.type,
    sessionId: command.sessionId,
    childId: command.childId,
    eventId: command.eventId,
    expectedCareRevisionId: command.expectedCareRevisionId,
    deletionId: command.deletionId,
  });
}

function careBody(command: CareWriteCommand): unknown {
  switch (command.type) {
    case 'recordDiaper':
      return {
        occurredAtMs: command.occurredAt.instant.epochMs,
        contents: command.contents,
        note: command.note ?? null,
      };
    case 'recordSleep':
      return {
        occurrence: command.occurrence,
        note: command.note ?? null,
      };
    case 'recordBottle':
      return {
        occurredAtMs: command.occurredAt.instant.epochMs,
        contents: command.contents,
        amount: command.amount ?? null,
        note: command.note ?? null,
      };
    case 'recordGrowth':
      return {
        measuredOnMs: command.measuredOn.instant.epochMs,
        weightKg: command.weightKg ?? null,
        lengthCm: command.lengthCm ?? null,
        headCm: command.headCm ?? null,
        note: command.note ?? null,
      };
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}
