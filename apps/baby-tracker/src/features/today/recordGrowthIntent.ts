import type {
  ChildId,
  IdGenerator,
  RecordGrowthCommand,
  RevisionId,
  TimeZoneId,
  ZonedInstant,
} from '../../domain';
import {
  asEntityId,
  asOperationId,
  asRevisionId,
  displayToCm,
  displayToKg,
  parseDecimalInput,
  zonedInstant,
  type LengthDisplayUnit,
  type WeightDisplayUnit,
} from '../../domain';

export type GrowthIntentIds = {
  operationId: ReturnType<typeof asOperationId>;
  eventId: ReturnType<typeof asEntityId>;
  revisionId: RevisionId;
};

export function mintGrowthIds(ids: IdGenerator): GrowthIntentIds {
  return {
    operationId: asOperationId(ids.createId('op')),
    eventId: asEntityId(ids.createId('evt')),
    revisionId: asRevisionId(ids.createId('rev')),
  };
}

export function nowInZone(epochMs: number, timeZone: TimeZoneId): ZonedInstant {
  return zonedInstant({ epochMs }, timeZone);
}

export function buildRecordGrowthCommand(input: {
  ids: GrowthIntentIds;
  childId: ChildId;
  measuredOn: ZonedInstant;
  intentCapturedAtMs: number;
  weightKg?: number | null;
  lengthCm?: number | null;
  headCm?: number | null;
  note?: string | null;
  expectedRevisionId?: RevisionId;
}): RecordGrowthCommand & { expectedRevisionId?: RevisionId } {
  return {
    type: 'recordGrowth',
    operationId: input.ids.operationId,
    intentCapturedAt: { epochMs: input.intentCapturedAtMs },
    eventId: input.ids.eventId,
    revisionId: input.ids.revisionId,
    childId: input.childId,
    measuredOn: input.measuredOn,
    ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
    ...(input.lengthCm !== undefined ? { lengthCm: input.lengthCm } : {}),
    ...(input.headCm !== undefined ? { headCm: input.headCm } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.expectedRevisionId !== undefined
      ? { expectedRevisionId: input.expectedRevisionId }
      : {}),
  };
}

/**
 * Parse display fields into canonical kg/cm. Empty fields stay null so a single
 * filled measure creates a valid event without fake zeroes elsewhere.
 */
export function parseGrowthFormFields(input: {
  weightRaw: string;
  lengthRaw: string;
  headRaw: string;
  weightUnit: WeightDisplayUnit;
  lengthUnit: LengthDisplayUnit;
}):
  | {
      ok: true;
      weightKg: number | null;
      lengthCm: number | null;
      headCm: number | null;
    }
  | { ok: false; message: string } {
  const weight = parseDecimalInput(input.weightRaw);
  if (!weight.ok) return weight;
  const length = parseDecimalInput(input.lengthRaw);
  if (!length.ok) return length;
  const head = parseDecimalInput(input.headRaw);
  if (!head.ok) return head;

  const weightKg = weight.value == null ? null : displayToKg(weight.value, input.weightUnit);
  const lengthCm = length.value == null ? null : displayToCm(length.value, input.lengthUnit);
  const headCm = head.value == null ? null : displayToCm(head.value, input.lengthUnit);

  if (weightKg == null && lengthCm == null && headCm == null) {
    return { ok: false, message: 'Vyplňte alespoň jednu hodnotu měření.' };
  }
  return { ok: true, weightKg, lengthCm, headCm };
}
