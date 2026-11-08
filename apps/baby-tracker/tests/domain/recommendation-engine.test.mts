import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RECOMMENDATION_RULES_VERSION,
  checkRecommendationSetValidity,
  createRecommendationSet,
  evaluateEligibility,
  markRecommendationHidden,
  markRecommendationOpened,
  offerPresentation,
  reasonCopyCs,
  selectDailyOffers,
  asChildId,
  asEntityId,
  type ParentRecommendationContext,
  type RecommendableCandidate,
} from '../../src/domain/index.ts';
import {
  candidateFromRevision,
  candidatesFromRevisions,
} from '../../src/application/recommendation/candidateFromRevision.ts';
import { sampleProductRevision } from '../../src/content/fixtures/devFixtureSet.ts';
import { DEV_FIXTURE_REVISIONS } from '../../src/content/fixtures/devFixtureSet.ts';

function baseContext(
  overrides: Partial<ParentRecommendationContext> = {},
): ParentRecommendationContext {
  return {
    ageMonths: 2,
    birthDateKnown: true,
    withinContentWindow: true,
    environments: [],
    availableMaterials: ['kartička'],
    withoutMaterialsOnly: false,
    interestAreas: [],
    favoriteActivityIds: [],
    excludedActivityIds: [],
    recentlyTriedActivityIds: [],
    lastPrimaryArea: null,
    sleepRunning: false,
    durationPreference: null,
    readinessByKey: {},
    ...overrides,
  };
}

function productCandidate(
  overrides: Parameters<typeof sampleProductRevision>[0] = {},
): RecommendableCandidate {
  return candidateFromRevision(sampleProductRevision(overrides));
}

test('same inputs and rules version yield a repeatable ordered selection', () => {
  const candidates = [
    productCandidate({
      activityId: 'act.a',
      revisionId: 'act.a.r1',
      primaryArea: 'senses',
      title: 'A',
    }),
    productCandidate({
      activityId: 'act.b',
      revisionId: 'act.b.r1',
      primaryArea: 'speech',
      topicIds: ['speech.songs'],
      materials: [],
      suitability: [
        { kind: 'age_months', fromInclusive: 0, toInclusive: 12 },
        { kind: 'materials_none' },
      ],
      ageMonths: { fromInclusive: 0, toInclusive: 12 },
      title: 'B',
    }),
    productCandidate({
      activityId: 'act.c',
      revisionId: 'act.c.r1',
      primaryArea: 'movement',
      topicIds: ['move.tummy'],
      materials: [],
      suitability: [
        { kind: 'age_months', fromInclusive: 0, toInclusive: 12 },
        { kind: 'materials_none' },
      ],
      ageMonths: { fromInclusive: 0, toInclusive: 12 },
      title: 'C',
    }),
  ];
  const context = baseContext({
    interestAreas: ['speech'],
    availableMaterials: [],
    withoutMaterialsOnly: true,
  });
  const first = selectDailyOffers(candidates, context);
  const second = selectDailyOffers(candidates, context);
  assert.deepEqual(first.offers, second.offers);
  assert.equal(RECOMMENDATION_RULES_VERSION.startsWith('lumi.recommendation.rules.'), true);
  assert.equal(first.offers[0]?.activityId, 'act.b');
});

test('unknown birth date fails closed and never invents eligibility', () => {
  const candidate = productCandidate();
  const decision = evaluateEligibility(candidate, baseContext({ birthDateKnown: false, ageMonths: null }));
  assert.equal(decision.eligible, false);
  assert.ok(decision.reasonCodes.includes('missing_birth_date'));
});

test('favorites and interests never bypass a hard age exclusion', () => {
  const candidate = productCandidate({
    ageMonths: { fromInclusive: 8, toInclusive: 12 },
    suitability: [
      { kind: 'age_months', fromInclusive: 8, toInclusive: 12 },
      { kind: 'requires_birth_date' },
    ],
  });
  const context = baseContext({
    ageMonths: 2,
    favoriteActivityIds: [candidate.activityId],
    interestAreas: ['senses'],
  });
  const selected = selectDailyOffers([candidate], context);
  assert.equal(selected.offers.length, 0);
  assert.ok(selected.rejected[0]?.reasonCodes.includes('age_out_of_activity'));
});

test('age outside the first content window returns an honest empty state', () => {
  const selected = selectDailyOffers(
    [productCandidate()],
    baseContext({ withinContentWindow: false, ageMonths: 18 }),
  );
  assert.equal(selected.offers.length, 0);
  assert.deepEqual(selected.emptyReasonCodes, ['age_out_of_content_window']);
});

test('without-materials filter drops activities that need props', () => {
  const withCard = productCandidate();
  const none = productCandidate({
    activityId: 'act.voice',
    revisionId: 'act.voice.r1',
    materials: [],
    primaryArea: 'speech',
    topicIds: ['speech.songs'],
    suitability: [
      { kind: 'age_months', fromInclusive: 0, toInclusive: 12 },
      { kind: 'materials_none' },
    ],
    ageMonths: { fromInclusive: 0, toInclusive: 12 },
  });
  const selected = selectDailyOffers(
    [withCard, none],
    baseContext({ withoutMaterialsOnly: true, availableMaterials: [] }),
  );
  assert.equal(selected.offers.length, 1);
  assert.equal(selected.offers[0]?.activityId, 'act.voice');
});

