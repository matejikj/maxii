import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId, asEntityId, asRevisionId, asTimeZoneId, buildDailyCareOverview,
  buildWeeklyCareOverview, createBottleEvent, createSleepEvent,
  sleepOccurrenceWithoutDuration, zonedInstant,
} from '../../src/domain/index.ts';
import { presentCareOverview } from '../../src/features/care/presentCareOverview.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('metric_fixture');
const day = { year: 2026, month: 11, day: 11 };
const at = zonedInstant({ epochMs: Date.UTC(2026, 10, 11, 10) }, zone);

function bottle(id: string, value: number | null) {
  return createBottleEvent({
    eventId: asEntityId(id), childId, revisionId: asRevisionId(`rev_${id}`),
    occurredAt: at, createdAt: at, contents: 'formula',
    amount: value === null ? null : { value, unit: 'ml' },
  });
}

test('empty care cards show missing records instead of six invented zero totals', () => {
  const presentation = presentCareOverview(buildDailyCareOverview({ day, summaryTimeZone: zone, events: [] }));
  assert.equal(presentation.metrics.length, 6);
  assert.deepEqual(presentation.metrics.map(metric => metric.value), Array(6).fill('—'));
  assert.ok(presentation.metrics.every(metric => !metric.hasRecords && metric.description.length > 0));
});

test('unknown amounts and durations have explicit card values and accessible descriptions', () => {
  const sleep = createSleepEvent({
    eventId: asEntityId('unknown_sleep'), childId, revisionId: asRevisionId('rev_sleep'),
    occurrence: sleepOccurrenceWithoutDuration(at), createdAt: at,
  });
  const presentation = presentCareOverview(buildDailyCareOverview({
    day, summaryTimeZone: zone, events: [bottle('unknown_bottle', null), sleep],
  }));
  const sleepMetric = presentation.metrics.find(metric => metric.id === 'sleep')!;
  const bottleMetric = presentation.metrics.find(metric => metric.id === 'bottle')!;
  assert.equal(sleepMetric.value, 'Bez délky');
  assert.match(sleepMetric.description, /bez délky/);
  assert.equal(bottleMetric.value, 'Bez množství');
  assert.match(bottleMetric.description, /množství chybí/);
  assert.ok(sleepMetric.hasRecords && bottleMetric.hasRecords);
});

test('explicit zero and partially recorded totals stay distinct from missing records', () => {
  const zero = presentCareOverview(buildDailyCareOverview({
    day, summaryTimeZone: zone, events: [bottle('zero', 0)],
  })).metrics.find(metric => metric.id === 'bottle')!;
  assert.equal(zero.value, '0 ml');
  assert.equal(zero.hasRecords, true);
  const week = presentCareOverview(buildWeeklyCareOverview({
    endDay: day, summaryTimeZone: zone, events: [bottle('known', 120), bottle('missing', null)],
  })).metrics.find(metric => metric.id === 'bottle')!;
  assert.equal(week.value, '120 ml');
  assert.match(week.detail, /1× bez množství/);
  assert.match(week.description, /množství chybí/);
});
