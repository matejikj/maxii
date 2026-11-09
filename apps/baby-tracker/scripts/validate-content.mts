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
  PRODUCT_PUBLISHED_REVISIONS,
  STARTER_TOPICS,
  TODDLER_1_2_DRAFT_REVISIONS,
  TODDLER_1_2_PUBLISHED_REVISIONS,
  buildCoverageReport,
  buildPublishedCatalog,
  isRecommendable,
  validateActivityRevision,
} from '../src/content/index.ts';

const firstYearDrafts = [...FIRST_YEAR_DRAFT_REVISIONS];
const toddlerDrafts = [...TODDLER_1_2_DRAFT_REVISIONS];
const drafts = [...firstYearDrafts, ...toddlerDrafts];
const publishedFirstYear = [...FIRST_YEAR_PUBLISHED_REVISIONS];
const publishedToddler = [...TODDLER_1_2_PUBLISHED_REVISIONS];
const all = [
  ...DEV_FIXTURE_REVISIONS,
  ...LOCAL_LIBRARY_REVISIONS,
  ...FIRST_YEAR_ARCHIVED_REVISIONS,
  ...drafts,
  ...publishedFirstYear,
  ...publishedToddler,
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

const publishedFirstYearCount = publishedFirstYear.filter((revision) =>
  isRecommendable(revision),
).length;
if (publishedFirstYearCount !== 60) {
  failed += 1;
  console.error(`first-year published recommendable count: ${publishedFirstYearCount} (expected 60)`);
}

const publishedToddlerCount = publishedToddler.filter((revision) => isRecommendable(revision)).length;
if (publishedToddlerCount !== 24) {
  failed += 1;
  console.error(`toddler 1–2 published recommendable count: ${publishedToddlerCount} (expected 24)`);
}

const birthdayLeak = [...firstYearDrafts, ...publishedFirstYear].filter(
  (revision) => revision.ageMonths.toInclusive >= 12,
).length;
if (birthdayLeak > 0) {
  failed += 1;
  console.error(`first-birthday age leak in first-year drafts/published: ${birthdayLeak}`);
}

const toddlerAgeLeak = [...toddlerDrafts, ...publishedToddler].filter(
  (revision) => revision.ageMonths.fromInclusive < 12 || revision.ageMonths.toInclusive > 23,
).length;
if (toddlerAgeLeak > 0) {
  failed += 1;
  console.error(`toddler age window leak: ${toddlerAgeLeak}`);
}

const firstYearCoverage = buildCoverageReport(publishedFirstYear, {
  supportedAgeFrom: 0,
  supportedAgeTo: 11,
});
const toddlerCoverage = buildCoverageReport(publishedToddler, {
  supportedAgeFrom: 12,
  supportedAgeTo: 23,
});
const productCoverage = buildCoverageReport([...PRODUCT_PUBLISHED_REVISIONS], {
  supportedAgeFrom: 0,
  supportedAgeTo: 23,
});

if (toddlerCoverage.gaps.some((gap) => gap.code === 'age_gap')) {
  failed += 1;
  console.error('toddler coverage has empty months', toddlerCoverage.gaps);
}
if (productCoverage.gaps.some((gap) => gap.code === 'age_gap')) {
  failed += 1;
  console.error('product coverage has empty months', productCoverage.gaps);
}

const safeMarkMaking = publishedToddler.filter((revision) =>
  revision.suitability.some(
    (item) => item.kind === 'readiness_confirmed' && item.key === 'safeMarkMaking',
  ),
);
if (safeMarkMaking.length < 1) {
  failed += 1;
  console.error('expected at least one safeMarkMaking-gated toddler activity');
}

console.log(
  JSON.stringify(
    {
      topics: STARTER_TOPICS.length,
      validated: all.length,
      drafts: drafts.length,
      archivedDrafts: FIRST_YEAR_ARCHIVED_REVISIONS.length,
      publishedFirstYear: publishedFirstYearCount,
      publishedToddler12: publishedToddlerCount,
      productPublished: PRODUCT_PUBLISHED_REVISIONS.length,
      recommendable: catalog.recommendable.length,
      firstYearCoverageGaps: firstYearCoverage.gaps.map((gap) => gap.code),
      toddlerCoverageGaps: toddlerCoverage.gaps.map((gap) => gap.code),
      productCoverageGaps: productCoverage.gaps.map((gap) => gap.code),
      safeMarkMakingGated: safeMarkMaking.length,
      failed,
    },
    null,
    2,
  ),
);

if (failed > 0) process.exit(1);
