import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRIMARY_5_8_DRAFT_REVISIONS,
  PRIMARY_5_8_PUBLISHED_REVISIONS,
  PRODUCT_PUBLISHED_REVISIONS,
  buildCoverageReport,
  buildPrimary58Files,
  buildPrimary58Manifest,
  isRecommendable,
  validateActivityRevision,
  verifyContentPack,
} from '../../src/content/index.ts';
import {
  EMBEDDED_PRIMARY_5_8_MANIFEST,
  EMBEDDED_PRIMARY_5_8_SIGNATURE,
} from '../../src/content/pack/embeddedPrimary58.ts';

test('primary 5–8 drafts and published set validate with monthly coverage', () => {
  assert.equal(PRIMARY_5_8_DRAFT_REVISIONS.length, 24);
  assert.equal(PRIMARY_5_8_PUBLISHED_REVISIONS.length, 24);
  for (const revision of PRIMARY_5_8_PUBLISHED_REVISIONS) {
    const result = validateActivityRevision(revision);
    assert.equal(result.ok, true, revision.revisionId);
    assert.equal(isRecommendable(revision), true);
    assert.ok(revision.ageMonths.fromInclusive >= 60);
    assert.ok(revision.ageMonths.toInclusive <= 95);
    assert.ok(revision.steps.length <= 3);
  }
  const coverage = buildCoverageReport([...PRIMARY_5_8_PUBLISHED_REVISIONS], {
    supportedAgeFrom: 60,
    supportedAgeTo: 95,
  });
  assert.equal(coverage.gaps.filter((gap) => gap.code === 'age_gap').length, 0);
  assert.ok(PRODUCT_PUBLISHED_REVISIONS.length >= 132);
});

test('primary short project activities stay within ten minutes and three steps', () => {
  const shortProjects = PRIMARY_5_8_PUBLISHED_REVISIONS.filter(
    (revision) => revision.duration.kind === 'minutes' && revision.duration.minutes === 10,
  );
  assert.ok(shortProjects.length >= 8);
  assert.ok(shortProjects.every((revision) => revision.steps.length <= 3));
});

test('primary activity families group related story and plan motifs', () => {
  const story = PRIMARY_5_8_PUBLISHED_REVISIONS.filter(
    (revision) => revision.activityFamilyId === 'family.primary-story',
  );
  const plan = PRIMARY_5_8_PUBLISHED_REVISIONS.filter(
    (revision) => revision.activityFamilyId === 'family.primary-plan',
  );
  assert.ok(story.length >= 3);
  assert.ok(plan.length >= 2);
});

test('signed primary content pack verifies offline without diary payloads', () => {
  const files = buildPrimary58Files();
  const { manifest } = buildPrimary58Manifest(files, EMBEDDED_PRIMARY_5_8_MANIFEST.createdAt);
  assert.equal(manifest.packId, EMBEDDED_PRIMARY_5_8_MANIFEST.packId);
  assert.equal(manifest.kind, 'content');
  assert.deepEqual(manifest.ageMonths, { fromInclusive: 60, toInclusive: 95 });
  const verified = verifyContentPack(
    EMBEDDED_PRIMARY_5_8_MANIFEST,
    EMBEDDED_PRIMARY_5_8_SIGNATURE,
    files,
  );
  assert.equal(verified.ok, true);
  assert.equal(JSON.stringify(manifest).includes('CANARY'), false);
});
