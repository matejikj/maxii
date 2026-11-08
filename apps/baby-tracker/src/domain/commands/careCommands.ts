import { AppError } from '../errors';
import {
  createBottleEvent,
  createDiaperEvent,
  createExperienceEvent,
  createFoodEvent,
  createGrowthEvent,
  createMilestoneEvent,
  createNoteEvent,
  createNursingEvent,
  createSleepEvent,
  type BottleCareEvent,
  type BottleContents,
  type DiaperCareEvent,
  type DiaperContents,
  type ExperienceCareEvent,
  type ExperienceDifficulty,
  type ExperienceReaction,
  type FeedingSide,
  type FoodCareEvent,
  type GrowthCareEvent,
  type MeasuredQuantity,
  type MilestoneCareEvent,
  type NoteCareEvent,
  type NursingCareEvent,
  type SleepCareEvent,
} from '../entities/careEvent';
import type { DevelopmentArea } from '../entities/development';
import type { ActorId, ChildId, EntityId, RevisionId } from '../ids';
import type { CareOccurrence, EpochInterval, ZonedInstant } from '../time';
import type { CommandIntent } from './results';

export type RecordDiaperCommand = CommandIntent & {
  type: 'recordDiaper';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  contents: DiaperContents;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type RecordSleepCommand = CommandIntent & {
  type: 'recordSleep';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurrence: CareOccurrence;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type RecordBottleCommand = CommandIntent & {
  type: 'recordBottle';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  contents: BottleContents;
  amount?: MeasuredQuantity;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type RecordNursingCommand = CommandIntent & {
  type: 'recordNursing';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurrence: CareOccurrence;
  side?: FeedingSide | null;
  activeSegments?: EpochInterval[] | null;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type RecordFoodCommand = CommandIntent & {
  type: 'recordFood';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  description: string;
  amount?: MeasuredQuantity;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type RecordGrowthCommand = CommandIntent & {
  type: 'recordGrowth';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  measuredOn: ZonedInstant;
  weightKg?: number | null;
  lengthCm?: number | null;
  headCm?: number | null;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type RecordNoteCommand = CommandIntent & {
  type: 'recordNote';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  body: string;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type RecordExperienceCommand = CommandIntent & {
  type: 'recordExperience';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  title?: string | null;
  area?: DevelopmentArea | null;
  activityId?: string | null;
  activityRevisionId?: string | null;
  note?: string | null;
  reaction?: ExperienceReaction | null;
  difficulty?: ExperienceDifficulty | null;
  recordedBy?: ActorId | null;
};

export type RecordMilestoneCommand = CommandIntent & {
  type: 'recordMilestone';
  eventId: EntityId;
  revisionId: RevisionId;
  childId: ChildId;
  occurredAt: ZonedInstant;
  body: string;
  note?: string | null;
  recordedBy?: ActorId | null;
};

export type CareWriteCommand =
  | RecordDiaperCommand
  | RecordSleepCommand
  | RecordBottleCommand
  | RecordNursingCommand
  | RecordFoodCommand
  | RecordGrowthCommand
  | RecordNoteCommand
  | RecordExperienceCommand
  | RecordMilestoneCommand;

/** Pure validation + entity construction; persistence happens in application services. */
export function buildCareEventFromCommand(
  command: CareWriteCommand,
  createdAt: ZonedInstant,
):
  | DiaperCareEvent
  | SleepCareEvent
  | BottleCareEvent
  | NursingCareEvent
  | FoodCareEvent
  | GrowthCareEvent
  | NoteCareEvent
  | ExperienceCareEvent
  | MilestoneCareEvent {
  switch (command.type) {
    case 'recordDiaper':
      return createDiaperEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurredAt: command.occurredAt,
        contents: command.contents,
        createdAt,
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordSleep':
      return createSleepEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurrence: command.occurrence,
        createdAt,
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordBottle':
      return createBottleEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurredAt: command.occurredAt,
        contents: command.contents,
        createdAt,
        ...(command.amount !== undefined ? { amount: command.amount } : {}),
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordNursing':
      return createNursingEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurrence: command.occurrence,
        createdAt,
        ...(command.side !== undefined ? { side: command.side } : {}),
        ...(command.activeSegments !== undefined ? { activeSegments: command.activeSegments } : {}),
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordFood':
      return createFoodEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurredAt: command.occurredAt,
        description: command.description,
        createdAt,
        ...(command.amount !== undefined ? { amount: command.amount } : {}),
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordGrowth':
      return createGrowthEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        measuredOn: command.measuredOn,
        createdAt,
        ...(command.weightKg !== undefined ? { weightKg: command.weightKg } : {}),
        ...(command.lengthCm !== undefined ? { lengthCm: command.lengthCm } : {}),
        ...(command.headCm !== undefined ? { headCm: command.headCm } : {}),
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordNote':
      return createNoteEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurredAt: command.occurredAt,
        body: command.body,
        createdAt,
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordExperience':
      return createExperienceEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurredAt: command.occurredAt,
        createdAt,
        ...(command.title !== undefined ? { title: command.title } : {}),
        ...(command.area !== undefined ? { area: command.area } : {}),
        ...(command.activityId !== undefined ? { activityId: command.activityId } : {}),
        ...(command.activityRevisionId !== undefined
          ? { activityRevisionId: command.activityRevisionId }
          : {}),
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.reaction !== undefined ? { reaction: command.reaction } : {}),
        ...(command.difficulty !== undefined ? { difficulty: command.difficulty } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    case 'recordMilestone':
      return createMilestoneEvent({
        eventId: command.eventId,
        childId: command.childId,
        revisionId: command.revisionId,
        occurredAt: command.occurredAt,
        body: command.body,
        createdAt,
        ...(command.note !== undefined ? { note: command.note } : {}),
        ...(command.recordedBy !== undefined ? { recordedBy: command.recordedBy } : {}),
      });
    default: {
      const _exhaustive: never = command;
      throw new AppError('INTERNAL', 'Unsupported care command', {
        details: { reason: 'command_type' },
      });
      void _exhaustive;
    }
  }
}
