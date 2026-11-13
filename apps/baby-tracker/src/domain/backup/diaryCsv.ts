import type { CareEvent } from '../entities/careEvent';
import { careSortAtMs } from '../projections/careTime';

/**
 * Spreadsheet formula injection guard. Cells that would be interpreted as a
 * formula or command in Excel/Sheets are forced into text with a leading quote.
 */
export function escapeCsvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Human-readable care export. Explicitly not a recovery file — no revisions,
 * trash markers, or device secrets. Marked private in the header comment.
 */
export function careEventsToPrivateCsv(events: CareEvent[]): string {
  const header = ['event_id', 'child_id', 'type', 'sort_at_ms', 'revision_id', 'summary'];
  const lines = [
    '# LUMI private care export — contains family diary data. Not a full recovery backup.',
    header.join(','),
  ];
  const ordered = events.slice().sort((a, b) => careSortAtMs(a) - careSortAtMs(b));
  for (const event of ordered) {
    lines.push(
      [
        escapeCsvCell(event.eventId),
        escapeCsvCell(event.childId),
        escapeCsvCell(event.type),
        escapeCsvCell(String(careSortAtMs(event))),
        escapeCsvCell(event.revisionId),
        escapeCsvCell(summarizeCareEvent(event)),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function summarizeCareEvent(event: CareEvent): string {
  switch (event.type) {
    case 'diaper':
      return `diaper:${event.contents}`;
    case 'sleep':
      return `sleep:${event.occurrence.kind}`;
    case 'bottle':
      return event.amount ? `bottle:${event.amount.value}${event.amount.unit}` : 'bottle:unknown';
    case 'nursing':
      return `nursing:${event.side}`;
    case 'food':
      return `food:${event.description}`;
    case 'growth':
      return `growth:w=${event.weightKg ?? ''};l=${event.lengthCm ?? ''};h=${event.headCm ?? ''}`;
    case 'note':
      return event.body.slice(0, 120);
    case 'milestone':
      return event.body.slice(0, 120);
    case 'experience':
      return `experience:${event.title ?? ''}`;
    default: {
      const _exhaustive: never = event;
      return String(_exhaustive);
    }
  }
}
