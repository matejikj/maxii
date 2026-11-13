import type {
  CareEvent,
  CareMutationCommand,
  DiaperContents,
  EntityId,
  OperationId,
  RevisionId,
} from '../domain';

export type CareEditPatch = {
  body?: string;
  note?: string | null;
  title?: string | null;
  description?: string;
  contents?: DiaperContents;
  reaction?: 'liked' | 'not_liked' | null;
  difficulty?: 'easy' | 'ok' | 'hard' | null;
};

/**
 * Rebuilds the matching write command from the live event so an edit keeps the
 * same care-time fields and only bumps the revision under optimistic concurrency.
 */
export function buildEditCareCommand(input: {
  event: CareEvent;
  expectedRevisionId: RevisionId;
  operationId: OperationId;
  revisionId: RevisionId;
  intentCapturedAtMs: number;
  patch?: CareEditPatch;
}): CareMutationCommand {
  const { event, patch } = input;
  const base = {
    operationId: input.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: event.eventId as EntityId,
    revisionId: input.revisionId,
    childId: event.childId,
    expectedRevisionId: input.expectedRevisionId,
  };

  switch (event.type) {
    case 'diaper':
      return {
        ...base,
        type: 'recordDiaper',
        occurredAt: event.occurredAt,
        contents: patch?.contents ?? event.contents,
        note: patch?.note !== undefined ? patch.note : event.note,
      };
    case 'sleep':
      return {
        ...base,
        type: 'recordSleep',
        occurrence: event.occurrence,
        note: patch?.note !== undefined ? patch.note : event.note,
      };
    case 'bottle':
      return {
        ...base,
        type: 'recordBottle',
        occurredAt: event.occurredAt,
        contents: event.contents,
        amount: event.amount,
        note: patch?.note !== undefined ? patch.note : event.note,
      };
    case 'nursing':
      return {
        ...base,
        type: 'recordNursing',
        occurrence: event.occurrence,
        side: event.side,
        activeSegments: event.activeSegments,
        note: patch?.note !== undefined ? patch.note : event.note,
      };
    case 'food':
      return {
        ...base,
        type: 'recordFood',
        occurredAt: event.occurredAt,
        description: patch?.description ?? event.description,
        amount: event.amount,
        note: patch?.note !== undefined ? patch.note : event.note,
      };
    case 'growth':
      return {
        ...base,
        type: 'recordGrowth',
        measuredOn: event.measuredOn,
        weightKg: event.weightKg,
        lengthCm: event.lengthCm,
        headCm: event.headCm,
        note: patch?.note !== undefined ? patch.note : event.note,
      };
    case 'note':
      return {
        ...base,
        type: 'recordNote',
        occurredAt: event.occurredAt,
        body: patch?.body ?? event.body,
        note: patch?.note !== undefined ? patch.note : event.note,
      };
    case 'experience':
      return {
        ...base,
        type: 'recordExperience',
        occurredAt: event.occurredAt,
        title: patch?.title !== undefined ? patch.title : event.title,
        area: event.area,
        activityId: event.activityId,
        activityRevisionId: event.activityRevisionId,
        note: patch?.note !== undefined ? patch.note : event.note,
        reaction: patch?.reaction !== undefined ? patch.reaction : (event.reaction ?? null),
        difficulty: patch?.difficulty !== undefined ? patch.difficulty : (event.difficulty ?? null),
      };
    case 'milestone':
      return {
        ...base,
        type: 'recordMilestone',
        occurredAt: event.occurredAt,
        body: patch?.body ?? event.body,
        ...(event.milestoneKey !== undefined ? { milestoneKey: event.milestoneKey } : {}),
        note: patch?.note !== undefined ? patch.note : event.note,
      };
  }
}
