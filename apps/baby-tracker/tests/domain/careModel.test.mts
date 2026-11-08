import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../../src/domain/errors.ts';
import {
  DOMAIN_VOCABULARY,
  SESSION_TRANSITIONS,
  asChildId,
  asEntityId,
  asOperationId,
  asRevisionId,
  asTimeZoneId,
  buildCareEventFromCommand,
  commandFailed,
  completeSessionUnknownDuration,
  completeSessionWithDuration,
  createBottleEvent,
  createChildProfile,
  createDiaperEvent,
  createDraft,
  createRecommendationSet,
  createSleepEvent,
  diaperCountContribution,
  knownSleepDurationMs,
  nursingActiveDurationMs,
  createFoodEvent,
  createNursingEvent,
  pauseNursingSession,
  recordDiaperInputSchema,
  resumeNursingSession,
  savedLocally,
  startSession,
  summarizeBottles,
  summarizeDiapers,
  summarizeFood,
  summarizeNursing,
  summarizeSleepForDay,
  switchNursingSide,
  zonedInstant,
} from '../../src/domain/index.ts';

const zone = asTimeZoneId('Europe/Prague');
const childId = asChildId('child_test_1');
const now = zonedInstant({ epochMs: 1_700_000_100_000 }, zone);

test('invalid session transition and unknown duration stay distinct states', () => {
  const running = startSession({
    sessionId: asEntityId('session_1'),
    childId,
    kind: 'nursing',
    startedAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
  });
  const paused = pauseNursingSession(
    running,
    zonedInstant({ epochMs: 1_700_000_010_000 }, zone),
  );
  const resumed = resumeNursingSession(
    paused,
    zonedInstant({ epochMs: 1_700_000_020_000 }, zone),
  );
  const completed = completeSessionWithDuration(
    resumed,
    zonedInstant({ epochMs: 1_700_000_040_000 }, zone),
  );
  assert.equal(completed.status, 'completedKnownDuration');
  assert.equal(nursingActiveDurationMs(completed.activeSegments), 30_000);
  assert.ok(SESSION_TRANSITIONS.running.includes('paused'));
  assert.equal(SESSION_TRANSITIONS.completedKnownDuration.length, 0);

  const unknown = completeSessionUnknownDuration(
    startSession({
      sessionId: asEntityId('session_2'),
      childId,
      kind: 'sleep',
      startedAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    }),
    zonedInstant({ epochMs: 1_700_000_050_000 }, zone),
  );
  assert.equal(unknown.status, 'completedUnknownDuration');
  assert.throws(() =>
    pauseNursingSession(
      startSession({
        sessionId: asEntityId('session_3'),
        childId,
        kind: 'sleep',
        startedAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
      }),
      zonedInstant({ epochMs: 1_700_000_001_000 }, zone),
    ),
  );
});

test('switchNursingSide closes the open segment atomically', () => {
  const running = startSession({
    sessionId: asEntityId('session_side'),
    childId,
    kind: 'nursing',
    startedAt: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
    side: 'left',
  });
  const switched = switchNursingSide(
    running,
    zonedInstant({ epochMs: 1_700_000_030_000 }, zone),
    'right',
  );
  assert.equal(switched.side, 'right');
  assert.equal(switched.activeSegments.length, 1);
  assert.equal(switched.activeSegments[0]?.endMs, 1_700_000_030_000);
  assert.equal(switched.currentSegmentStartedAtMs, 1_700_000_030_000);
});

test('nursing and food summaries stay separated from bottle ml', () => {
  const nursing = createNursingEvent({
    eventId: asEntityId('nursing_1'),
    childId,
    revisionId: asRevisionId('rev_n1'),
    occurrence: {
      kind: 'known',
      start: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
      end: zonedInstant({ epochMs: 1_700_000_600_000 }, zone),
    },
    activeSegments: [{ startMs: 1_700_000_000_000, endMs: 1_700_000_300_000 }],
    createdAt: now,
  });
  const food = createFoodEvent({
    eventId: asEntityId('food_1'),
    childId,
    revisionId: asRevisionId('rev_f1'),
    occurredAt: now,
    description: 'banán',
    amount: { value: 20, unit: 'g' },
    createdAt: now,
  });
  assert.equal(summarizeNursing([nursing]).recordedActiveMs, 300_000);
  assert.equal(summarizeFood([food]).eventsWithAmount, 1);
});

test('unknown bottle amount never becomes zero care in projections', () => {
  const withAmount = createBottleEvent({
    eventId: asEntityId('bottle_1'),
    childId,
    revisionId: asRevisionId('rev_1'),
    occurredAt: now,
    contents: 'formula',
    amount: { value: 120, unit: 'ml' },
    createdAt: now,
  });
  const unknownAmount = createBottleEvent({
    eventId: asEntityId('bottle_2'),
    childId,
    revisionId: asRevisionId('rev_2'),
    occurredAt: now,
    contents: 'formula',
    amount: null,
    createdAt: now,
  });
  const explicitZero = createBottleEvent({
    eventId: asEntityId('bottle_3'),
    childId,
    revisionId: asRevisionId('rev_3'),
    occurredAt: now,
    contents: 'formula',
    amount: { value: 0, unit: 'ml' },
    createdAt: now,
  });
  const summary = summarizeBottles([withAmount, unknownAmount, explicitZero]);
  assert.equal(summary.recordedMl, 120);
  assert.equal(summary.feedingsWithAmount, 2);
  assert.equal(summary.feedingsMissingAmount, 1);
  assert.notEqual(summary.recordedMl, 0 + 120 + 0 - 120);
});

