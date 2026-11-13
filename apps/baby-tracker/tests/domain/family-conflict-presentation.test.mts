import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorshipLine,
  buildDeleteVsEditPresentation,
  buildDualSleepPresentation,
  buildEditConflictPresentation,
  buildSyncTransferPresentation,
  canCommitResolutionDraft,
  createResolutionDraft,
  markResolutionDraftCommitted,
  previewMergedSleepInterval,
  refreshResolutionDraftAgainstHeads,
  unresolvedSleepUnionMs,
} from '../../src/domain/index.ts';

test('authorship never claims other devices have the change from a local save alone', () => {
  const pending = buildSyncTransferPresentation({
    pendingTransferCount: 2,
    inFlight: false,
    lastSuccessfulSyncAt: null,
  });
  const line = buildAuthorshipLine({
    originalAuthorLabel: 'Anna',
    lastEditorLabel: 'Petr',
    transfer: pending,
    lastSuccessfulSyncAtLabel: null,
  });
  assert.equal(line.originalAuthorLabel, 'Anna');
  assert.equal(line.lastEditorLabel, 'Petr');
  assert.match(line.transferLine ?? '', /Čeká na přenos/);
  assert.doesNotMatch(line.transferLine ?? '', /ostatní zařízení už mají/);
});

test('edit conflict presents side-by-side fields without a preselected choice', () => {
  const presentation = buildEditConflictPresentation({
    leftAuthorLabel: 'Anna',
    rightAuthorLabel: 'Petr',
    leftOccurredLabel: '10:00',
    rightOccurredLabel: '10:04',
    fields: [
      { fieldLabel: 'Poznámka', leftValue: 'klidný', rightValue: 'neklidný' },
      { fieldLabel: 'Strana', leftValue: 'left', rightValue: 'left' },
    ],
  });
  assert.equal(presentation.title, 'Souběžná úprava — zkontrolujte');
  assert.equal(presentation.preselectedChoiceId, null);
  assert.equal(presentation.fields.filter((field) => field.changed).length, 1);
  assert.deepEqual(
    presentation.choices.map((choice) => choice.id),
    ['choose_left', 'choose_right', 'manual'],
  );
});

test('dual sleep review never auto-merges and never claims the child just woke', () => {
  const left = {
    entityId: 'sleep-a',
    authorLabel: 'Anna',
    deviceLabel: 'telefon A',
    status: 'active' as const,
    startLabel: '10:00',
    durationLabel: 'běží',
    precisionLabel: 'exact' as const,
    startMs: 10_000,
    endMs: null,
  };
  const right = {
    entityId: 'sleep-b',
    authorLabel: 'Petr',
    deviceLabel: 'telefon B',
    status: 'completed' as const,
    startLabel: '10:04',
    durationLabel: '40 min',
    precisionLabel: 'approximate' as const,
    startMs: 14_000,
    endMs: 54_000,
  };
  const presentation = buildDualSleepPresentation({ left, right });
  assert.equal(presentation.title, 'Dvě měření spánku — zkontrolujte');
  assert.equal(presentation.preselectedChoiceId, null);
  assert.equal(presentation.claimsChildWoke, false);
  assert.ok(presentation.choices.some((choice) => choice.id === 'merge'));
  assert.ok(presentation.choices.some((choice) => choice.id === 'keep_both'));
});

test('merged sleep preview uses union bounds and incomplete ends stay explicit', () => {
  const preview = previewMergedSleepInterval({
    left: { entityId: 'a', startMs: 1000, endMs: 5000 },
    right: { entityId: 'b', startMs: 3000, endMs: 9000 },
    nowMs: 20_000,
  });
  assert.ok(!('ok' in preview));
  if ('ok' in preview) return;
  assert.equal(preview.startMs, 1000);
  assert.equal(preview.endMs, 9000);
  assert.equal(preview.durationMs, 8000);
  assert.deepEqual(preview.sourceEntityIds, ['a', 'b']);
});

test('overlapping known sleeps count once via union, never double-sum', () => {
  const union = unresolvedSleepUnionMs([
    { startMs: 0, endMs: 100 },
    { startMs: 50, endMs: 150 },
    { startMs: 200, endMs: 250 },
  ]);
  assert.equal(union, 200);
});

test('delete vs edit keeps restore window explicit and opening does not undo delete', () => {
  const presentation = buildDeleteVsEditPresentation({
    deletedSummary: 'Plenka 09:10',
    editSummary: 'Plenka → mokrá',
    restoreAvailableUntilLabel: 'do 18:00',
  });
  assert.equal(presentation.openingVariantUndoesDelete, false);
  assert.equal(presentation.preselectedChoiceId, null);
  assert.equal(presentation.restoreAvailableUntilLabel, 'do 18:00');
});

test('resolution draft stays a concept when remote heads change mid-review', () => {
  const draft = createResolutionDraft({
    draftId: 'd1',
    entityIds: ['sleep-a', 'sleep-b'],
    basedOnHeadRevisionIds: ['rA', 'rB'],
    choiceId: 'merge',
    updatedAt: '2026-11-09T12:00:00.000Z',
  });
  assert.equal(canCommitResolutionDraft(draft), true);

  const stale = refreshResolutionDraftAgainstHeads(draft, ['rA', 'rB', 'rC']);
  assert.equal(stale.status, 'stale_heads');
  assert.equal(canCommitResolutionDraft(stale), false);
  assert.equal(stale.choiceId, 'merge');

  const refreshed = refreshResolutionDraftAgainstHeads(stale, ['rA', 'rB']);
  assert.equal(refreshed.status, 'active');

  const committed = markResolutionDraftCommitted(draft);
  assert.equal(committed.status, 'committed');
  assert.equal(refreshResolutionDraftAgainstHeads(committed, ['rX']).status, 'committed');
});
