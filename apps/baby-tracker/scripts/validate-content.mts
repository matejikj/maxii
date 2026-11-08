#!/usr/bin/env node
/**
 * Editorial CLI: validate revisions and print field-level errors.
 * Exit code 1 when any revision fails schema or referential checks.
 */
import {
  DEV_FIXTURE_REVISIONS,
  STARTER_TOPICS,
  buildCoverageReport,
  buildPublishedCatalog,
  sampleProductRevision,
  validateActivityRevision,
} from '../src/content/index.ts';

const productSamples = [
  sampleProductRevision(),
  sampleProductRevision({
    activityId: 'act.soft-rhyme',
    revisionId: 'act.soft-rhyme.r1',
    title: 'Tichá říkanka',
    ageMonths: { fromInclusive: 0, toInclusive: 12 },
    primaryArea: 'speech',
    relatedAreas: ['creationRhythm'],
    topicIds: ['speech.songs'],
    materials: [],
    suitability: [
      { kind: 'age_months', fromInclusive: 0, toInclusive: 12 },
      { kind: 'materials_none' },
    ],
  }),
];

const all = [...DEV_FIXTURE_REVISIONS, ...productSamples];
let failed = 0;

for (const [index, revision] of all.entries()) {
  const result = validateActivityRevision(revision);
  if (!result.ok) {
    failed += 1;
    console.error(`#${index} ${String((revision as { revisionId?: string }).revisionId)} INVALID`);
    for (const error of result.errors) {
      console.error(`  - ${error.path || '(root)'}: [${error.code}] ${error.message}`);
    }
  }
}

const { catalog, rejected } = buildPublishedCatalog(all, 'dev-validate');
for (const item of rejected) {
  failed += 1;
  console.error(`catalog reject #${item.index}`);
  for (const error of item.errors) {
    console.error(`  - ${error.path}: [${error.code}] ${error.message}`);
  }
}

const coverage = buildCoverageReport(catalog.recommendable, {
  supportedAgeFrom: 0,
  supportedAgeTo: 12,
});

console.log(
  JSON.stringify(
    {
      topics: STARTER_TOPICS.length,
      validated: all.length,
      recommendable: catalog.recommendable.length,
      coverageGaps: coverage.gaps.map((gap) => gap.code),
      failed,
    },
    null,
    2,
  ),
);

if (failed > 0) process.exit(1);
