import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AppError,
  asChildId,
  asEntityId,
  asRevisionId,
  asTimeZoneId,
  assertSingleChildMigrationPreserved,
  bindOpenFormToChild,
  createChildProfile,
  createDiaperEvent,
  createDiaryArchive,
  filterDiaryArchiveByScope,
  listActiveSessionsForStrip,
  planAddChildProfile,
  planArchiveChildProfile,
  planCareEventReassignment,
  planSwitchActiveChild,
  resolveActiveChildProfile,
  zonedInstant,
} from '../../src/domain/index.ts';

const zone = asTimeZoneId('Europe/Prague');

function child(name: string, id: string, status: 'active' | 'archived' = 'active') {
  return createChildProfile({
    childId: asChildId(id),
    displayName: name,
    summaryTimeZone: zone,
    status,
    archivedAtMs: status === 'archived' ? 1_700_000_000_000 : null,
  });
}

test('resolveActiveChildProfile prefers stored active id among active profiles', () => {
  const a = child('Ada', 'child_a');
  const b = child('Bořek', 'child_b');
  const resolved = resolveActiveChildProfile([a, b], 'child_b');
  assert.equal(resolved?.childId, 'child_b');
});

test('archived stored active id falls back to another active child', () => {
  const a = child('Ada', 'child_a', 'archived');
  const b = child('Bořek', 'child_b');
  const resolved = resolveActiveChildProfile([a, b], 'child_a');
  assert.equal(resolved?.childId, 'child_b');
});

test('open form binding diverges when shell context switches', () => {
  const binding = bindOpenFormToChild({
    boundChildId: asChildId('child_a'),
    boundDisplayName: 'Ada',
    activeChildId: asChildId('child_b'),
  });
  assert.equal(binding.contextDiverged, true);
  assert.equal(binding.boundChildId, 'child_a');
});

test('archive refuses to remove the last active child', () => {
  const only = child('Ada', 'child_a');
  assert.throws(
    () =>
      planArchiveChildProfile({
        profiles: [only],
        childId: only.childId,
        archivedAtMs: 1,
        activeChildId: only.childId,
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'last_active_child',
  );
});

test('archive switches writing context away from the archived child', () => {
  const a = child('Ada', 'child_a');
  const b = child('Bořek', 'child_b');
  const planned = planArchiveChildProfile({
    profiles: [a, b],
    childId: a.childId,
    archivedAtMs: 42,
    activeChildId: a.childId,
  });
  assert.equal(planned.archived.status, 'archived');
  assert.equal(planned.nextActiveChildId, b.childId);
});

test('add child keeps a distinct id and can become active', () => {
  const a = child('Ada', 'child_a');
  const planned = planAddChildProfile({
    profiles: [a],
    childId: asChildId('child_b'),
    displayName: 'Bořek',
    summaryTimeZone: zone,
  });
  assert.equal(planned.profile.displayName, 'Bořek');
  assert.equal(planned.nextActiveChildId, 'child_b');
});

test('switch refuses archived children', () => {
  const a = child('Ada', 'child_a', 'archived');
  assert.throws(
    () => planSwitchActiveChild({ profiles: [a], childId: a.childId }),
    (error: unknown) =>
      error instanceof AppError && error.details.reason === 'archived_not_writable',
  );
});

test('session strip names each running measurement by child', () => {
  const a = child('Ada', 'child_a');
  const b = child('Bořek', 'child_b');
  const items = listActiveSessionsForStrip({
    profiles: [a, b],
    sessions: [
      {
        status: 'running',
        sessionId: asEntityId('sess_sleep_b'),
        childId: b.childId,
        kind: 'sleep',
        startedAt: zonedInstant({ epochMs: 1 }, zone),
        monotonicStartMs: null,
        side: null,
        activeSegments: [],
        currentSegmentStartedAtMs: 1,
      },
      {
        status: 'running',
        sessionId: asEntityId('sess_sleep_a'),
        childId: a.childId,
        kind: 'sleep',
        startedAt: zonedInstant({ epochMs: 2 }, zone),
        monotonicStartMs: null,
        side: null,
        activeSegments: [],
        currentSegmentStartedAtMs: 2,
      },
    ],
  });
  assert.equal(items.length, 2);
  assert.equal(items[0]?.displayName, 'Ada');
  assert.equal(items[1]?.displayName, 'Bořek');
});

test('one-child export scope never includes the sibling care row', () => {
  const a = child('Ada', 'child_a');
  const b = child('Bořek', 'child_b');
  const eventA = createDiaperEvent({
    eventId: asEntityId('ev_a'),
    childId: a.childId,
    revisionId: asRevisionId('rev_a'),
    occurredAt: zonedInstant({ epochMs: 10 }, zone),
    contents: 'wet',
    createdAt: zonedInstant({ epochMs: 10 }, zone),
  });
  const eventB = createDiaperEvent({
    eventId: asEntityId('ev_b'),
    childId: b.childId,
    revisionId: asRevisionId('rev_b'),
    occurredAt: zonedInstant({ epochMs: 11 }, zone),
    contents: 'dirty',
    createdAt: zonedInstant({ epochMs: 11 }, zone),
  });
  const archive = createDiaryArchive({
    createdAtMs: 12,
    schemaCompatibility: 5,
    profiles: [a, b],
    careEvents: [eventA, eventB],
    sessions: [],
    drafts: [],
    revisions: [],
    receipts: [],
    deletions: [],
    meta: [{ key: 'active_child_id', value: a.childId }],
  });
  const scoped = filterDiaryArchiveByScope(archive, {
    kind: 'one_child',
    childId: a.childId,
  });
  assert.equal(scoped.profiles.length, 1);
  assert.equal(scoped.careEvents.length, 1);
  assert.equal(scoped.careEvents[0]?.eventId, 'ev_a');
  assert.equal(scoped.manifest.childId, a.childId);
});

test('reassignment plan keeps authorship path and rejects archived targets', () => {
  const a = child('Ada', 'child_a');
  const b = child('Bořek', 'child_b');
  const archived = child('Cyril', 'child_c', 'archived');
  const event = createDiaperEvent({
    eventId: asEntityId('ev_a'),
    childId: a.childId,
    revisionId: asRevisionId('rev_a'),
    occurredAt: zonedInstant({ epochMs: 10 }, zone),
    contents: 'wet',
    createdAt: zonedInstant({ epochMs: 10 }, zone),
  });
  const plan = planCareEventReassignment({
    event,
    targetChildId: b.childId,
    profiles: [a, b, archived],
  });
  assert.equal(plan.fromChildId, a.childId);
  assert.equal(plan.toChildId, b.childId);
  assert.throws(
    () =>
      planCareEventReassignment({
        event,
        targetChildId: archived.childId,
        profiles: [a, b, archived],
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'target_archived',
  );
});

test('single-child migration preserves original child identity after adding a sibling', () => {
  const before = asChildId('child_original');
  assert.doesNotThrow(() =>
    assertSingleChildMigrationPreserved({
      beforeChildId: before,
      afterProfiles: [child('Ada', 'child_original'), child('Bořek', 'child_b')],
      afterCareChildIds: [before, before],
    }),
  );
  assert.throws(
    () =>
      assertSingleChildMigrationPreserved({
        beforeChildId: before,
        afterProfiles: [child('Bořek', 'child_b')],
        afterCareChildIds: [before],
      }),
    (error: unknown) => error instanceof AppError && error.details.reason === 'child_id_changed',
  );
});
