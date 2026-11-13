/**
 * Revision-graph causality. Wall-clock timestamps never choose a concurrent
 * edit winner — only parent links and explicit resolutions do.
 */

export type GraphRevision = {
  readonly revisionId: string;
  readonly entityId: string;
  readonly operationId: string;
  readonly parentRevisionIds: readonly string[];
  readonly kind: 'create' | 'update' | 'delete' | 'restore' | 'resolve' | 'merge_sleep';
  readonly actorId: string | null;
  readonly createdAt: string;
  readonly state: Readonly<Record<string, unknown>> | null;
};

export type ConflictRecord = {
  readonly conflictId: string;
  readonly entityId: string;
  readonly headRevisionIds: readonly string[];
  readonly createdAt: string;
  readonly resolvedByRevisionId: string | null;
};

export type TombstoneRecord = {
  readonly entityId: string;
  readonly deletedByRevisionId: string;
  readonly erasedGeneration: number;
  readonly payload: null;
  readonly createdAt: string;
};

export type EntityGraphState = {
  readonly revisions: ReadonlyMap<string, GraphRevision>;
  readonly headsByEntity: ReadonlyMap<string, readonly string[]>;
  readonly conflicts: ReadonlyMap<string, ConflictRecord>;
  readonly tombstones: ReadonlyMap<string, TombstoneRecord>;
  readonly erasedGeneration: number;
};

export type ApplyResult =
  | {
      readonly ok: true;
      readonly status: 'accepted' | 'accepted_with_conflict';
      readonly heads: readonly string[];
      readonly conflictId: string | null;
      readonly state: EntityGraphState;
    }
  | {
      readonly ok: false;
      readonly reason: 'unknown_parents' | 'tombstoned' | 'validation' | 'cannot_auto_resurrect';
      readonly state: EntityGraphState;
    };

export function createEmptyEntityGraph(erasedGeneration = 1): EntityGraphState {
  return {
    revisions: new Map(),
    headsByEntity: new Map(),
    conflicts: new Map(),
    tombstones: new Map(),
    erasedGeneration,
  };
}

export function applyRevision(state: EntityGraphState, revision: GraphRevision): ApplyResult {
  if (!revision.revisionId || !revision.entityId || !revision.operationId) {
    return { ok: false, reason: 'validation', state };
  }
  if (state.revisions.has(revision.revisionId)) {
    const heads = state.headsByEntity.get(revision.entityId) ?? [revision.revisionId];
    return { ok: true, status: 'accepted', heads, conflictId: null, state };
  }

  const tombstone = state.tombstones.get(revision.entityId);
  if (tombstone && revision.kind === 'create') {
    return { ok: false, reason: 'cannot_auto_resurrect', state };
  }
  if (tombstone && revision.kind !== 'restore') {
    return { ok: false, reason: 'tombstoned', state };
  }

  for (const parentId of revision.parentRevisionIds) {
    if (!state.revisions.has(parentId)) {
      return { ok: false, reason: 'unknown_parents', state };
    }
  }

  const revisions = new Map(state.revisions);
  revisions.set(revision.revisionId, revision);
  const headsByEntity = new Map(state.headsByEntity);
  const conflicts = new Map(state.conflicts);
  const tombstones = new Map(state.tombstones);
  const currentHeads = [...(headsByEntity.get(revision.entityId) ?? [])];

  if (revision.kind === 'create') {
    if (currentHeads.length > 0) {
      return { ok: false, reason: 'validation', state };
    }
    headsByEntity.set(revision.entityId, [revision.revisionId]);
    return okAccepted(state, revisions, headsByEntity, conflicts, tombstones, [
      revision.revisionId,
    ]);
  }

  if (revision.kind === 'delete') {
    headsByEntity.set(revision.entityId, [revision.revisionId]);
    for (const [conflictId, conflict] of conflicts) {
      if (conflict.entityId === revision.entityId && conflict.resolvedByRevisionId == null) {
        conflicts.set(conflictId, {
          ...conflict,
          resolvedByRevisionId: revision.revisionId,
        });
      }
    }
    return okAccepted(state, revisions, headsByEntity, conflicts, tombstones, [
      revision.revisionId,
    ]);
  }

  if (revision.kind === 'restore') {
    if (!tombstone && !currentHeads.some((id) => revisions.get(id)?.kind === 'delete')) {
      return { ok: false, reason: 'validation', state };
    }
    tombstones.delete(revision.entityId);
    headsByEntity.set(revision.entityId, [revision.revisionId]);
    return okAccepted(state, revisions, headsByEntity, conflicts, tombstones, [
      revision.revisionId,
    ]);
  }

  if (revision.kind === 'resolve' || revision.kind === 'merge_sleep') {
    const unresolved = [...conflicts.values()].find(
      (item) => item.entityId === revision.entityId && item.resolvedByRevisionId == null,
    );
    const required = new Set(unresolved?.headRevisionIds ?? currentHeads);
    for (const parentId of revision.parentRevisionIds) {
      required.delete(parentId);
    }
    if (required.size > 0) {
      const conflictId =
        unresolved?.conflictId ?? `conflict:${revision.entityId}:${revision.revisionId}`;
      const nextHeads = unique([...currentHeads, revision.revisionId]);
      headsByEntity.set(revision.entityId, nextHeads);
      conflicts.set(conflictId, {
        conflictId,
        entityId: revision.entityId,
        headRevisionIds: nextHeads,
        createdAt: revision.createdAt,
        resolvedByRevisionId: null,
      });
      return {
        ok: true,
        status: 'accepted_with_conflict',
        heads: nextHeads,
        conflictId,
        state: { ...state, revisions, headsByEntity, conflicts, tombstones },
      };
    }
    if (unresolved) {
      conflicts.set(unresolved.conflictId, {
        ...unresolved,
        resolvedByRevisionId: revision.revisionId,
      });
    }
    headsByEntity.set(revision.entityId, [revision.revisionId]);
    return okAccepted(state, revisions, headsByEntity, conflicts, tombstones, [
      revision.revisionId,
    ]);
  }

  const parents = new Set(revision.parentRevisionIds);
  if (currentHeads.length === 0) {
    return { ok: false, reason: 'validation', state };
  }
  const coversAllHeads = currentHeads.every((head) => parents.has(head));
  const coveredHeads = currentHeads.filter((head) => parents.has(head));

  if (coversAllHeads && currentHeads.length === 1) {
    headsByEntity.set(revision.entityId, [revision.revisionId]);
    return okAccepted(state, revisions, headsByEntity, conflicts, tombstones, [
      revision.revisionId,
    ]);
  }

  if (coveredHeads.length > 0) {
    const remaining = currentHeads.filter((head) => !parents.has(head));
    const nextHeads = unique([...remaining, revision.revisionId]);
    return setHeadsMaybeConflict(
      state,
      revisions,
      headsByEntity,
      conflicts,
      tombstones,
      revision,
      nextHeads,
    );
  }

  // Parent is a known ancestor but not a current head: concurrent branch from
  // the same historical revision (classic two-phone edit). Wall clock is ignored.
  const parentIsKnownAncestor = revision.parentRevisionIds.every((parentId) =>
    revisions.has(parentId),
  );
  if (parentIsKnownAncestor) {
    const nextHeads = unique([...currentHeads, revision.revisionId]);
    return setHeadsMaybeConflict(
      state,
      revisions,
      headsByEntity,
      conflicts,
      tombstones,
      revision,
      nextHeads,
    );
  }
  return { ok: false, reason: 'unknown_parents', state };
}

