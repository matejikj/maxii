import type { DevelopmentArea } from '../../domain';
import { DEVELOPMENT_AREA_LABELS_CS } from '../model/topics';
import type { ActivityRevision, ContentDuration, ContentEnvironment } from '../model/types';

export type CoverageGap = {
  code: string;
  message: string;
  details: Record<string, string | number | boolean | null>;
};

export type CoverageReport = {
  activityCount: number;
  byAgeMonth: Record<number, number>;
  byArea: Record<DevelopmentArea, number>;
  byDuration: Record<string, number>;
  byEnvironment: Record<ContentEnvironment, number>;
  withMaterials: number;
  withoutMaterials: number;
  gaps: CoverageGap[];
};

/**
 * Coverage is about distribution, not a vanity total. A large count can still
 * leave an age month or area empty — that must surface as a gap.
 */
export function buildCoverageReport(
  revisions: ActivityRevision[],
  options: { supportedAgeFrom?: number; supportedAgeTo?: number } = {},
): CoverageReport {
  const ageFrom = options.supportedAgeFrom ?? 0;
  const ageTo = options.supportedAgeTo ?? 12;
  const byAgeMonth: Record<number, number> = {};
  for (let month = ageFrom; month <= ageTo; month += 1) byAgeMonth[month] = 0;

  const byArea = emptyAreaCounts();
  const byDuration: Record<string, number> = {};
  const byEnvironment: Record<ContentEnvironment, number> = {
    home: 0,
    outdoor: 0,
    travel: 0,
    quiet: 0,
  };
  let withMaterials = 0;
  let withoutMaterials = 0;

  for (const revision of revisions) {
    for (let month = ageFrom; month <= ageTo; month += 1) {
      if (revision.ageMonths.fromInclusive <= month && revision.ageMonths.toInclusive >= month) {
        byAgeMonth[month] = (byAgeMonth[month] ?? 0) + 1;
      }
    }
    byArea[revision.primaryArea] += 1;
    const durationKey = durationLabel(revision.duration);
    byDuration[durationKey] = (byDuration[durationKey] ?? 0) + 1;
    for (const environment of revision.environments) {
      byEnvironment[environment] += 1;
    }
    if (revision.materials.length === 0) withoutMaterials += 1;
    else withMaterials += 1;
  }

  const gaps: CoverageGap[] = [];
  for (let month = ageFrom; month <= ageTo; month += 1) {
    if ((byAgeMonth[month] ?? 0) === 0) {
      gaps.push({
        code: 'age_gap',
        message: `No recommendable activity covers month ${month}.`,
        details: { month, activityCount: revisions.length },
      });
    }
  }
  for (const area of Object.keys(byArea) as DevelopmentArea[]) {
    if (byArea[area] === 0) {
      gaps.push({
        code: 'area_gap',
        message: `No recommendable activity uses primary area ${DEVELOPMENT_AREA_LABELS_CS[area]}.`,
        details: { area, activityCount: revisions.length },
      });
    }
  }
  if (withoutMaterials === 0 && revisions.length > 0) {
    gaps.push({
      code: 'materials_gap',
      message: 'No activity is marked as needing no materials.',
      details: { activityCount: revisions.length },
    });
  }
  if ((byEnvironment.home ?? 0) === 0 && revisions.length > 0) {
    gaps.push({
      code: 'environment_gap',
      message: 'No activity is approved for the home environment.',
      details: { activityCount: revisions.length },
    });
  }

  return {
    activityCount: revisions.length,
    byAgeMonth,
    byArea,
    byDuration,
    byEnvironment,
    withMaterials,
    withoutMaterials,
    gaps,
  };
}

function emptyAreaCounts(): Record<DevelopmentArea, number> {
  return {
    relationship: 0,
    speech: 0,
    movement: 0,
    senses: 0,
    attention: 0,
    spaceQuantity: 0,
    creationRhythm: 0,
    autonomy: 0,
  };
}

function durationLabel(duration: ContentDuration): string {
  return duration.kind === 'moment' ? 'moment' : `${duration.minutes}m`;
}
