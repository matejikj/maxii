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
  PRESCHOOL_2_5_DRAFT_REVISIONS,
  PRESCHOOL_2_5_PUBLISHED_REVISIONS,
  PRIMARY_5_8_DRAFT_REVISIONS,
  PRIMARY_5_8_PUBLISHED_REVISIONS,
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
const preschoolDrafts = [...PRESCHOOL_2_5_DRAFT_REVISIONS];
const primaryDrafts = [...PRIMARY_5_8_DRAFT_REVISIONS];
const drafts = [...firstYearDrafts, ...toddlerDrafts, ...preschoolDrafts, ...primaryDrafts];
const publishedFirstYear = [...FIRST_YEAR_PUBLISHED_REVISIONS];
const publishedToddler = [...TODDLER_1_2_PUBLISHED_REVISIONS];
const publishedPreschool = [...PRESCHOOL_2_5_PUBLISHED_REVISIONS];
const publishedPrimary = [...PRIMARY_5_8_PUBLISHED_REVISIONS];
const all = [
  ...DEV_FIXTURE_REVISIONS,
  ...LOCAL_LIBRARY_REVISIONS,
  ...FIRST_YEAR_ARCHIVED_REVISIONS,
  ...drafts,
  ...publishedFirstYear,
  ...publishedToddler,
  ...publishedPreschool,
  ...publishedPrimary,
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
  console.error(
    `first-year published recommendable count: ${publishedFirstYearCount} (expected 60)`,
  );
}

const publishedToddlerCount = publishedToddler.filter((revision) =>
  isRecommendable(revision),
).length;
if (publishedToddlerCount !== 24) {
  failed += 1;
  console.error(
    `toddler 1–2 published recommendable count: ${publishedToddlerCount} (expected 24)`,
  );
}

const publishedPreschoolCount = publishedPreschool.filter((revision) =>
  isRecommendable(revision),
).length;
if (publishedPreschoolCount !== 24) {
  failed += 1;
  console.error(
    `preschool 2–5 published recommendable count: ${publishedPreschoolCount} (expected 24)`,
  );
}

const publishedPrimaryCount = publishedPrimary.filter((revision) =>
  isRecommendable(revision),
).length;
if (publishedPrimaryCount !== 24) {
  failed += 1;
  console.error(
    `primary 5–8 published recommendable count: ${publishedPrimaryCount} (expected 24)`,
  );
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

const preschoolAgeLeak = [...preschoolDrafts, ...publishedPreschool].filter(
  (revision) => revision.ageMonths.fromInclusive < 24 || revision.ageMonths.toInclusive > 59,
).length;
if (preschoolAgeLeak > 0) {
  failed += 1;
  console.error(`preschool age window leak: ${preschoolAgeLeak}`);
}

const primaryAgeLeak = [...primaryDrafts, ...publishedPrimary].filter(
  (revision) => revision.ageMonths.fromInclusive < 60 || revision.ageMonths.toInclusive > 95,
).length;
if (primaryAgeLeak > 0) {
  failed += 1;
  console.error(`primary age window leak: ${primaryAgeLeak}`);
}

const firstYearCoverage = buildCoverageReport(publishedFirstYear, {
  supportedAgeFrom: 0,
  supportedAgeTo: 11,
});
const toddlerCoverage = buildCoverageReport(publishedToddler, {
  supportedAgeFrom: 12,
  supportedAgeTo: 23,
});
const preschoolCoverage = buildCoverageReport(publishedPreschool, {
  supportedAgeFrom: 24,
  supportedAgeTo: 59,
});
const primaryCoverage = buildCoverageReport(publishedPrimary, {
  supportedAgeFrom: 60,
  supportedAgeTo: 95,
});
const productCoverage = buildCoverageReport([...PRODUCT_PUBLISHED_REVISIONS], {
  supportedAgeFrom: 0,
  supportedAgeTo: 95,
});

if (toddlerCoverage.gaps.some((gap) => gap.code === 'age_gap')) {
  failed += 1;
  console.error('toddler coverage has empty months', toddlerCoverage.gaps);
}
if (preschoolCoverage.gaps.some((gap) => gap.code === 'age_gap')) {
  failed += 1;
  console.error('preschool coverage has empty months', preschoolCoverage.gaps);
}
if (primaryCoverage.gaps.some((gap) => gap.code === 'age_gap')) {
  failed += 1;
  console.error('primary coverage has empty months', primaryCoverage.gaps);
}
if (productCoverage.gaps.some((gap) => gap.code === 'age_gap')) {
  failed += 1;
  console.error('product coverage has empty months', productCoverage.gaps);
}

const safeMarkMaking = [...publishedToddler, ...publishedPreschool].filter((revision) =>
  revision.suitability.some(
    (item) => item.kind === 'readiness_confirmed' && item.key === 'safeMarkMaking',
  ),
);
if (safeMarkMaking.length < 2) {
  failed += 1;
  console.error('expected safeMarkMaking-gated toddler and preschool activities');
}

const shortProjectLike = publishedPrimary.filter(
  (revision) => revision.duration.kind === 'minutes' && revision.duration.minutes === 10,
);
if (shortProjectLike.length < 1) {
  failed += 1;
  console.error('expected at least one 10-minute primary short project activity');
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
      publishedPreschool25: publishedPreschoolCount,
      publishedPrimary58: publishedPrimaryCount,
      productPublished: PRODUCT_PUBLISHED_REVISIONS.length,
      recommendable: catalog.recommendable.length,
      firstYearCoverageGaps: firstYearCoverage.gaps.map((gap) => gap.code),
      toddlerCoverageGaps: toddlerCoverage.gaps.map((gap) => gap.code),
      preschoolCoverageGaps: preschoolCoverage.gaps.map((gap) => gap.code),
      primaryCoverageGaps: primaryCoverage.gaps.map((gap) => gap.code),
      productCoverageGaps: productCoverage.gaps.map((gap) => gap.code),
      safeMarkMakingGated: safeMarkMaking.length,
      primaryTenMinute: shortProjectLike.length,
      failed,
    },
    null,
    2,
  ),
);

if (failed > 0) process.exit(1);
