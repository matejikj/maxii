import type { AttachmentRepository } from '../attachments/ports';
import type { DiaryArchive } from '../backup/diaryArchive';
import type { CareEvent } from '../entities/careEvent';
import type { ActiveSession, SessionKind, SessionRecord } from '../entities/activeSession';
import type { ChildProfile } from '../entities/childProfile';
import type { Draft } from '../entities/draft';
import type { DeletionMarker, OperationReceipt, Revision } from '../entities/revision';
import type { ChildId, EntityId, OperationId, RevisionId } from '../ids';
import type {
  ParentSuggestionRepository,
  PortfolioRepository,
  ProjectRepository,
  ShareRepository,
} from '../projects/ports';
import type { TimelineCursor } from '../projections/historyQuery';

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
  search: SearchIndexRepository;
  /**
   * Photo attachment metadata in the same private DB transaction as care rows.
   * Sealed JPEG bytes stay in the private blob store; this repo only keeps links.
   */
  attachments: AttachmentRepository;
  /**
   * Local project rows (familyGuided today; childPrivate stays gated). Cleared
   * with diary replace/wipe so projects never survive a full personal erase.
   */
  projects: ProjectRepository;
  /** Explicit portfolio selections — private until a share snapshot is published. */
  portfolio: PortfolioRepository;
  /** Immutable share snapshots with named audiences and revoke state. */
  shares: ShareRepository;
  /** Caregiver proposals to a child — cleared with diary wipe/replace. */
  parentSuggestions: ParentSuggestionRepository;
  /** Personal replace/export helpers stay inside the same private DB boundary. */
  diary: DiarySnapshotRepository;
};

export type CarePage = {
  events: CareEvent[];
  /** Null when the page was shorter than the requested limit (end of history). */
  nextCursor: TimelineCursor | null;
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
  /**
   * Descending care-time page with exclusive cursor. Inserts newer than the
   * cursor never displace older rows off the next page.
   */
  listPage(
    childId: ChildId,
    limit: number,
    before: TimelineCursor | null,
  ): Promise<CarePage>;
};

export type SessionRepository = {
  getActive(childId: ChildId, kind: SessionKind): Promise<ActiveSession | null>;
  save(session: SessionRecord): Promise<void>;
  listAll(): Promise<SessionRecord[]>;
};

export type DraftRepository = {
  getById(draftId: EntityId): Promise<Draft | null>;
  save(draft: Draft): Promise<void>;
  delete(draftId: EntityId): Promise<void>;
  /** Newest edits first; drafts are never mixed into care timelines. */
  listByChild(childId: ChildId): Promise<Draft[]>;
  listAll(): Promise<Draft[]>;
};

export type DiarySnapshotRepository = {
  /** Capture a logical archive of the live personal diary. */
  capture(input: { createdAtMs: number; schemaCompatibility: number }): Promise<DiaryArchive>;
  /**
   * Atomically replace the live diary. Callers must create a rollback checkpoint
   * first; this method itself never merges with existing rows.
   */
  replace(archive: DiaryArchive): Promise<void>;
};

/**
 * Rebuildable local search documents. Lives behind the same private DB boundary
 * as care rows; query strings stay on-device.
 */
export type SearchIndexRepository = {
  upsertFromCare(event: CareEvent): Promise<void>;
  remove(entityId: EntityId): Promise<void>;
  /** Clears and rebuilds documents for one child from live care rows. */
  rebuildForChild(childId: ChildId): Promise<number>;
  search(
    childId: ChildId,
    normalizedQuery: string,
    limit: number,
    before: TimelineCursor | null,
  ): Promise<CarePage>;
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
  listRevisions(): Promise<Revision[]>;
  listReceipts(): Promise<OperationReceipt[]>;
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
  listEntries(): Promise<{ key: string; value: string }[]>;
};

export type UnitOfWorkFactory = {
  run<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T>;
};
