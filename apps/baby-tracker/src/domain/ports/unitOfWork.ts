import type { CareEvent } from '../entities/careEvent';
import type { ActiveSession, SessionKind, SessionRecord } from '../entities/activeSession';
import type { ChildProfile } from '../entities/childProfile';
import type { Draft } from '../entities/draft';
import type { DeletionMarker, OperationReceipt, Revision } from '../entities/revision';
import type { ChildId, EntityId, OperationId } from '../ids';

/**
 * Transactional scope for one atomic care command. Concrete SQLite/Dexie
 * adapters arrive with the storage tasks; domain code only depends on this port.
 */
export type UnitOfWork = {
  care: CareRepository;
  sessions: SessionRepository;
  drafts: DraftRepository;
  revisions: RevisionRepository;
};

export type CareRepository = {
  getById(eventId: EntityId): Promise<CareEvent | null>;
  save(event: CareEvent): Promise<void>;
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
  saveReceipt(receipt: OperationReceipt): Promise<void>;
  findReceipt(operationId: OperationId): Promise<OperationReceipt | null>;
  saveDeletion(marker: DeletionMarker): Promise<void>;
};

export type ProfileRepository = {
  get(childId: ChildId): Promise<ChildProfile | null>;
  save(profile: ChildProfile): Promise<void>;
};

export type UnitOfWorkFactory = {
  run<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T>;
};
