import { z } from 'zod';

/**
 * Runtime boundary schemas for care payloads entering the domain. Domain
 * invariants still run in pure functions after parse.
 */
export const timePrecisionSchema = z.enum(['exact', 'approximate', 'unknown']);

export const diaperContentsSchema = z.enum(['wet', 'dirty', 'both']);

export const bottleContentsSchema = z.enum(['formula', 'breastMilk', 'mixed', 'other']);

export const measuredQuantitySchema = z
  .object({
    value: z.number().finite().nonnegative(),
    unit: z.enum(['ml', 'g', 'piece', 'custom']),
  })
  .nullable();

export const zonedInstantSchema = z.object({
  instant: z.object({ epochMs: z.number().finite() }),
  timeZone: z.string().min(1),
  precision: timePrecisionSchema,
});

export const knownIntervalSchema = z.object({
  kind: z.literal('known'),
  start: zonedInstantSchema,
  end: zonedInstantSchema,
});

export const unknownDurationSchema = z.object({
  kind: z.literal('unknownDuration'),
  observedAt: zonedInstantSchema,
});

export const careOccurrenceSchema = z.discriminatedUnion('kind', [
  knownIntervalSchema,
  unknownDurationSchema,
]);

export const recordDiaperInputSchema = z.object({
  type: z.literal('recordDiaper'),
  operationId: z.string().min(1),
  intentCapturedAt: z.object({ epochMs: z.number().finite() }),
  eventId: z.string().min(1),
  revisionId: z.string().min(1),
  childId: z.string().min(1),
  occurredAt: zonedInstantSchema,
  contents: diaperContentsSchema,
  note: z.string().max(4000).nullable().optional(),
});

export const recordSleepInputSchema = z.object({
  type: z.literal('recordSleep'),
  operationId: z.string().min(1),
  intentCapturedAt: z.object({ epochMs: z.number().finite() }),
  eventId: z.string().min(1),
  revisionId: z.string().min(1),
  childId: z.string().min(1),
  occurrence: careOccurrenceSchema,
  note: z.string().max(4000).nullable().optional(),
});

export const sessionStatusSchema = z.enum([
  'running',
  'paused',
  'completedKnownDuration',
  'completedUnknownDuration',
]);
