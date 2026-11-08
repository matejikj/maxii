import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEV_FIXTURE_REVISIONS,
  FIRST_YEAR_DRAFT_REVISIONS,
  STARTER_TOPICS,
  buildContentManifest,
  buildCoverageReport,
  buildPublishedCatalog,
  digestRevision,
  isRecommendable,
  nextStage,
  recordEditorialEvent,
  resolveHistoricalRevision,
  sampleProductRevision,
  topicsByArea,
  validateActivityRevision,
} from '../../src/content/index.ts';

test('starter taxonomy has eight areas and about thirty topics', () => {
  assert.equal(STARTER_TOPICS.length >= 30, true);
  const areas = new Set(STARTER_TOPICS.map((topic) => topic.area));
  assert.equal(areas.size, 8);
  assert.ok(topicsByArea('speech').length >= 3);
});

test('validator rejects free executable fields and bad age intervals', () => {
  const withScript = {
    ...sampleProductRevision(),
    script: 'console.log(1)',
  };
  const scriptResult = validateActivityRevision(withScript);
  assert.equal(scriptResult.ok, false);
  assert.ok(scriptResult.errors.some((error) => error.code === 'no_executable_content'));

  const badAge = validateActivityRevision(
    sampleProductRevision({
      ageMonths: { fromInclusive: 8, toInclusive: 2 },
    }),
  );
  assert.equal(badAge.ok, false);
  assert.ok(badAge.errors.some((error) => error.path === 'ageMonths'));
});