function setHeadsMaybeConflict(
  state: EntityGraphState,
  revisions: Map<string, GraphRevision>,
  headsByEntity: Map<string, readonly string[]>,
  conflicts: Map<string, ConflictRecord>,
  tombstones: Map<string, TombstoneRecord>,
  revision: GraphRevision,
  nextHeads: readonly string[],
): ApplyResult {
  headsByEntity.set(revision.entityId, nextHeads);
  if (nextHeads.length === 1) {
    return okAccepted(state, revisions, headsByEntity, conflicts, tombstones, nextHeads);
  }
  const conflictId = `conflict:${revision.entityId}:${[...nextHeads].sort().join('+')}`;
  conflicts.set(conflictId, {
    conflictId,
    entityId: revision.entityId,
    headRevisionIds: nextHeads,
    createdAt: revision.createdAt,
    resolvedByRevisionId: null,
  });
  return {
    ok: true,
    status: 'accepted_with_conflict',
    heads: nextHeads,
    conflictId,
    state: { ...state, revisions, headsByEntity, conflicts, tombstones },
  };
}

export function materializeTombstone(
  state: EntityGraphState,
  input: {
    readonly entityId: string;
    readonly deletedByRevisionId: string;
    readonly now: string;
  },
): EntityGraphState {
  const revisions = new Map(state.revisions);
  const deleteRev = revisions.get(input.deletedByRevisionId);
  if (deleteRev) {
    revisions.set(input.deletedByRevisionId, { ...deleteRev, state: null });
  }
  const tombstones = new Map(state.tombstones);
  tombstones.set(input.entityId, {
    entityId: input.entityId,
    deletedByRevisionId: input.deletedByRevisionId,
    erasedGeneration: state.erasedGeneration,
    payload: null,
    createdAt: input.now,
  });
  return { ...state, revisions, tombstones };
}

export function bumpEraseGeneration(state: EntityGraphState): EntityGraphState {
  return { ...state, erasedGeneration: state.erasedGeneration + 1 };
}

export function convergeByRevisions(revisions: readonly GraphRevision[]): EntityGraphState {
  let state = createEmptyEntityGraph();
  const pending = [...revisions];
  let guard = pending.length + 2;
  while (pending.length > 0 && guard > 0) {
    guard -= 1;
    const nextRound: GraphRevision[] = [];
    for (const revision of pending) {
      const result = applyRevision(state, revision);
      if (!result.ok && result.reason === 'unknown_parents') {
        nextRound.push(revision);
        continue;
      }
      if (result.ok) state = result.state;
    }
    if (nextRound.length === pending.length) break;
    pending.splice(0, pending.length, ...nextRound);
  }
  return state;
}

function okAccepted(
  state: EntityGraphState,
  revisions: Map<string, GraphRevision>,
  headsByEntity: Map<string, readonly string[]>,
  conflicts: Map<string, ConflictRecord>,
  tombstones: Map<string, TombstoneRecord>,
  heads: readonly string[],
): ApplyResult {
  return {
    ok: true,
    status: 'accepted',
    heads,
    conflictId: null,
    state: { ...state, revisions, headsByEntity, conflicts, tombstones },
  };
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
