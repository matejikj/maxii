export type {
  ApplyResult,
  ConflictRecord,
  EntityGraphState,
  GraphRevision,
  TombstoneRecord,
} from './revisionGraph.ts';
export {
  applyRevision,
  bumpEraseGeneration,
  convergeByRevisions,
  createEmptyEntityGraph,
  materializeTombstone,
} from './revisionGraph.ts';

export type EntityHeadsView = {
  readonly entityId: string;
  readonly headRevisionIds: readonly string[];
  readonly conflictId: string | null;
  readonly tombstoned: boolean;
};
