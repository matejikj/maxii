import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRevision,
  bumpEraseGeneration,
  convergeByRevisions,
  createEmptyEntityGraph,
  materializeTombstone,
  type GraphRevision,
} from '../src/index.ts';

function rev(
  overrides: Partial<GraphRevision> &
    Pick<GraphRevision, 'revisionId' | 'entityId' | 'operationId' | 'kind'>,
): GraphRevision {
  return {
    parentRevisionIds: [],
    actorId: 'actor',
    createdAt: '2026-11-09T00:00:00.000Z',
    state: { v: 1 },
    ...overrides,
  };
}

test('concurrent updates from the same head keep both branches regardless of wall clock', () => {
  let state = createEmptyEntityGraph();
  state = applyRevision(
    state,
    rev({
      revisionId: 'r0',
      entityId: 'e1',
      operationId: 'op0',
      kind: 'create',
    }),
  ).state;

  const earlyClock = applyRevision(
    state,
    rev({
      revisionId: 'rA',
      entityId: 'e1',
      operationId: 'opA',
      kind: 'update',
      parentRevisionIds: ['r0'],
      createdAt: '2026-11-01T00:00:00.000Z',
      state: { text: 'A' },
    }),
  );
  assert.equal(earlyClock.ok, true);
  const lateClock = applyRevision(
    earlyClock.state,
    rev({
      revisionId: 'rB',
      entityId: 'e1',
      operationId: 'opB',
      kind: 'update',
      parentRevisionIds: ['r0'],
      createdAt: '2026-11-20T00:00:00.000Z',
      state: { text: 'B' },
    }),
  );
  assert.equal(lateClock.ok, true);
  if (!lateClock.ok) return;
  assert.equal(lateClock.status, 'accepted_with_conflict');
  assert.deepEqual([...lateClock.heads].sort(), ['rA', 'rB']);
});

test('delivery reorder converges to the same heads', () => {
  const revisions: GraphRevision[] = [
    rev({ revisionId: 'r0', entityId: 'e1', operationId: 'op0', kind: 'create' }),
    rev({
      revisionId: 'rA',
      entityId: 'e1',
      operationId: 'opA',
      kind: 'update',
      parentRevisionIds: ['r0'],
    }),
    rev({
      revisionId: 'rB',
      entityId: 'e1',
      operationId: 'opB',
      kind: 'update',
      parentRevisionIds: ['r0'],
    }),
  ];
  const forward = convergeByRevisions(revisions);
  const reverse = convergeByRevisions([...revisions].reverse());
  assert.deepEqual(
    [...(forward.headsByEntity.get('e1') ?? [])].sort(),
    [...(reverse.headsByEntity.get('e1') ?? [])].sort(),
  );
});

test('delete wins visible history and tombstone blocks automatic resurrection', () => {
  let state = createEmptyEntityGraph();
  state = applyRevision(
    state,
    rev({ revisionId: 'r0', entityId: 'e1', operationId: 'op0', kind: 'create' }),
  ).state;
  state = applyRevision(
    state,
    rev({
      revisionId: 'rDel',
      entityId: 'e1',
      operationId: 'opDel',
      kind: 'delete',
      parentRevisionIds: ['r0'],
    }),
  ).state;
  state = materializeTombstone(state, {
    entityId: 'e1',
    deletedByRevisionId: 'rDel',
    now: '2026-11-16T00:00:00.000Z',
  });
  assert.equal(state.revisions.get('rDel')?.state, null);
  const resurrect = applyRevision(
    state,
    rev({ revisionId: 'rNew', entityId: 'e1', operationId: 'opNew', kind: 'create' }),
  );
  assert.equal(resurrect.ok, false);
  if (resurrect.ok) return;
  assert.equal(resurrect.reason, 'cannot_auto_resurrect');

  const migrated = bumpEraseGeneration(state);
  assert.equal(migrated.erasedGeneration, state.erasedGeneration + 1);
  assert.ok(migrated.tombstones.has('e1'));
});

test('resolution must cite every head or the conflict reopens', () => {
  let state = createEmptyEntityGraph();
  state = applyRevision(
    state,
    rev({ revisionId: 'r0', entityId: 'e1', operationId: 'op0', kind: 'create' }),
  ).state;
  state = applyRevision(
    state,
    rev({
      revisionId: 'rA',
      entityId: 'e1',
      operationId: 'opA',
      kind: 'update',
      parentRevisionIds: ['r0'],
    }),
  ).state;
  state = applyRevision(
    state,
    rev({
      revisionId: 'rB',
      entityId: 'e1',
      operationId: 'opB',
      kind: 'update',
      parentRevisionIds: ['r0'],
    }),
  ).state;
  const incomplete = applyRevision(
    state,
    rev({
      revisionId: 'rRes',
      entityId: 'e1',
      operationId: 'opRes',
      kind: 'resolve',
      parentRevisionIds: ['rA'],
    }),
  );
  assert.equal(incomplete.ok, true);
  if (!incomplete.ok) return;
  assert.equal(incomplete.status, 'accepted_with_conflict');

  const complete = applyRevision(
    state,
    rev({
      revisionId: 'rRes2',
      entityId: 'e1',
      operationId: 'opRes2',
      kind: 'resolve',
      parentRevisionIds: ['rA', 'rB'],
    }),
  );
  assert.equal(complete.ok, true);
  if (!complete.ok) return;
  assert.equal(complete.status, 'accepted');
  assert.deepEqual(complete.heads, ['rRes2']);
});
