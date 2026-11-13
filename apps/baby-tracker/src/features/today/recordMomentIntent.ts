import type {
  ChildId,
  DevelopmentArea,
  IdGenerator,
  RecordExperienceCommand,
  RecordMilestoneCommand,
  RecordNoteCommand,
  RevisionId,
  TimeZoneId,
  ZonedInstant,
} from '../../domain';
import {
  asEntityId,
  asOperationId,
  asRevisionId,
  zonedInstant,
} from '../../domain';

export type MomentIntentIds = {
  operationId: ReturnType<typeof asOperationId>;
  eventId: ReturnType<typeof asEntityId>;
  revisionId: RevisionId;
};

export function mintMomentIds(ids: IdGenerator): MomentIntentIds {
  return {
    operationId: asOperationId(ids.createId('op')),
    eventId: asEntityId(ids.createId('evt')),
    revisionId: asRevisionId(ids.createId('rev')),
  };
}

export function nowInZone(epochMs: number, timeZone: TimeZoneId): ZonedInstant {
  return zonedInstant({ epochMs }, timeZone);
}

export function buildRecordNoteCommand(input: {
  ids: MomentIntentIds;
  childId: ChildId;
  occurredAt: ZonedInstant;
  body: string;
  intentCapturedAtMs: number;
  expectedRevisionId?: RevisionId;
}): RecordNoteCommand & { expectedRevisionId?: RevisionId } {
  return {
    type: 'recordNote',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurredAt: input.occurredAt,
    body: input.body,
    ...(input.expectedRevisionId !== undefined
      ? { expectedRevisionId: input.expectedRevisionId }
      : {}),
  };
}

export function buildRecordMilestoneCommand(input: {
  ids: MomentIntentIds;
  childId: ChildId;
  occurredAt: ZonedInstant;
  body: string;
  milestoneKey?: string;
  note?: string | null;
  intentCapturedAtMs: number;
  expectedRevisionId?: RevisionId;
}): RecordMilestoneCommand & { expectedRevisionId?: RevisionId } {
  return {
    type: 'recordMilestone',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurredAt: input.occurredAt,
    body: input.body,
    ...(input.milestoneKey !== undefined ? { milestoneKey: input.milestoneKey } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.expectedRevisionId !== undefined
      ? { expectedRevisionId: input.expectedRevisionId }
      : {}),
  };
}

export function buildRecordExperienceCommand(input: {
  ids: MomentIntentIds;
  childId: ChildId;
  occurredAt: ZonedInstant;
  intentCapturedAtMs: number;
  title?: string | null;
  area?: DevelopmentArea | null;
  activityId?: string | null;
  activityRevisionId?: string | null;
  note?: string | null;
  reaction?: 'liked' | 'not_liked' | null;
  difficulty?: 'easy' | 'ok' | 'hard' | null;
  expectedRevisionId?: RevisionId;
}): RecordExperienceCommand & { expectedRevisionId?: RevisionId } {
  return {
    type: 'recordExperience',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    occurredAt: input.occurredAt,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.area !== undefined ? { area: input.area } : {}),
    ...(input.activityId !== undefined ? { activityId: input.activityId } : {}),
    ...(input.activityRevisionId !== undefined
      ? { activityRevisionId: input.activityRevisionId }
      : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.reaction !== undefined ? { reaction: input.reaction } : {}),
    ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
    ...(input.expectedRevisionId !== undefined
      ? { expectedRevisionId: input.expectedRevisionId }
      : {}),
  };
}

export const DEVELOPMENT_AREA_OPTIONS: { id: DevelopmentArea; label: string }[] = [
  { id: 'relationship', label: 'Vztahy' },
  { id: 'speech', label: 'Řeč' },
  { id: 'movement', label: 'Pohyb' },
  { id: 'senses', label: 'Smysly' },
  { id: 'attention', label: 'Pozornost' },
  { id: 'spaceQuantity', label: 'Prostor a množství' },
  { id: 'creationRhythm', label: 'Tvorba a rytmus' },
  { id: 'autonomy', label: 'Samostatnost' },
];
