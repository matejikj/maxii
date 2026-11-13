import { listInstalledArtCapabilities } from '../../src/content/pack/capabilities.ts';
import { activateEmbeddedFirstYearBase } from '../../src/content/pack/loadEmbeddedBase.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRODUCT_PUBLISHED_REVISIONS } from '../../src/content/catalog/productPublished.ts';
import {
  ACTIVITY_DEMONSTRATIONS,
  resolveActivityDemonstration,
} from '../../src/features/development/activityDemonstrations.ts';

test('every published game has an explicit illustration bound to its reviewed revision', () => {
  assert.equal(PRODUCT_PUBLISHED_REVISIONS.length, 132);
  assert.equal(Object.keys(ACTIVITY_DEMONSTRATIONS).length, PRODUCT_PUBLISHED_REVISIONS.length);
  for (const revision of PRODUCT_PUBLISHED_REVISIONS) {
    const demo = resolveActivityDemonstration(revision);
    assert.ok(demo, revision.activityId);
    assert.equal(demo.revisionId, revision.revisionId);
    if (demo.babyPose === 'sitting' && revision.ageMonths.fromInclusive < 12) {
      assert.ok(
        revision.suitability.some(
          (rule) => rule.kind === 'readiness_confirmed' && rule.key === 'floorSit',
        ),
      );
    }
  }
});
test('changed revisions and unknown activities cannot silently receive an unrelated demo', () => {
  assert.equal(
    resolveActivityDemonstration({ activityId: 'face-hello', revisionId: 'face-hello.future' }),
    null,
  );
  assert.equal(
    resolveActivityDemonstration({ activityId: 'unknown', revisionId: 'unknown.r1' }),
    null,
  );
});
test('different instructions use the appropriate toy, actor and distinct action', () => {
  assert.equal(ACTIVITY_DEMONSTRATIONS['parent-peekaboo']?.action, 'peekaboo');
  assert.equal(ACTIVITY_DEMONSTRATIONS['awake-tummy-moment']?.babyPose, 'tummy');
  assert.equal(ACTIVITY_DEMONSTRATIONS['rolling-turns']?.action, 'roll');
  assert.equal(ACTIVITY_DEMONSTRATIONS['animal-picture-sound']?.object, 'animalCard');
  assert.equal(ACTIVITY_DEMONSTRATIONS['toddler-toy-under-cloth-edge']?.action, 'hideToy');
  assert.equal(ACTIVITY_DEMONSTRATIONS['book-ending-ritual']?.action, 'closeBook');
});

test('new installed guides preserve the signed generation-1 game pack bytes', () => {
  const installed = listInstalledArtCapabilities();
  assert.ok(installed.includes('art.species.tiger'));
  assert.ok(installed.includes('art.species.hippo'));
  assert.doesNotThrow(() => activateEmbeddedFirstYearBase(Date.UTC(2026, 10, 13)));
});