test('diaper both is one diaper contributing to wet and dirty once each', () => {
  const both = createDiaperEvent({
    eventId: asEntityId('diaper_1'),
    childId,
    revisionId: asRevisionId('rev_d1'),
    occurredAt: now,
    contents: 'both',
    createdAt: now,
  });
  assert.deepEqual(diaperCountContribution(both), { diapers: 1, wet: 1, dirty: 1 });
  assert.deepEqual(summarizeDiapers([both]), { diapers: 1, wet: 1, dirty: 1 });
});

test('sleep without duration is counted as an event but not as zero minutes', () => {
  const known = createSleepEvent({
    eventId: asEntityId('sleep_1'),
    childId,
    revisionId: asRevisionId('rev_s1'),
    occurrence: {
      kind: 'known',
      start: zonedInstant({ epochMs: 1_700_000_000_000 }, zone),
      end: zonedInstant({ epochMs: 1_700_003_600_000 }, zone),
    },
    createdAt: now,
  });
  const unknown = createSleepEvent({
    eventId: asEntityId('sleep_2'),
    childId,
    revisionId: asRevisionId('rev_s2'),
    occurrence: {
      kind: 'unknownDuration',
      observedAt: zonedInstant({ epochMs: 1_700_004_000_000 }, zone),
    },
    createdAt: now,
  });
  assert.equal(knownSleepDurationMs(unknown), null);
  assert.equal(knownSleepDurationMs(known), 3_600_000);
  const day = { year: 2023, month: 11, day: 14 };
  const summary = summarizeSleepForDay([known, unknown], day, zone);
  assert.equal(summary.eventsMissingDuration, 1);
  assert.equal(summary.eventsWithKnownDuration, 1);
  assert.ok(summary.recordedIntervalMs > 0);
});

test('commands keep operationId and reject invalid boundary payloads', () => {
  const intent = {
    operationId: asOperationId('op_1'),
    intentCapturedAt: { epochMs: 1_700_000_000_000 },
  };
  const event = buildCareEventFromCommand(
    {
      type: 'recordDiaper',
      ...intent,
      eventId: asEntityId('diaper_cmd'),
      revisionId: asRevisionId('rev_cmd'),
      childId,
      occurredAt: now,
      contents: 'wet',
    },
    now,
  );
  assert.equal(event.type, 'diaper');
  const ok = savedLocally(intent, { epochMs: 1_700_000_100_000 }, [event.eventId], [
    event.revisionId,
  ]);
  assert.equal(ok.savedLocally, true);
  assert.equal(ok.operationId, intent.operationId);

  const failed = commandFailed(
    intent,
    new AppError('STORAGE', 'disk full', { retryable: true }),
  );
  assert.equal(failed.savedLocally, false);
  assert.equal(failed.error.retryable, true);

  const parsed = recordDiaperInputSchema.safeParse({
    type: 'recordDiaper',
    operationId: 'op_x',
    intentCapturedAt: { epochMs: 1 },
    eventId: 'e',
    revisionId: 'r',
    childId: 'c',
    occurredAt: {
      instant: { epochMs: 1 },
      timeZone: 'Europe/Prague',
      precision: 'exact',
    },
    contents: 'soaked',
  });
  assert.equal(parsed.success, false);
});

test('profile, draft, recommendations and vocabulary stay coherent', () => {
  const profile = createChildProfile({
    childId,
    displayName: 'Max',
    birthDate: { year: 2025, month: 1, day: 2 },
    summaryTimeZone: 'Europe/Prague',
  });
  assert.equal(profile.settings.summaryTimeZone, zone);

  const draft = createDraft({
    draftId: asEntityId('draft_1'),
    childId,
    formType: 'bottle',
    originalEventTime: { epochMs: 1_700_000_000_000 },
    updatedAt: { epochMs: 1_700_000_050_000 },
    payload: { amount: null },
  });
  assert.equal(draft.formType, 'bottle');

  assert.throws(() =>
    createRecommendationSet({
      recommendationSetId: asEntityId('rec_1'),
      childId,
      localDay: { year: 2026, month: 1, day: 1 },
      rulesVersion: '1',
      contentVersion: '1',
      offers: [
        { activityId: 'a', activityRevisionId: '1', reasonCodes: [] },
        { activityId: 'b', activityRevisionId: '1', reasonCodes: [] },
        { activityId: 'c', activityRevisionId: '1', reasonCodes: [] },
        { activityId: 'd', activityRevisionId: '1', reasonCodes: [] },
      ],
    }),
  );

  assert.equal(DOMAIN_VOCABULARY.savedLocally.uiLabelCs, 'Uloženo v zařízení');
  assert.equal(DOMAIN_VOCABULARY.draft.uiLabelCs, 'Rozepsáno');
  assert.equal(DOMAIN_VOCABULARY.completedUnknownDuration.uiLabelCs, 'Dokončený zápis bez délky');
});

test('end before start and empty growth cannot be stored as a similar valid variant', () => {
  assert.throws(() =>
    createSleepEvent({
      eventId: asEntityId('sleep_bad'),
      childId,
      revisionId: asRevisionId('rev_bad'),
      occurrence: {
        kind: 'known',
        start: zonedInstant({ epochMs: 2_000 }, zone),
        end: zonedInstant({ epochMs: 1_000 }, zone),
      },
      createdAt: now,
    }),
  );
  assert.throws(() =>
    createBottleEvent({
      eventId: asEntityId('bottle_bad'),
      childId,
      revisionId: asRevisionId('rev_bad'),
      occurredAt: now,
      contents: 'formula',
      amount: { value: -1, unit: 'ml' },
      createdAt: now,
    }),
  );
});
