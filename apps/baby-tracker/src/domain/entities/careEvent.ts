import { AppError } from '../errors';
import type { ActorId, ChildId, EntityId, RevisionId } from '../ids';
import type { CareOccurrence, EpochInterval, ZonedInstant } from '../time';
import { knownInterval } from '../time';

export type DiaperContents = 'wet' | 'dirty' | 'both';

export type FeedingSide = 'left' | 'right' | 'unspecified';

export type BottleContents = 'formula' | 'breastMilk' | 'mixed' | 'other';

export type QuantityUnit = 'ml' | 'g' | 'piece' | 'custom';

/**
 * null means unknown — never coerce to zero. An explicit 0 is a measured empty
 * bottle or weighed leftover and must stay distinguishable in projections.
 */
export type MeasuredQuantity = {
  value: number;
  unit: QuantityUnit;
} | null;

export type CareEventBase = {
  eventId: EntityId;
  childId: ChildId;
  revisionId: RevisionId;
  note: string | null;
  recordedBy: ActorId | null;
  createdAt: ZonedInstant;
};

export type SleepCareEvent = CareEventBase & {
  type: 'sleep';
  occurrence: CareOccurrence;
};

export type NursingCareEvent = CareEventBase & {
  type: 'nursing';
  occurrence: CareOccurrence;
  side: FeedingSide;
  /** Active nursing segments only; pauses are omitted from duration totals. */
  activeSegments: EpochInterval[] | null;
};

export type BottleCareEvent = CareEventBase & {
  type: 'bottle';
  occurredAt: ZonedInstant;
  contents: BottleContents;
  amount: MeasuredQuantity;
};

export type FoodCareEvent = CareEventBase & {
  type: 'food';
  occurredAt: ZonedInstant;
  description: string;
  amount: MeasuredQuantity;
};

export type DiaperCareEvent = CareEventBase & {
  type: 'diaper';
  occurredAt: ZonedInstant;
  /** "both" is one diaper event contributing to wet and dirty tallies once each. */
  contents: DiaperContents;
};

export type GrowthCareEvent = CareEventBase & {
  type: 'growth';
  measuredOn: ZonedInstant;
  weightKg: number | null;
  lengthCm: number | null;
  headCm: number | null;
};

export type CareEvent =
  | SleepCareEvent
  | NursingCareEvent
  | BottleCareEvent
  | FoodCareEvent
  | DiaperCareEvent
  | GrowthCareEvent;

export type CareEventType = CareEvent['type'];

export function assertMeasuredQuantity(amount: MeasuredQuantity, label: string): MeasuredQuantity {
  if (amount == null) return null;
  if (!Number.isFinite(amount.value) || amount.value < 0) {
    throw new AppError('VALIDATION', `${label} must be a non-negative number`, {
      details: { reason: 'quantity' },
    });
  }
  return amount;
}

export function createDiaperEvent(input: {
  eventId: EntityId;
  childId: ChildId;
  revisionId: RevisionId;
  occurredAt: ZonedInstant;
  contents: DiaperContents;
  note?: string | null;
  recordedBy?: ActorId | null;
  createdAt: ZonedInstant;
}): DiaperCareEvent {
  return {
    type: 'diaper',
    eventId: input.eventId,
    childId: input.childId,
    revisionId: input.revisionId,
    occurredAt: input.occurredAt,
    contents: input.contents,
    note: input.note ?? null,
    recordedBy: input.recordedBy ?? null,
    createdAt: input.createdAt,
  };
}

export function createSleepEvent(input: {
  eventId: EntityId;
  childId: ChildId;
  revisionId: RevisionId;
  occurrence: CareOccurrence;
  note?: string | null;
  recordedBy?: ActorId | null;
  createdAt: ZonedInstant;
}): SleepCareEvent {
  if (input.occurrence.kind === 'known') {
    knownInterval(input.occurrence.start, input.occurrence.end);
  }
  return {
    type: 'sleep',
    eventId: input.eventId,
    childId: input.childId,
    revisionId: input.revisionId,
    occurrence: input.occurrence,
    note: input.note ?? null,
    recordedBy: input.recordedBy ?? null,
    createdAt: input.createdAt,
  };
}

