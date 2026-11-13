import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MILESTONE_CATALOG, MILESTONE_CATEGORIES } from '../../src/content/milestones.ts';
import { memoriesForMilestone, selectMilestones } from '../../src/features/development/milestonePresentation.ts';
import { asChildId, asEntityId, asRevisionId, asTimeZoneId, createMilestoneEvent, zonedInstant } from '../../src/domain/index.ts';

test('the atlas has unique stable entries, verified sources, age context and practical support in every area', () => {
  assert.equal(MILESTONE_CATALOG.length, 52);
  assert.equal(new Set(MILESTONE_CATALOG.map(item => item.id)).size, 52);
  for (const item of MILESTONE_CATALOG) {
    assert.ok(item.description.length > 10); assert.ok(item.support.length >= 2); assert.ok(item.age.explanation);
    assert.ok(item.referenceMonths >= 2 && item.referenceMonths <= 60);
    assert.match(item.source.url, /^https:\/\/(www.cdc.gov|www.who.int|www.healthychildren.org)\//);
    assert.equal(item.source.checkedOn, '2026-11-13');
    if (item.age.kind === 'cdc') assert.match(item.age.explanation, /75 %/);
  }
  for (const category of MILESTONE_CATEGORIES) assert.ok(MILESTONE_CATALOG.some(item => item.category === category.id));
});
test('search ignores Czech accents and combines with category and period without consulting a child age', () => {
  const input = { query: 'sluvka', category: null, period: 'all' as const };
  assert.ok(selectMilestones(MILESTONE_CATALOG, input).some(item => item.id === 'first-words'));
  assert.equal(selectMilestones(MILESTONE_CATALOG, { ...input, category: 'movement' }).length, 0);
  assert.equal(selectMilestones(MILESTONE_CATALOG, { ...input, period: 'first-year' }).length, 0);
  const secondYear = selectMilestones(MILESTONE_CATALOG, { query: '', category: null, period: 'second-year' });
  assert.ok(secondYear.every(item => item.referenceMonths > 12 && item.referenceMonths <= 24));
  assert.ok(secondYear.some(item => item.id === 'first-steps'));
});
test('only explicit atlas keys connect memories; custom wording is never automatically interpreted', () => {
  const at = zonedInstant({ epochMs: 1700000000000 }, asTimeZoneId('Europe/Prague'));
  const base = { childId: asChildId('child'), revisionId: asRevisionId('rev'), occurredAt: at, createdAt: at, body: 'První další slůvka' };
  const custom = createMilestoneEvent({ ...base, eventId: asEntityId('custom') });
  const linked = createMilestoneEvent({ ...base, body: 'Dnes zaznělo ahoj', eventId: asEntityId('linked'), milestoneKey: 'first-words' });
  assert.deepEqual(memoriesForMilestone([custom,linked], 'first-words').map(event => event.eventId), ['linked']);
  assert.throws(() => createMilestoneEvent({ ...base, eventId: asEntityId('bad'), milestoneKey: '../bad' }));
});