test('a single eligible activity is not triplicated under new wording', () => {
  const selected = selectDailyOffers([productCandidate()], baseContext());
  assert.equal(selected.offers.length, 1);
  assert.ok(selected.offers[0]?.reasonCodes.includes('single_eligible'));
});

test('midnight-stable selection ignores wall-clock reshuffles for the same day context', () => {
  const candidates = candidatesFromRevisions([
    sampleProductRevision({ activityId: 'act.one', revisionId: 'act.one.r1' }),
    sampleProductRevision({
      activityId: 'act.two',
      revisionId: 'act.two.r1',
      primaryArea: 'attention',
      topicIds: ['attn.track'],
      materials: [],
      suitability: [
        { kind: 'age_months', fromInclusive: 0, toInclusive: 6 },
        { kind: 'materials_none' },
      ],
      ageMonths: { fromInclusive: 0, toInclusive: 6 },
    }),
  ]);
  const morning = selectDailyOffers(candidates, baseContext({ lastPrimaryArea: 'senses' }));
  const evening = selectDailyOffers(candidates, baseContext({ lastPrimaryArea: 'senses' }));
  assert.deepEqual(
    morning.offers.map((offer) => offer.activityId),
    evening.offers.map((offer) => offer.activityId),
  );
});

test('withdrawn revision invalidates a stored offer without inventing a child score', () => {
  const revision = sampleProductRevision();
  const set = createRecommendationSet({
    recommendationSetId: asEntityId('rec_1'),
    childId: asChildId('child_1'),
    localDay: { year: 2026, month: 3, day: 1 },
    rulesVersion: RECOMMENDATION_RULES_VERSION,
    contentVersion: 'c1',
    offers: [
      {
        activityId: revision.activityId,
        activityRevisionId: revision.revisionId,
        reasonCodes: ['eligible'],
      },
    ],
  });
  const withdrawn = candidateFromRevision({
    ...revision,
    editorial: { ...revision.editorial, stage: 'withdrawn' },
    withdrawnReason: 'replaced',
  });
  const check = checkRecommendationSetValidity(
    set,
    new Map([[withdrawn.revisionId, withdrawn]]),
    baseContext(),
  );
  assert.equal(check.stillValid, false);
  assert.ok(check.reasonCodes.includes('revision_withdrawn'));
});

test('opening or hiding a set never claims an experience happened', () => {
  const set = createRecommendationSet({
    recommendationSetId: asEntityId('rec_2'),
    childId: asChildId('child_1'),
    localDay: { year: 2026, month: 3, day: 1 },
    rulesVersion: RECOMMENDATION_RULES_VERSION,
    contentVersion: 'c1',
    offers: [
      {
        activityId: 'act.high-contrast-card',
        activityRevisionId: 'act.high-contrast-card.r1',
        reasonCodes: ['eligible'],
      },
    ],
  });
  const opened = markRecommendationOpened(set);
  assert.equal(opened.status, 'opened');
  assert.equal(opened.offers.length, 1);
  const hidden = markRecommendationHidden(opened);
  assert.equal(hidden.status, 'hidden');
  assert.ok(hidden.invalidationReasonCodes.includes('care_only_today'));
  assert.equal(offerPresentation(opened, true), 'later');
  assert.equal(offerPresentation(opened, false), 'now');
});

test('development fixtures stay non-recommendable unless explicitly allowed', () => {
  const blocked = candidatesFromRevisions(DEV_FIXTURE_REVISIONS);
  assert.equal(blocked.every((item) => item.recommendable === false), true);
  const allowed = candidatesFromRevisions(DEV_FIXTURE_REVISIONS, {
    allowDevelopmentFixtures: true,
  });
  assert.ok(allowed.some((item) => item.recommendable));
});

test('reason copy stays free of PII-shaped placeholders', () => {
  const copy = reasonCopyCs('missing_birth_date');
  assert.match(copy, /datum narození/i);
  assert.doesNotMatch(copy, /\{name\}|childId|CANARY/i);
});

test('readiness-gated activity stays out until caregiver confirms yes', () => {
  const candidate = productCandidate({
    activityId: 'act.grasp-ring',
    revisionId: 'act.grasp-ring.r1',
    materials: ['kroužek'],
    suitability: [
      { kind: 'age_months', fromInclusive: 3, toInclusive: 11 },
      { kind: 'requires_birth_date' },
      { kind: 'readiness_confirmed', key: 'grasp' },
    ],
    ageMonths: { fromInclusive: 3, toInclusive: 11 },
  });

  const unknown = evaluateEligibility(candidate, baseContext({ ageMonths: 4 }));
  assert.equal(unknown.eligible, false);
  assert.ok(unknown.reasonCodes.includes('readiness_unknown'));

  const denied = evaluateEligibility(
    candidate,
    baseContext({ ageMonths: 4, readinessByKey: { grasp: 'no' } }),
  );
  assert.equal(denied.eligible, false);
  assert.ok(denied.reasonCodes.includes('readiness_not_confirmed'));

  const confirmed = evaluateEligibility(
    candidate,
    baseContext({ ageMonths: 4, readinessByKey: { grasp: 'yes' } }),
  );
  assert.equal(confirmed.eligible, true);

  const selectedUnknown = selectDailyOffers(
    [candidate],
    baseContext({ ageMonths: 4, availableMaterials: ['kroužek'] }),
  );
  assert.equal(selectedUnknown.offers.length, 0);
});
