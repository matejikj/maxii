import type { CareEvent } from '../entities/careEvent';

/**
 * Sort key for timelines and day buckets. Uses care meaning time (occurred /
 * interval start / measured), never the write clock that committed the row.
 */
export function careSortAtMs(event: CareEvent): number {
  switch (event.type) {
    case 'sleep':
    case 'nursing':
      return event.occurrence.kind === 'known'
        ? event.occurrence.start.instant.epochMs
        : event.occurrence.observedAt.instant.epochMs;
    case 'bottle':
    case 'food':
    case 'diaper':
    case 'note':
    case 'experience':
    case 'milestone':
      return event.occurredAt.instant.epochMs;
    case 'growth':
      return event.measuredOn.instant.epochMs;
  }
}
