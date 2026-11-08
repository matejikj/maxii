import { AppError } from '../errors';
import {
  createBottleEvent,
  createDiaperEvent,
  createGrowthEvent,
  createSleepEvent,
  type BottleCareEvent,
  type BottleContents,
  type DiaperCareEvent,
  type DiaperContents,
  type GrowthCareEvent,
  type MeasuredQuantity,
  type SleepCareEvent,
} from '../entities/careEvent';
import type { ActorId, ChildId, EntityId, RevisionId } from '../ids';
import type { CareOccurrence, ZonedInstant } from '../time';
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

export type CareWriteCommand =
  | RecordDiaperCommand
  | RecordSleepCommand
  | RecordBottleCommand
  | RecordGrowthCommand;

/** Pure validation + entity construction; persistence happens in application services. */
export function buildCareEventFromCommand(
  command: CareWriteCommand,
  createdAt: ZonedInstant,
): DiaperCareEvent | SleepCareEvent | BottleCareEvent | GrowthCareEvent {
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
    default: {
      const _exhaustive: never = command;
      throw new AppError('INTERNAL', 'Unsupported care command', {
        details: { reason: 'command_type' },
      });
      void _exhaustive;
    }
  }
}
