import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRevision,
  convergeByRevisions,
  createEmptyEntityGraph,
  detectConcurrentSleepSessions,
  isolateOutboxForResync,
  materializeTombstone,
  type GraphRevision,
} from '../../src/domain/index.ts';

function rev(
  overrides: Partial<GraphRevision> &
    Pick<GraphRevision, 'revisionId' | 'entityId' | 'operationId' | 'kind'>,
): GraphRevision {
  return {
    parentRevisionIds: [],
    actorId: 'actor-a',
    createdAt: '2026-11-09T00:00:00.000Z',
    state: { note: 'x' },
    ...overrides,
  };
}

test('clock skew of days does not pick a concurrent branch winner', () => {
  let state = createEmptyEntityGraph();
  state = applyRevision(
    state,
    rev({ revisionId: 'r0', entityId: 'note-1', operationId: 'op0', kind: 'create' }),
  ).state;
  state = applyRevision(
    state,
    rev({
      revisionId: 'rOldPhone',
      entityId: 'note-1',
      operationId: 'opOld',
      kind: 'update',
      parentRevisionIds: ['r0'],
      createdAt: '2026-10-01T00:00:00.000Z',
      actorId: 'actor-a',
      state: { note: 'from old clock' },
    }),
  ).state;
  const branched = applyRevision(
    state,
    rev({
      revisionId: 'rNewPhone',
      entityId: 'note-1',
      operationId: 'opNew',
      kind: 'update',
      parentRevisionIds: ['r0'],
      createdAt: '2026-11-09T12:00:00.000Z',
      actorId: 'actor-b',
      state: { note: 'from new clock' },
    }),
  );
  assert.equal(branched.ok, true);
  if (!branched.ok) return;
  assert.equal(branched.status, 'accepted_with_conflict');
  assert.deepEqual([...branched.heads].sort(), ['rNewPhone', 'rOldPhone']);
});

test('two offline sleep sessions stay distinct and are never auto-merged by time', () => {
  const detected = detectConcurrentSleepSessions({
    sessions: [
      { entityId: 'sleep-a', startedAtMs: 1_000, deviceId: 'phone-1' },
      { entityId: 'sleep-b', startedAtMs: 60_000, deviceId: 'phone-2' },
    ],
  });
  assert.equal(detected.autoMerged, false);
  assert.equal(detected.pairs.length, 1);

  let state = createEmptyEntityGraph();
  state = applyRevision(
    state,
    rev({ revisionId: 'sA', entityId: 'sleep-a', operationId: 'opA', kind: 'create' }),
  ).state;
  state = applyRevision(
    state,
    rev({ revisionId: 'sB', entityId: 'sleep-b', operationId: 'opB', kind: 'create' }),
  ).state;
  assert.deepEqual(state.headsByEntity.get('sleep-a'), ['sA']);
  assert.deepEqual(state.headsByEntity.get('sleep-b'), ['sB']);
});

test('deleted event stays gone after old phone returns; authorship preserved on resolve', () => {
  let state = createEmptyEntityGraph();
  state = applyRevision(
    state,
    rev({
      revisionId: 'r0',
      entityId: 'diaper-1',
      operationId: 'op0',
      kind: 'create',
      actorId: 'actor-a',
    }),
  ).state;
  state = applyRevision(
    state,
    rev({
      revisionId: 'rDel',
      entityId: 'diaper-1',
      operationId: 'opDel',
      kind: 'delete',
      parentRevisionIds: ['r0'],
      actorId: 'actor-b',
    }),
  ).state;
  state = materializeTombstone(state, {
    entityId: 'diaper-1',
    deletedByRevisionId: 'rDel',
    now: '2026-11-16T00:00:00.000Z',
  });
  const staleCreate = applyRevision(
    state,
    rev({
      revisionId: 'rStale',
      entityId: 'diaper-1',
      operationId: 'opStale',
      kind: 'create',
      actorId: 'actor-a',
    }),
  );
  assert.equal(staleCreate.ok, false);

  const isolated = isolateOutboxForResync({
    outbox: [
      { operationId: 'op-local', entityId: 'diaper-1', kind: 'create' },
      { operationId: 'op-other', entityId: 'note-9', kind: 'create' },
    ],
    state,
  });
  assert.deepEqual(isolated.blockedCannotResurrect, ['op-local']);
  assert.deepEqual(isolated.stillEligible, ['op-other']);
});

test('resolution and retry keep original actor intent across reorder', () => {
  const revisions: GraphRevision[] = [
    rev({
      revisionId: 'r0',
      entityId: 'e1',
      operationId: 'op0',
      kind: 'create',
      actorId: 'actor-a',
    }),
    rev({
      revisionId: 'rA',
      entityId: 'e1',
      operationId: 'opA',
      kind: 'update',
      parentRevisionIds: ['r0'],
      actorId: 'actor-a',
      state: { text: 'A' },
    }),
    rev({
      revisionId: 'rB',
      entityId: 'e1',
      operationId: 'opB',
      kind: 'update',
      parentRevisionIds: ['r0'],
      actorId: 'actor-b',
      state: { text: 'B' },
    }),
    rev({
      revisionId: 'rRes',
      entityId: 'e1',
      operationId: 'opRes',
      kind: 'resolve',
      parentRevisionIds: ['rA', 'rB'],
      actorId: 'actor-a',
      state: { text: 'chosen-A', resolvedFrom: ['rA', 'rB'] },
    }),
  ];
  const state = convergeByRevisions([...revisions].reverse());
  assert.deepEqual(state.headsByEntity.get('e1'), ['rRes']);
  assert.equal(state.revisions.get('rA')?.actorId, 'actor-a');
  assert.equal(state.revisions.get('rB')?.actorId, 'actor-b');
  assert.equal(state.revisions.get('rRes')?.actorId, 'actor-a');
});
