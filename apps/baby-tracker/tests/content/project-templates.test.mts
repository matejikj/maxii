import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PROJECT_TEMPLATES_CONTENT_VERSION,
  PROJECT_TEMPLATES_PUBLISHED,
  listProjectTemplatesByCohort,
} from '../../src/content/catalog/projectTemplatesPublished.ts';
import { PROJECT_LIMITS } from '../../src/domain/index.ts';

test('publishes exactly twelve project templates across three cohorts', () => {
  assert.equal(PROJECT_TEMPLATES_CONTENT_VERSION, 'project-templates.v1');
  assert.equal(PROJECT_TEMPLATES_PUBLISHED.length, 12);
  assert.equal(listProjectTemplatesByCohort('8-11').length, 4);
  assert.equal(listProjectTemplatesByCohort('12-14').length, 4);
  assert.equal(listProjectTemplatesByCohort('15-17').length, 4);
});

test('each published template keeps three steps and length limits', () => {
  const revisionIds = new Set<string>();
  for (const template of PROJECT_TEMPLATES_PUBLISHED) {
    assert.equal(template.language, 'cs');
    assert.equal(template.steps.length, 3);
    assert.ok(template.title.length > 0 && template.title.length <= PROJECT_LIMITS.titleMaxChars);
    assert.ok(template.intent.length <= PROJECT_LIMITS.intentMaxChars);
    for (const step of template.steps) {
      assert.ok(step.length > 0 && step.length <= PROJECT_LIMITS.stepMaxChars);
    }
    assert.ok(template.constraints.length > 0);
    assert.ok(template.sources.length > 0);
    assert.equal(revisionIds.has(template.revisionId), false);
    revisionIds.add(template.revisionId);
  }
});
