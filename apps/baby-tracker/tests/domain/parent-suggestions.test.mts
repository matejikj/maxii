import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  asActorId,
  asChildId,
  asEntityId,
  authorLearnsPrivateAcceptOrDismiss,
  createParentSuggestion,
  dismissParentSuggestion,
  acceptParentSuggestionIntoPrivate,
  presentChildPrivateModeStatus,
  presentSuggestionToAuthor,
  startSuggestionTogether,
  withdrawParentSuggestion,
} from '../../src/domain/index.ts';

const now = { epochMs: 1_700_000_200_000 };
const later = { epochMs: 1_700_000_300_000 };

function pending() {
  return createParentSuggestion({
    suggestionId: asEntityId('sug_1'),
    childId: asChildId('child_a'),
    authorAppUserId: asActorId('parent_1'),
    templateRevisionId: null,
    title: 'Most z přírodnin',
    note: 'Venku u potoka',
    now,
  });
}

test('author presentation collapses accept and dismiss into delivered', () => {
  const base = pending();
  const accepted = acceptParentSuggestionIntoPrivate({
    suggestion: base,
    resultingProjectId: asEntityId('proj_private'),
    now: later,
    childPrivateModeActive: true,
  });
  const dismissed = dismissParentSuggestion(base, later, true);

  assert.equal(presentSuggestionToAuthor(accepted).delivery, 'delivered');
  assert.equal(presentSuggestionToAuthor(accepted).resultingProjectId, null);
  assert.equal(presentSuggestionToAuthor(dismissed).delivery, 'delivered');
  assert.equal(authorLearnsPrivateAcceptOrDismiss(), false);
});

test('child accept and dismiss stay unavailable when private mode is inactive', () => {
  const base = pending();
  assert.throws(
    () =>
      acceptParentSuggestionIntoPrivate({
        suggestion: base,
        resultingProjectId: asEntityId('proj_x'),
        now: later,
        childPrivateModeActive: false,
      }),
    /not activated/,
  );
  assert.throws(() => dismissParentSuggestion(base, later, false), /not activated/);
});

test('start together marks an explicit family path without private accept telemetry', () => {
  const started = startSuggestionTogether({
    suggestion: pending(),
    resultingProjectId: asEntityId('proj_family'),
    now: later,
  });
  assert.equal(started.status, 'startedTogether');
  const authorView = presentSuggestionToAuthor(started);
  assert.equal(authorView.delivery, 'started_together');
  assert.equal(authorView.resultingProjectId, 'proj_family');
});

test('withdraw only works while pending', () => {
  const withdrawn = withdrawParentSuggestion(pending(), later);
  assert.equal(withdrawn.status, 'withdrawn');
  assert.throws(() => withdrawParentSuggestion(withdrawn, later), /pending/);
});

test('settings presentation lists every closed child-mode gate in Czech', () => {
  const status = presentChildPrivateModeStatus();
  assert.equal(status.active, false);
  assert.equal(status.blockers.length, 4);
  assert.match(status.headline, /není aktivní/);
  for (const blocker of status.blockers) {
    assert.ok(blocker.label.length > 10);
  }
});
