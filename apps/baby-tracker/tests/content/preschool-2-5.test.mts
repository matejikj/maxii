import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRESCHOOL_2_5_DRAFT_REVISIONS,
  PRESCHOOL_2_5_PUBLISHED_REVISIONS,
  PRODUCT_PUBLISHED_REVISIONS,
  buildCoverageReport,
  buildPreschool25Files,
  buildPreschool25Manifest,
  isRecommendable,
  validateActivityRevision,
  verifyContentPack,
} from '../../src/content/index.ts';
import {
  EMBEDDED_PRESCHOOL_2_5_MANIFEST,
  EMBEDDED_PRESCHOOL_2_5_SIGNATURE,
} from '../../src/content/pack/embeddedPreschool25.ts';

test('preschool 2–5 drafts and published set validate with monthly coverage', () => {
  assert.equal(PRESCHOOL_2_5_DRAFT_REVISIONS.length, 24);
  assert.equal(PRESCHOOL_2_5_PUBLISHED_REVISIONS.length, 24);
  for (const revision of PRESCHOOL_2_5_PUBLISHED_REVISIONS) {
    const result = validateActivityRevision(revision);
    assert.equal(result.ok, true, revision.revisionId);
    assert.equal(isRecommendable(revision), true);
    assert.ok(revision.ageMonths.fromInclusive >= 24);
    assert.ok(revision.ageMonths.toInclusive <= 59);
  }
  const coverage = buildCoverageReport([...PRESCHOOL_2_5_PUBLISHED_REVISIONS], {
    supportedAgeFrom: 24,
    supportedAgeTo: 59,
  });
  assert.equal(coverage.gaps.filter((gap) => gap.code === 'age_gap').length, 0);
  assert.ok(PRODUCT_PUBLISHED_REVISIONS.length >= 132);
});

test('safeMarkMaking gates preschool mark-making and unknown stays ineligible', () => {
  const mark = PRESCHOOL_2_5_PUBLISHED_REVISIONS.filter((revision) =>
    revision.suitability.some(
      (item) => item.kind === 'readiness_confirmed' && item.key === 'safeMarkMaking',
    ),
  );
  assert.ok(mark.length >= 2);
  assert.ok(mark.every((revision) => /mark|colour|drawing|texture/i.test(revision.activityId)));
});

test('preschool activity families group related storytelling and sorting motifs', () => {
  const story = PRESCHOOL_2_5_PUBLISHED_REVISIONS.filter(
    (revision) => revision.activityFamilyId === 'family.preschool-story',
  );
  const sorting = PRESCHOOL_2_5_PUBLISHED_REVISIONS.filter(
    (revision) => revision.activityFamilyId === 'family.preschool-sorting',
  );
  assert.ok(story.length >= 2);
  assert.ok(sorting.length >= 2);
});

test('signed preschool content pack verifies offline without diary payloads', () => {
  const files = buildPreschool25Files();
  const { manifest } = buildPreschool25Manifest(files, EMBEDDED_PRESCHOOL_2_5_MANIFEST.createdAt);
  assert.equal(manifest.packId, EMBEDDED_PRESCHOOL_2_5_MANIFEST.packId);
  assert.equal(manifest.kind, 'content');
  assert.deepEqual(manifest.ageMonths, { fromInclusive: 24, toInclusive: 59 });
  const verified = verifyContentPack(
    EMBEDDED_PRESCHOOL_2_5_MANIFEST,
    EMBEDDED_PRESCHOOL_2_5_SIGNATURE,
    files,
  );
  assert.equal(verified.ok, true);
  assert.equal(JSON.stringify(manifest).includes('CANARY'), false);
});
