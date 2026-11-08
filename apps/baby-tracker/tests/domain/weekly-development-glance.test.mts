import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  buildWeeklyDevelopmentGlance,
  createExperienceEvent,
  zonedInstant,
} from '../../src/domain/index.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_glance');

function experience(input: {
  id: string;
  area?: 'speech' | 'movement' | null;
  reaction?: 'liked' | 'not_liked' | null;
}) {
  return createExperienceEvent({
    eventId: asEntityId(input.id),
    childId,
    revisionId: asRevisionId(`rev_${input.id}`),
    occurredAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    createdAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    title: 'Hra',
    area: input.area ?? 'speech',
    activityId: 'act.demo',
    activityRevisionId: 'act.demo.r1',
    reaction: input.reaction ?? null,
  });
}

test('empty week stays insufficient without inventing a profile', () => {
  const glance = buildWeeklyDevelopmentGlance({
    endDay: { year: 2026, month: 3, day: 8 },
    experiences: [],
  });
  assert.equal(glance.insufficientData, true);
  assert.equal(glance.statements.length, 0);
});

test('statements cite concrete experience ids', () => {
  const liked = experience({ id: 'e1', reaction: 'liked', area: 'speech' });
  const other = experience({ id: 'e2', area: 'movement' });
  const glance = buildWeeklyDevelopmentGlance({
    endDay: { year: 2026, month: 3, day: 8 },
    experiences: [liked, other],
  });
  assert.equal(glance.insufficientData, false);
  assert.equal(glance.experienceCount, 2);
  const count = glance.statements.find((item) => item.code === 'count');
  assert.ok(count?.evidenceEventIds.includes('e1'));
  assert.ok(count?.evidenceEventIds.includes('e2'));
  const likedStatement = glance.statements.find((item) => item.code === 'liked');
  assert.deepEqual(likedStatement?.evidenceEventIds, ['e1']);
  assert.ok(glance.statements.some((item) => item.code === 'areas'));
});
