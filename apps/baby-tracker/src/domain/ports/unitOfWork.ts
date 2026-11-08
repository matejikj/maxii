import type { CareEvent } from '../entities/careEvent';
import type { ActiveSession, SessionKind, SessionRecord } from '../entities/activeSession';
import type { ChildProfile } from '../entities/childProfile';
import type { Draft } from '../entities/draft';
import type { DeletionMarker, OperationReceipt, Revision } from '../entities/revision';
import type { ChildId, EntityId, OperationId, RevisionId } from '../ids';

/**
 * Transactional scope for one atomic care command. Concrete SQLite/Dexie
 * adapters arrive with the storage tasks; domain code only depends on this port.
 */
export type UnitOfWork = {
  care: CareRepository;
  sessions: SessionRepository;
  drafts: DraftRepository;
  revisions: RevisionRepository;
  profiles: ProfileRepository;
  meta: AppMetaRepository;
};

export type CareRepository = {
  getById(eventId: EntityId): Promise<CareEvent | null>;
  save(event: CareEvent): Promise<void>;
  /** Removes an active care row; soft-delete keeps a trash marker separately. */
  delete(eventId: EntityId): Promise<void>;
  /** Newest first by care-time sort key (not write clock). Soft-deleted rows are absent. */
  listRecent(childId: ChildId, limit: number): Promise<CareEvent[]>;
  /** Inclusive start / exclusive end on the same sort key used for timeline views. */
  listInSortRange(
    childId: ChildId,
    fromSortAtMsInclusive: number,
    toSortAtMsExclusive: number,
  ): Promise<CareEvent[]>;
};

export type SessionRepository = {
  getActive(childId: ChildId, kind: SessionKind): Promise<ActiveSession | null>;
  save(session: SessionRecord): Promise<void>;
};

export type DraftRepository = {
  getById(draftId: EntityId): Promise<Draft | null>;
  save(draft: Draft): Promise<void>;
  delete(draftId: EntityId): Promise<void>;
};

export type RevisionRepository = {
  saveRevision(revision: Revision): Promise<void>;
  findRevision(revisionId: RevisionId): Promise<Revision | null>;
  saveReceipt(receipt: OperationReceipt): Promise<void>;
  findReceipt(operationId: OperationId): Promise<OperationReceipt | null>;
  saveDeletion(marker: DeletionMarker): Promise<void>;
  findDeletion(deletionId: EntityId): Promise<DeletionMarker | null>;
  findDeletionByEntityId(entityId: EntityId): Promise<DeletionMarker | null>;
  listDeletions(): Promise<DeletionMarker[]>;
  removeDeletion(deletionId: EntityId): Promise<void>;
};

export type ProfileRepository = {
  get(childId: ChildId): Promise<ChildProfile | null>;
  list(): Promise<ChildProfile[]>;
  save(profile: ChildProfile): Promise<void>;
};

/** Small durable flags (welcome completed, active child). Never stores care notes. */
export type AppMetaRepository = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

export type UnitOfWorkFactory = {
  run<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T>;
};