export function createBottleEvent(input: {
  eventId: EntityId;
  childId: ChildId;
  revisionId: RevisionId;
  occurredAt: ZonedInstant;
  contents: BottleContents;
  amount?: MeasuredQuantity;
  note?: string | null;
  recordedBy?: ActorId | null;
  createdAt: ZonedInstant;
}): BottleCareEvent {
  return {
    type: 'bottle',
    eventId: input.eventId,
    childId: input.childId,
    revisionId: input.revisionId,
    occurredAt: input.occurredAt,
    contents: input.contents,
    amount: assertMeasuredQuantity(input.amount ?? null, 'Bottle amount'),
    note: input.note ?? null,
    recordedBy: input.recordedBy ?? null,
    createdAt: input.createdAt,
  };
}

export function createNursingEvent(input: {
  eventId: EntityId;
  childId: ChildId;
  revisionId: RevisionId;
  occurrence: CareOccurrence;
  side?: FeedingSide | null;
  activeSegments?: EpochInterval[] | null;
  note?: string | null;
  recordedBy?: ActorId | null;
  createdAt: ZonedInstant;
}): NursingCareEvent {
  if (input.occurrence.kind === 'known') {
    knownInterval(input.occurrence.start, input.occurrence.end);
  }
  const activeSegments =
    input.occurrence.kind === 'unknownDuration' ? null : (input.activeSegments ?? null);
  return {
    type: 'nursing',
    eventId: input.eventId,
    childId: input.childId,
    revisionId: input.revisionId,
    occurrence: input.occurrence,
    side: input.side ?? 'unspecified',
    activeSegments,
    note: input.note ?? null,
    recordedBy: input.recordedBy ?? null,
    createdAt: input.createdAt,
  };
}

export function createFoodEvent(input: {
  eventId: EntityId;
  childId: ChildId;
  revisionId: RevisionId;
  occurredAt: ZonedInstant;
  description: string;
  amount?: MeasuredQuantity;
  note?: string | null;
  recordedBy?: ActorId | null;
  createdAt: ZonedInstant;
}): FoodCareEvent {
  const description = input.description.trim();
  if (!description) {
    throw new AppError('VALIDATION', 'Food description is required', {
      details: { reason: 'food_description' },
    });
  }
  return {
    type: 'food',
    eventId: input.eventId,
    childId: input.childId,
    revisionId: input.revisionId,
    occurredAt: input.occurredAt,
    description,
    amount: assertMeasuredQuantity(input.amount ?? null, 'Food amount'),
    note: input.note ?? null,
    recordedBy: input.recordedBy ?? null,
    createdAt: input.createdAt,
  };
}

export function createGrowthEvent(input: {
  eventId: EntityId;
  childId: ChildId;
  revisionId: RevisionId;
  measuredOn: ZonedInstant;
  weightKg?: number | null;
  lengthCm?: number | null;
  headCm?: number | null;
  note?: string | null;
  recordedBy?: ActorId | null;
  createdAt: ZonedInstant;
}): GrowthCareEvent {
  const weightKg = input.weightKg ?? null;
  const lengthCm = input.lengthCm ?? null;
  const headCm = input.headCm ?? null;
  if (weightKg == null && lengthCm == null && headCm == null) {
    throw new AppError('VALIDATION', 'Growth event needs at least one measurement', {
      details: { reason: 'empty_growth' },
    });
  }
  for (const [label, value] of [
    ['weightKg', weightKg],
    ['lengthCm', lengthCm],
    ['headCm', headCm],
  ] as const) {
    if (value != null && (!Number.isFinite(value) || value <= 0)) {
      throw new AppError('VALIDATION', `${label} must be a positive number when provided`, {
        details: { reason: 'growth_measure' },
      });
    }
  }
  return {
    type: 'growth',
    eventId: input.eventId,
    childId: input.childId,
    revisionId: input.revisionId,
    measuredOn: input.measuredOn,
    weightKg,
    lengthCm,
    headCm,
    note: input.note ?? null,
    recordedBy: input.recordedBy ?? null,
    createdAt: input.createdAt,
  };
}

/** Diaper tallies: one event, even for "both", counts as a single diaper. */
export function diaperCountContribution(event: DiaperCareEvent): {
  diapers: 1;
  wet: 0 | 1;
  dirty: 0 | 1;
} {
  switch (event.contents) {
    case 'wet':
      return { diapers: 1, wet: 1, dirty: 0 };
    case 'dirty':
      return { diapers: 1, wet: 0, dirty: 1 };
    case 'both':
      return { diapers: 1, wet: 1, dirty: 1 };
  }
}