test('validator points at the concrete field for step problems', () => {
  const result = validateActivityRevision(
    sampleProductRevision({
      steps: ['ok', ''] as unknown as ReturnType<typeof sampleProductRevision>['steps'],
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.path === 'steps[1]'));
});

test('draft and development fixtures never enter the recommendation catalog', () => {
  const published = sampleProductRevision();
  const draft = sampleProductRevision({
    activityId: 'act.draft',
    revisionId: 'act.draft.r1',
    editorial: { stage: 'draft', history: [] },
  });
  const { catalog, rejected } = buildPublishedCatalog(
    [...DEV_FIXTURE_REVISIONS, published, draft],
    'test-v1',
  );
  assert.equal(rejected.length, 0);
  assert.equal(catalog.recommendable.length, 1);
  assert.equal(catalog.recommendable[0]?.revisionId, published.revisionId);
  assert.equal(isRecommendable(DEV_FIXTURE_REVISIONS[0]!), false);
  assert.equal(isRecommendable(draft), false);
});

test('published revision cannot change meaning in place; history keeps old wording', () => {
  const original = sampleProductRevision();
  const blocked = recordEditorialEvent(original, {
    stage: 'language_ux',
    author: 'editor',
    atMs: 99,
    note: 'rewrite',
    outcome: 'passed',
  });
  assert.equal(blocked.ok, false);

  const { catalog } = buildPublishedCatalog([original], 'hist');
  const resolved = resolveHistoricalRevision(catalog, original.revisionId);
  assert.equal(resolved?.title, original.title);

  const withdrawn = recordEditorialEvent(original, {
    stage: 'withdrawn',
    author: 'editor',
    atMs: 100,
    note: 'replaced by clearer steps',
    outcome: 'withdrawn',
  });
  assert.equal(withdrawn.ok, true);
  if (!withdrawn.ok) return;

  const next = sampleProductRevision({
    revisionId: 'act.high-contrast-card.r2',
    title: 'Kontrastní kartička — v2',
    steps: ['Nový postup.'],
  });
  const rebuilt = buildPublishedCatalog([withdrawn.revision, next], 'hist-2');
  assert.equal(rebuilt.catalog.recommendable.length, 1);
  assert.equal(rebuilt.catalog.recommendable[0]?.revisionId, 'act.high-contrast-card.r2');
  assert.equal(
    resolveHistoricalRevision(rebuilt.catalog, original.revisionId)?.title,
    original.title,
  );
  assert.notEqual(digestRevision(original), digestRevision(next));
});

test('coverage report finds age gaps even with a high total count', () => {
  const manySameAge = Array.from({ length: 12 }, (_, index) =>
    sampleProductRevision({
      activityId: `act.gap-${index}`,
      revisionId: `act.gap-${index}.r1`,
      ageMonths: { fromInclusive: 0, toInclusive: 2 },
      suitability: [
        { kind: 'age_months', fromInclusive: 0, toInclusive: 2 },
        { kind: 'materials_none' },
      ],
      materials: [],
      primaryArea: 'senses',
      topicIds: ['sense.high-contrast'],
    }),
  );
  const report = buildCoverageReport(manySameAge, { supportedAgeFrom: 0, supportedAgeTo: 12 });
  assert.equal(report.activityCount, 12);
  assert.ok(report.gaps.some((gap) => gap.code === 'age_gap' && gap.details.month === 6));
});

test('editorial workflow enforces stage order before publish', () => {
  const draft = sampleProductRevision({
    editorial: { stage: 'draft', history: [] },
  });
  assert.equal(nextStage('draft'), 'expert_reviewed');
  const skip = recordEditorialEvent(draft, {
    stage: 'published',
    author: 'x',
    atMs: 1,
    note: 'skip',
    outcome: 'passed',
  });
  assert.equal(skip.ok, false);

  const expert = recordEditorialEvent(draft, {
    stage: 'expert_reviewed',
    author: 'odborník',
    atMs: 1,
    note: 'ok',
    outcome: 'passed',
  });
  assert.equal(expert.ok, true);
});

test('content manifest lists digests for referential integrity', () => {
  const revision = sampleProductRevision();
  const { catalog } = buildPublishedCatalog([revision], 'manifest-v1');
  const manifest = buildContentManifest(catalog, 1_700_000_000_000);
  assert.equal(manifest.format, 'lumi.content-manifest.v1');
  assert.equal(manifest.revisionIds.includes(revision.revisionId), true);
  assert.equal(manifest.digests[revision.revisionId], digestRevision(revision));
});

test('first-year draft pack validates as sixty unpublished moment activities', () => {
  assert.equal(FIRST_YEAR_DRAFT_REVISIONS.length, 60);
  const activityIds = new Set(FIRST_YEAR_DRAFT_REVISIONS.map((item) => item.activityId));
  const revisionIds = new Set(FIRST_YEAR_DRAFT_REVISIONS.map((item) => item.revisionId));
  assert.equal(activityIds.size, 60);
  assert.equal(revisionIds.size, 60);

  for (const revision of FIRST_YEAR_DRAFT_REVISIONS) {
    const result = validateActivityRevision(revision);
    assert.equal(result.ok, true, revision.revisionId);
    assert.equal(revision.editorial.stage, 'draft');
    assert.equal(revision.editorial.history.length, 0);
    assert.equal(revision.duration.kind, 'moment');
    assert.equal(revision.ageMonths.toInclusive <= 11, true);
    assert.equal(isRecommendable(revision), false);
    assert.ok(revision.sources.every((source) => typeof source.url === 'string' && source.url.length > 0));
  }

  const readinessGated = FIRST_YEAR_DRAFT_REVISIONS.filter((revision) =>
    revision.suitability.some((item) => item.kind === 'readiness_confirmed'),
  );
  assert.equal(readinessGated.length, 16);

  const { catalog } = buildPublishedCatalog([...FIRST_YEAR_DRAFT_REVISIONS], 'draft-check');
  assert.equal(catalog.recommendable.length, 0);

  const coverage = buildCoverageReport([...FIRST_YEAR_DRAFT_REVISIONS], {
    supportedAgeFrom: 0,
    supportedAgeTo: 11,
  });
  assert.equal(coverage.activityCount, 60);
  assert.ok(!coverage.gaps.some((gap) => gap.code === 'age_gap'));
});
