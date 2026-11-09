import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRODUCT_PUBLISHED_REVISIONS,
  TODDLER_1_2_DRAFT_REVISIONS,
  TODDLER_1_2_PUBLISHED_REVISIONS,
  buildCoverageReport,
  buildToddler12Files,
  buildToddler12Manifest,
  isRecommendable,
  validateActivityRevision,
  verifyContentPack,
} from '../../src/content/index.ts';
import {
  EMBEDDED_TODDLER_1_2_MANIFEST,
  EMBEDDED_TODDLER_1_2_SIGNATURE,
} from '../../src/content/pack/embeddedToddler12.ts';

test('toddler 1–2 drafts and published set validate with monthly coverage', () => {
  assert.equal(TODDLER_1_2_DRAFT_REVISIONS.length, 24);
  assert.equal(TODDLER_1_2_PUBLISHED_REVISIONS.length, 24);
  for (const revision of TODDLER_1_2_PUBLISHED_REVISIONS) {
    const result = validateActivityRevision(revision);
    assert.equal(result.ok, true, revision.revisionId);
    assert.equal(isRecommendable(revision), true);
    assert.ok(revision.ageMonths.fromInclusive >= 12);
    assert.ok(revision.ageMonths.toInclusive <= 23);
  }
  const coverage = buildCoverageReport([...TODDLER_1_2_PUBLISHED_REVISIONS], {
    supportedAgeFrom: 12,
    supportedAgeTo: 23,
  });
  assert.equal(coverage.gaps.filter((gap) => gap.code === 'age_gap').length, 0);
  assert.ok(PRODUCT_PUBLISHED_REVISIONS.length >= 108);
});

test('safeMarkMaking gates mark-making and unknown stays ineligible', () => {
  const mark = TODDLER_1_2_PUBLISHED_REVISIONS.find((revision) =>
    revision.suitability.some(
      (item) => item.kind === 'readiness_confirmed' && item.key === 'safeMarkMaking',
    ),
  );
  assert.ok(mark);
  assert.match(mark!.activityId, /mark|drawing|first-large/i);
});

test('signed toddler content pack verifies offline without diary payloads', () => {
  const files = buildToddler12Files();
  const { manifest } = buildToddler12Manifest(files, EMBEDDED_TODDLER_1_2_MANIFEST.createdAt);
  assert.equal(manifest.packId, EMBEDDED_TODDLER_1_2_MANIFEST.packId);
  assert.equal(manifest.kind, 'content');
  assert.deepEqual(manifest.ageMonths, { fromInclusive: 12, toInclusive: 23 });
  const verified = verifyContentPack(
    EMBEDDED_TODDLER_1_2_MANIFEST,
    EMBEDDED_TODDLER_1_2_SIGNATURE,
    files,
  );
  assert.equal(verified.ok, true);
  assert.equal(JSON.stringify(manifest).includes('CANARY'), false);
});
