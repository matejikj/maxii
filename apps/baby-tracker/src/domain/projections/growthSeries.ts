import type { GrowthCareEvent } from '../entities/careEvent';

export type GrowthSeriesPoint = {
  eventId: string;
  measuredAtMs: number;
  weightKg: number | null;
  lengthCm: number | null;
  headCm: number | null;
};

export type GrowthSeries = {
  points: GrowthSeriesPoint[];
  /** True when only one recorded point exists — UI must not invent a trend. */
  singlePoint: boolean;
  hasWeight: boolean;
  hasLength: boolean;
  hasHead: boolean;
};

/**
 * Ordered own measurements only. Missing fields stay null; gaps are never filled
 * with zeroes or interpolated values.
 */
export function buildGrowthSeries(events: readonly GrowthCareEvent[]): GrowthSeries {
  const points = [...events]
    .map((event) => ({
      eventId: event.eventId,
      measuredAtMs: event.measuredOn.instant.epochMs,
      weightKg: event.weightKg,
      lengthCm: event.lengthCm,
      headCm: event.headCm,
    }))
    .sort((a, b) => a.measuredAtMs - b.measuredAtMs);

  return {
    points,
    singlePoint: points.length === 1,
    hasWeight: points.some((point) => point.weightKg != null),
    hasLength: points.some((point) => point.lengthCm != null),
    hasHead: points.some((point) => point.headCm != null),
  };
}
