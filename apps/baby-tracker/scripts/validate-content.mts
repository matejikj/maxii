#!/usr/bin/env node
/**
 * Editorial CLI: validate revisions and print field-level errors.
 * Exit code 1 when any revision fails schema or referential checks.
 */
import {
  DEV_FIXTURE_REVISIONS,
  FIRST_YEAR_ARCHIVED_REVISIONS,
  FIRST_YEAR_DRAFT_REVISIONS,
  FIRST_YEAR_PUBLISHED_REVISIONS,
  LOCAL_LIBRARY_REVISIONS,
  STARTER_TOPICS,
  buildCoverageReport,
  buildPublishedCatalog,
  isRecommendable,
  validateActivityRevision,
} from '../src/content/index.ts';

const drafts = [...FIRST_YEAR_DRAFT_REVISIONS];
const publishedFirstYear = [...FIRST_YEAR_PUBLISHED_REVISIONS];
const all = [
  ...DEV_FIXTURE_REVISIONS,
  ...LOCAL_LIBRARY_REVISIONS,
  ...FIRST_YEAR_ARCHIVED_REVISIONS,
  ...drafts,
  ...publishedFirstYear,
];
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

const draftInCatalog = catalog.recommendable.filter((revision) =>
  drafts.some((draft) => draft.revisionId === revision.revisionId),
);
if (draftInCatalog.length > 0) {
  failed += 1;
  console.error(`drafts leaked into recommendable catalog: ${draftInCatalog.length}`);
}

const draftCoverage = buildCoverageReport([...drafts], {
  supportedAgeFrom: 0,
  supportedAgeTo: 11,
});
const publishedCoverage = buildCoverageReport(catalog.recommendable, {
  supportedAgeFrom: 0,
  supportedAgeTo: 12,
});

const readinessGated = drafts.filter((revision) =>
  revision.suitability.some((item) => item.kind === 'readiness_confirmed'),
).length;
const unpublishedReviewGaps = drafts.filter((revision) => !isRecommendable(revision)).length;
const publishedFirstYearCount = publishedFirstYear.filter((revision) => isRecommendable(revision)).length;
if (publishedFirstYearCount !== 60) {
  failed += 1;
  console.error(`first-year published recommendable count: ${publishedFirstYearCount} (expected 60)`);
}
const birthdayLeak = [...drafts, ...publishedFirstYear].filter(
  (revision) => revision.ageMonths.toInclusive >= 12,
).length;
if (birthdayLeak > 0) {
  failed += 1;
  console.error(`first-birthday age leak in drafts/published: ${birthdayLeak}`);
}

const firstYearCoverage = buildCoverageReport(publishedFirstYear, {
  supportedAgeFrom: 0,
  supportedAgeTo: 11,
});

console.log(
  JSON.stringify(
    {
      topics: STARTER_TOPICS.length,
      validated: all.length,
      drafts: drafts.length,
      archivedDrafts: FIRST_YEAR_ARCHIVED_REVISIONS.length,
      publishedFirstYear: publishedFirstYearCount,
      readinessGated,
      unpublishedReviewGaps,
      recommendable: catalog.recommendable.length,
      draftCoverageGaps: draftCoverage.gaps.map((gap) => gap.code),
      draftByAgeMonth: draftCoverage.byAgeMonth,
      firstYearCoverageGaps: firstYearCoverage.gaps.map((gap) => gap.code),
      publishedCoverageGaps: publishedCoverage.gaps.map((gap) => gap.code),
      failed,
    },
    null,
    2,
  ),
);

if (failed > 0) process.exit(1);
