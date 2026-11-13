import type {
  ActiveSession,
  AppMetaRepository,
  CareEvent,
  CareRepository,
  ChildId,
  ChildProfile,
  DeletionMarker,
  DiarySnapshotRepository,
  Draft,
  DraftRepository,
  EntityId,
  FaultInjection,
  OperationId,
  OperationReceipt,
  ProfileRepository,
  Revision,
  RevisionId,
  RevisionRepository,
  SearchIndexRepository,
  SessionKind,
  SessionRecord,
  SessionRepository,
  TimelineCursor,
  UnitOfWork,
  UnitOfWorkFactory,
} from '../../../domain';
import type {
  AttachmentImportJob,
  AttachmentRepository,
  PhotoAttachment,
} from '../../../domain/attachments';
import { withOfflinePinDefault } from '../../../domain/attachments';
import type {
  ParentSuggestion,
  ParentSuggestionRepository,
  PortfolioItem,
  PortfolioRepository,
  Project,
  ProjectRepository,
  ShareRepository,
  ShareSnapshot,
} from '../../../domain/projects';
import { AppError } from '../../../domain/errors';
import {
  compareCareTimelineDesc,
  isBeforeTimelineCursor,
  nextTimelineCursor,
  searchDocumentFromCareEvent,
} from '../../../domain/projections/historyQuery';
import { assembleDiaryArchive } from '../diarySnapshotShared';
import type { ChangeTopic } from '../native/changeFeed';
import {
  careEventFromRow,
  careSortAtMs,
  deletionFromRow,
  deletionToRow,
  draftFromRow,
  draftToRow,
  encodeJson,
  profileFromRow,
  profileToRow,
  receiptFromRow,
  receiptToRow,
  revisionFromRow,
  revisionToRow,
  sessionFromRow,
  sessionToRow,
} from '../native/serialization';
import { WEB_SCHEMA_VERSION } from './lumiWebDatabase';
import type { LumiWebDatabase } from './lumiWebDatabase';
import type { TabLeaseCoordinator } from './tabLease';
import type { WebChangeFeed } from './webChangeFeed';

export type WebDiaryRuntime = {
  db: LumiWebDatabase;
  lease: TabLeaseCoordinator;
  changeFeed: WebChangeFeed;
  getDataVersion(): Promise<number>;
  bumpDataVersion(txnDb: LumiWebDatabase): Promise<number>;
};

/**
 * Dexie UnitOfWork. All repository awaits stay inside one IndexedDB transaction
 * so the browser cannot auto-commit mid-operation on a dangling Promise.
 */
export function createWebUnitOfWorkFactory(
  runtime: WebDiaryRuntime,
  options: { faults?: FaultInjection; nowMs?: () => number } = {},
): UnitOfWorkFactory {
  return {
    async run<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      if (options.faults?.shouldFail('storage_busy')) {
        throw new AppError('STORAGE', 'Database is busy or locked', {
          details: { reason: 'storage_busy' },
          retryable: true,
        });
      }
      if (options.faults?.shouldFail('storage_full')) {
        throw new AppError('STORAGE', 'Device storage is full', {
          details: { reason: 'storage_full' },
          retryable: true,
        });
      }

      await runtime.lease.reclaimExpired(options.nowMs?.() ?? Date.now());
      await runtime.lease.acquire('write');
      const topics = new Set<ChangeTopic>();
      let result: T | undefined;
      let dataVersion = 0;

      try {
        await runtime.db.transaction(
          'rw',
          [
            runtime.db.childProfiles,
            runtime.db.careEvents,
            runtime.db.sessions,
            runtime.db.drafts,
            runtime.db.revisions,
            runtime.db.operationReceipts,
            runtime.db.deletionMarkers,
            runtime.db.meta,
            runtime.db.changeNotifications,
            runtime.db.searchDocuments,
            runtime.db.photoAttachments,
            runtime.db.photoAttachmentJobs,
            runtime.db.projects,
            runtime.db.portfolioItems,
            runtime.db.shareSnapshots,
            runtime.db.parentSuggestions,
            runtime.db.childPrivateSyncState,
          ],
          async () => {
            const uow = createRepositories(runtime.db, topics);
            result = await work(uow);
            if (options.faults?.shouldFail('storage_commit')) {
              throw new AppError('STORAGE', 'Injected commit failure', {
                details: { reason: 'storage_commit' },
                retryable: true,
              });
            }
            if (topics.size > 0) {
              dataVersion = await runtime.bumpDataVersion(runtime.db);
              const publishedAtMs = options.nowMs?.() ?? Date.now();
              await runtime.db.changeNotifications.add({
                publishedAtMs,
                topicsJson: JSON.stringify([...topics]),
                dataVersion,
              });
            }
          },
        );
      } catch (error) {
        mapQuotaError(error);
        throw error;
      } finally {
        await runtime.lease.release('write');
      }

      if (topics.size > 0) {
        await runtime.changeFeed.publish(
          [...topics],
          options.nowMs?.() ?? Date.now(),
          dataVersion,
        );
      }
      return result as T;
    },
  };
}

function createRepositories(db: LumiWebDatabase, topics: Set<ChangeTopic>): UnitOfWork {
  const care: CareRepository = {
    async getById(eventId) {
      const row = await db.careEvents.get(eventId);
      if (!row) return null;
      return careEventFromRow({
        event_id: row.eventId,
        child_id: row.childId,
        event_type: row.eventType,
        revision_id: row.revisionId,
        sort_at_ms: row.sortAtMs,
        payload_json: row.payloadJson,
      });
    },
    async save(event: CareEvent) {
      await db.careEvents.put({
        eventId: event.eventId,
        childId: event.childId,
        eventType: event.type,
        revisionId: event.revisionId,
        sortAtMs: careSortAtMs(event),
        payloadJson: encodeJson(event),
      });
      await putSearchDocument(db, event);
      topics.add('care');
    },
    async delete(eventId: EntityId) {
      await db.careEvents.delete(eventId);
      await db.searchDocuments.delete(eventId);
      topics.add('care');
    },
    async listRecent(childId: ChildId, limit: number) {
      const page = await listWebCarePage(db, childId, limit, null);
      return page.events;
    },
    async listByType(childId, type) {
      const rows = await db.careEvents.where('childId').equals(childId)
        .and((row) => row.eventType === type).toArray();
      return rows.map((row) => careEventFromRow({ event_id: row.eventId, child_id: row.childId,
        event_type: row.eventType, revision_id: row.revisionId, sort_at_ms: row.sortAtMs,
        payload_json: row.payloadJson })).sort(compareCareTimelineDesc);
    },
    async listInSortRange(childId: ChildId, fromSortAtMsInclusive: number, toSortAtMsExclusive: number) {
      const rows = await db.careEvents
        .where('childId')
        .equals(childId)
        .and((row) => row.sortAtMs >= fromSortAtMsInclusive && row.sortAtMs < toSortAtMsExclusive)
        .toArray();
      return rows
        .map((row) =>
          careEventFromRow({
            event_id: row.eventId,
            child_id: row.childId,
            event_type: row.eventType,
            revision_id: row.revisionId,
            sort_at_ms: row.sortAtMs,
            payload_json: row.payloadJson,
          }),
        )
        .sort(compareCareTimelineDesc);
    },
    async listPage(childId: ChildId, limit: number, before: TimelineCursor | null) {
      return listWebCarePage(db, childId, limit, before);
    },
  };
  const sessions: SessionRepository = {
    async getActive(childId: ChildId, kind: SessionKind) {
      const row = await db.sessions
        .where('[childId+kind]')
        .equals([childId, kind])
        .filter((item) => item.status === 'running' || item.status === 'paused')
        .first();
      return row ? (sessionFromRow({ payload_json: row.payloadJson }) as ActiveSession) : null;
    },
    async save(session: SessionRecord) {
      // Enforce one local active session per kind inside the same transaction.
      if (session.status === 'running' || session.status === 'paused') {
        const clash = await db.sessions
          .where('[childId+kind]')
          .equals([session.childId, session.kind])
          .filter(
            (item) =>
              item.sessionId !== session.sessionId &&
              (item.status === 'running' || item.status === 'paused'),
          )
          .first();
        if (clash) {
          throw new AppError('CONFLICT', 'A local active session of this type already exists', {
            details: { reason: 'active_session_exists', kind: session.kind },
          });
        }
      }
      const row = sessionToRow(session);
      await db.sessions.put({
        sessionId: row.session_id,
        childId: row.child_id,
        kind: row.kind,
        status: row.status,
        payloadJson: row.payload_json,
      });
      topics.add('sessions');
    },
    async listAll() {
      const rows = await db.sessions.toArray();
      return rows.map((row) => sessionFromRow({ payload_json: row.payloadJson }) as SessionRecord);
    },
  };

  const drafts: DraftRepository = {
    async getById(draftId: EntityId) {
      const row = await db.drafts.get(draftId);
      return row ? draftFromRow({ payload_json: row.payloadJson }) : null;
    },
    async save(draft: Draft) {
      const row = draftToRow(draft);
      await db.drafts.put({
        draftId: row.draft_id,
        childId: row.child_id,
        formType: row.form_type,
        originalEventTimeMs: row.original_event_time_ms,
        updatedAtMs: row.updated_at_ms,
        payloadJson: row.payload_json,
      });
      topics.add('drafts');
    },
    async delete(draftId: EntityId) {
      await db.drafts.delete(draftId);
      topics.add('drafts');
    },
    async listByChild(childId: ChildId) {
      const rows = await db.drafts.where('childId').equals(childId).sortBy('updatedAtMs');
      return rows
        .slice()
        .reverse()
        .map((row) => draftFromRow({ payload_json: row.payloadJson }));
    },
    async listAll() {
      const rows = await db.drafts.toArray();
      return rows.map((row) => draftFromRow({ payload_json: row.payloadJson }));
    },
  };

  const search: SearchIndexRepository = {
    async upsertFromCare(event: CareEvent) {
      await putSearchDocument(db, event);
    },
    async remove(entityId: EntityId) {
      await db.searchDocuments.delete(entityId);
    },
    async rebuildForChild(childId: ChildId) {
      const existing = await db.searchDocuments.where('childId').equals(childId).primaryKeys();
      await db.searchDocuments.bulkDelete(existing);
      const rows = await db.careEvents.where('childId').equals(childId).toArray();
      for (const row of rows) {
        await putSearchDocument(
          db,
          careEventFromRow({
            event_id: row.eventId,
            child_id: row.childId,
            event_type: row.eventType,
            revision_id: row.revisionId,
            sort_at_ms: row.sortAtMs,
            payload_json: row.payloadJson,
          }),
        );
      }
      return rows.length;
    },
    async search(childId: ChildId, normalizedQuery: string, limit: number, before: TimelineCursor | null) {
      if (!normalizedQuery) {
        return listWebCarePage(db, childId, limit, before);
      }
      const docs = await db.searchDocuments
        .where('childId')
        .equals(childId)
        .filter((doc) => doc.textNormalized.includes(normalizedQuery))
        .toArray();
      const ranked = docs
        .filter((doc) => isBeforeTimelineCursor(doc.sortAtMs, doc.entityId, before))
        .sort((a, b) => {
          if (b.sortAtMs !== a.sortAtMs) return b.sortAtMs - a.sortAtMs;
          return b.entityId < a.entityId ? -1 : b.entityId > a.entityId ? 1 : 0;
        })
        .slice(0, Math.max(0, limit));
      const events: CareEvent[] = [];
      for (const doc of ranked) {
        const row = await db.careEvents.get(doc.entityId);
        if (!row) continue;
        events.push(
          careEventFromRow({
            event_id: row.eventId,
            child_id: row.childId,
            event_type: row.eventType,
            revision_id: row.revisionId,
            sort_at_ms: row.sortAtMs,
            payload_json: row.payloadJson,
          }),
        );
      }
      return {
        events,
        nextCursor: events.length < limit ? null : nextTimelineCursor(events),
      };
    },
  };

  const revisions: RevisionRepository = {
    async saveRevision(revision: Revision) {
      const row = revisionToRow(revision);
      await db.revisions.put({
        revisionId: row.revision_id,
        entityId: row.entity_id,
        operationId: row.operation_id,
        parentRevisionIdsJson: row.parent_revision_ids_json,
        commandType: row.command_type,
        createdAtMs: row.created_at_ms,
        deviceId: row.device_id == null ? null : String(row.device_id),
        actorId: row.actor_id == null ? null : String(row.actor_id),
        stateJson: row.state_json,
      });
      topics.add('revisions');
    },
    async findRevision(revisionId: RevisionId) {
      const row = await db.revisions.get(revisionId);
      if (!row) return null;
      return revisionFromRow({
        revision_id: row.revisionId,
        entity_id: row.entityId,
        operation_id: row.operationId,
        parent_revision_ids_json: row.parentRevisionIdsJson,
        command_type: row.commandType,
        created_at_ms: row.createdAtMs,
        device_id: row.deviceId,
        actor_id: row.actorId,
        state_json: row.stateJson,
      });
    },
    async saveReceipt(receipt: OperationReceipt) {
      const row = receiptToRow(receipt);
      await db.operationReceipts.put({
        operationId: row.operation_id,
        commandType: row.command_type,
        intentCapturedAtMs: row.intent_captured_at_ms,
        completedAtMs: row.completed_at_ms,
        entityIdsJson: row.entity_ids_json,
        revisionIdsJson: row.revision_ids_json,
        resultCode: row.result_code,
      });
      topics.add('revisions');
    },
    async findReceipt(operationId: OperationId) {
      const row = await db.operationReceipts.get(operationId);
      if (!row) return null;
      return receiptFromRow({
        operation_id: row.operationId,
        command_type: row.commandType,
        intent_captured_at_ms: row.intentCapturedAtMs,
        completed_at_ms: row.completedAtMs,
        entity_ids_json: row.entityIdsJson,
        revision_ids_json: row.revisionIdsJson,
        result_code: row.resultCode as 'savedLocally',
      });
    },
    async saveDeletion(marker: DeletionMarker) {
      const row = deletionToRow(marker);
      await db.deletionMarkers.put({
        deletionId: row.deletion_id,
        entityId: row.entity_id,
        entityType: row.entity_type,
        deletedAtMs: row.deleted_at_ms,
        revisionId: row.revision_id,
        retainUntilMs: row.retain_until_ms,
        payloadJson: row.payload_json,
        payloadPurged: row.payload_purged,
      });
      topics.add('revisions');
    },
    async findDeletion(deletionId: EntityId) {
      const row = await db.deletionMarkers.get(deletionId);
      return row ? webDeletionFromRow(row) : null;
    },
    async findDeletionByEntityId(entityId: EntityId) {
      const row = await db.deletionMarkers.where('entityId').equals(entityId).first();
      return row ? webDeletionFromRow(row) : null;
    },
    async listDeletions() {
      const rows = await db.deletionMarkers.toArray();
      return rows.map(webDeletionFromRow);
    },
    async removeDeletion(deletionId: EntityId) {
      await db.deletionMarkers.delete(deletionId);
      topics.add('revisions');
    },
    async listRevisions() {
      const rows = await db.revisions.toArray();
      return rows.map((row) =>
        revisionFromRow({
          revision_id: row.revisionId,
          entity_id: row.entityId,
          operation_id: row.operationId,
          parent_revision_ids_json: row.parentRevisionIdsJson,
          command_type: row.commandType,
          created_at_ms: row.createdAtMs,
          device_id: row.deviceId,
          actor_id: row.actorId,
          state_json: row.stateJson,
        }),
      );
    },
    async listReceipts() {
      const rows = await db.operationReceipts.toArray();
      return rows.map((row) =>
        receiptFromRow({
          operation_id: row.operationId,
          command_type: row.commandType,
          intent_captured_at_ms: row.intentCapturedAtMs,
          completed_at_ms: row.completedAtMs,
          entity_ids_json: row.entityIdsJson,
          revision_ids_json: row.revisionIdsJson,
          result_code: row.resultCode as 'savedLocally',
        }),
      );
    },
  };

  const profiles: ProfileRepository = {
    async get(childId: ChildId) {
      const row = await db.childProfiles.get(childId);
      return row ? profileFromRow({ payload_json: row.payloadJson }) : null;
    },
    async list() {
      const rows = await db.childProfiles.toArray();
      return rows.map((row) => profileFromRow({ payload_json: row.payloadJson }));
    },
    async save(profile: ChildProfile) {
      const row = profileToRow(profile);
      await db.childProfiles.put({
        childId: row.child_id,
        displayName: row.display_name,
        birthDate: row.birth_date,
        summaryTimeZone: row.summary_time_zone,
        payloadJson: row.payload_json,
      });
      topics.add('profile');
    },
  };

  const meta: AppMetaRepository = {
    async get(key: string) {
      const row = await db.meta.get(key);
      return row?.value ?? null;
    },
    async set(key: string, value: string) {
      await db.meta.put({ key, value });
    },
    async listEntries() {
      const rows = await db.meta.toArray();
      return rows.map((row) => ({ key: row.key, value: row.value }));
    },
  };

  const attachments: AttachmentRepository = {
    async listForEvent(eventId) {
      const rows = await db.photoAttachments.where('eventId').equals(eventId).sortBy('orderIndex');
      return rows
        .filter((row) => row.deletedAtMs == null)
        .map((row) => withOfflinePinDefault(JSON.parse(row.payloadJson) as PhotoAttachment));
    },
    async listAll() {
      const rows = await db.photoAttachments.orderBy('createdAtMs').toArray();
      return rows
        .filter((row) => row.deletedAtMs == null)
        .map((row) => withOfflinePinDefault(JSON.parse(row.payloadJson) as PhotoAttachment));
    },
    async listSoftDeleted() {
      const rows = await db.photoAttachments.filter((row) => row.deletedAtMs != null).toArray();
      return rows
        .map((row) => withOfflinePinDefault(JSON.parse(row.payloadJson) as PhotoAttachment))
        .sort((a, b) => (a.deletedAtMs ?? 0) - (b.deletedAtMs ?? 0));
    },
    async getById(attachmentId) {
      const row = await db.photoAttachments.get(attachmentId);
      return row
        ? withOfflinePinDefault(JSON.parse(row.payloadJson) as PhotoAttachment)
        : null;
    },
    async save(attachment) {
      await db.photoAttachments.put({
        attachmentId: attachment.attachmentId,
        childId: attachment.childId,
        eventId: attachment.eventId,
        hostEventType: attachment.hostEventType,
        orderIndex: attachment.orderIndex,
        caption: attachment.caption,
        recordedBy: attachment.recordedBy,
        createdAtMs: attachment.createdAtMs,
        deletedAtMs: attachment.deletedAtMs,
        retainUntilMs: attachment.retainUntilMs,
        payloadJson: JSON.stringify(attachment),
      });
      topics.add('attachments');
    },
    async softDelete({ attachmentId, deletedAtMs, retainUntilMs }) {
      const current = await this.getById(attachmentId);
      if (!current) return;
      await this.save({ ...current, deletedAtMs, retainUntilMs });
    },
    async saveJob(job) {
      await db.photoAttachmentJobs.put({
        jobId: job.jobId,
        attachmentId: job.attachmentId,
        childId: job.childId,
        eventId: job.eventId,
        state: job.state,
        errorCode: job.errorCode,
        sourceMime: job.sourceMime,
        createdAtMs: job.createdAtMs,
        updatedAtMs: job.updatedAtMs,
        payloadJson: JSON.stringify(job),
      });
      topics.add('attachments');
    },
    async getJob(jobId) {
      const row = await db.photoAttachmentJobs.get(jobId);
      return row ? (JSON.parse(row.payloadJson) as AttachmentImportJob) : null;
    },
    async listJobsForEvent(eventId) {
      const rows = await db.photoAttachmentJobs.where('eventId').equals(eventId).toArray();
      return rows.map((row) => JSON.parse(row.payloadJson) as AttachmentImportJob);
    },
  };

  const projects: ProjectRepository = {
    async getById(projectId) {
      const row = await db.projects.get(projectId);
      return row ? (JSON.parse(row.payloadJson) as Project) : null;
    },
    async save(project) {
      await db.projects.put({
        projectId: project.projectId,
        childId: project.childId,
        scope: project.scope,
        status: project.status,
        ownerAppUserId: project.ownerAppUserId,
        creatorAppUserId: project.creatorAppUserId,
        familyId: project.familyId,
        templateRevisionId: project.templateRevisionId,
        updatedAtMs: project.updatedAt.epochMs,
        payloadJson: JSON.stringify(project),
      });
      topics.add('projects');
    },
    async delete(projectId) {
      await db.projects.delete(projectId);
      topics.add('projects');
    },
    async listByChild(childId) {
      const rows = await db.projects.where('childId').equals(childId).reverse().sortBy('updatedAtMs');
      return rows.map((row) => JSON.parse(row.payloadJson) as Project);
    },
    async listAll() {
      const rows = await db.projects.orderBy('updatedAtMs').reverse().toArray();
      return rows.map((row) => JSON.parse(row.payloadJson) as Project);
    },
    async deleteByChild(childId) {
      const rows = await db.projects.where('childId').equals(childId).toArray();
      await db.projects.where('childId').equals(childId).delete();
      if (rows.length > 0) topics.add('projects');
      return rows.length;
    },
    async clearAll() {
      await db.projects.clear();
      topics.add('projects');
    },
  };

  const portfolio: PortfolioRepository = {
    async getById(portfolioItemId) {
      const row = await db.portfolioItems.get(portfolioItemId);
      return row ? (JSON.parse(row.payloadJson) as PortfolioItem) : null;
    },
    async save(item) {
      await db.portfolioItems.put({
        portfolioItemId: item.portfolioItemId,
        projectId: item.projectId,
        childId: item.childId,
        ownerAppUserId: item.ownerAppUserId,
        createdAtMs: item.createdAt.epochMs,
        payloadJson: JSON.stringify(item),
      });
      topics.add('portfolio');
    },
    async delete(portfolioItemId) {
      await db.portfolioItems.delete(portfolioItemId);
      topics.add('portfolio');
    },
    async listByChild(childId) {
      const rows = await db.portfolioItems
        .where('childId')
        .equals(childId)
        .reverse()
        .sortBy('createdAtMs');
      return rows.map((row) => JSON.parse(row.payloadJson) as PortfolioItem);
    },
    async listByProject(projectId) {
      const rows = await db.portfolioItems
        .where('projectId')
        .equals(projectId)
        .reverse()
        .sortBy('createdAtMs');
      return rows.map((row) => JSON.parse(row.payloadJson) as PortfolioItem);
    },
    async listAll() {
      const rows = await db.portfolioItems.orderBy('createdAtMs').reverse().toArray();
      return rows.map((row) => JSON.parse(row.payloadJson) as PortfolioItem);
    },
    async deleteByChild(childId) {
      const rows = await db.portfolioItems.where('childId').equals(childId).toArray();
      await db.portfolioItems.where('childId').equals(childId).delete();
      if (rows.length > 0) topics.add('portfolio');
      return rows.length;
    },
    async clearAll() {
      await db.portfolioItems.clear();
      topics.add('portfolio');
    },
  };

  const shares: ShareRepository = {
    async getById(shareId) {
      const row = await db.shareSnapshots.get(shareId);
      return row ? (JSON.parse(row.payloadJson) as ShareSnapshot) : null;
    },
    async save(share) {
      await db.shareSnapshots.put({
        shareId: share.shareId,
        sourceProjectId: share.sourceProjectId,
        ownerAppUserId: share.ownerAppUserId,
        revokedAtMs: share.revokedAt?.epochMs ?? null,
        createdAtMs: share.createdAt.epochMs,
        payloadJson: JSON.stringify(share),
      });
      topics.add('shares');
    },
    async listByOwner(ownerAppUserId) {
      const rows = await db.shareSnapshots
        .where('ownerAppUserId')
        .equals(ownerAppUserId)
        .reverse()
        .sortBy('createdAtMs');
      return rows.map((row) => JSON.parse(row.payloadJson) as ShareSnapshot);
    },
    async listBySourceProject(projectId) {
      const rows = await db.shareSnapshots
        .where('sourceProjectId')
        .equals(projectId)
        .reverse()
        .sortBy('createdAtMs');
      return rows.map((row) => JSON.parse(row.payloadJson) as ShareSnapshot);
    },
    async listAll() {
      const rows = await db.shareSnapshots.orderBy('createdAtMs').reverse().toArray();
      return rows.map((row) => JSON.parse(row.payloadJson) as ShareSnapshot);
    },
    async revokeAllForProject(projectId, revokedAtMs) {
      const rows = await this.listBySourceProject(projectId);
      let count = 0;
      for (const share of rows) {
        if (share.revokedAt != null) continue;
        await this.save({ ...share, revokedAt: { epochMs: revokedAtMs } });
        count += 1;
      }
      return count;
    },
    async clearAll() {
      await db.shareSnapshots.clear();
      topics.add('shares');
    },
  };

  const parentSuggestions: ParentSuggestionRepository = {
    async getById(suggestionId) {
      const row = await db.parentSuggestions.get(suggestionId);
      return row ? (JSON.parse(row.payloadJson) as ParentSuggestion) : null;
    },
    async save(suggestion) {
      await db.parentSuggestions.put({
        suggestionId: suggestion.suggestionId,
        childId: suggestion.childId,
        authorAppUserId: suggestion.authorAppUserId,
        status: suggestion.status,
        createdAtMs: suggestion.createdAt.epochMs,
        updatedAtMs: suggestion.updatedAt.epochMs,
        payloadJson: JSON.stringify(suggestion),
      });
      topics.add('parentSuggestions');
    },
    async listByChild(childId) {
      const rows = await db.parentSuggestions
        .where('childId')
        .equals(childId)
        .reverse()
        .sortBy('updatedAtMs');
      return rows.map((row) => JSON.parse(row.payloadJson) as ParentSuggestion);
    },
    async listByAuthor(authorAppUserId) {
      const rows = await db.parentSuggestions
        .where('authorAppUserId')
        .equals(authorAppUserId)
        .reverse()
        .sortBy('updatedAtMs');
      return rows.map((row) => JSON.parse(row.payloadJson) as ParentSuggestion);
    },
    async listAll() {
      const rows = await db.parentSuggestions.orderBy('updatedAtMs').reverse().toArray();
      return rows.map((row) => JSON.parse(row.payloadJson) as ParentSuggestion);
    },
    async deleteByChild(childId) {
      const rows = await db.parentSuggestions.where('childId').equals(childId).toArray();
      await db.parentSuggestions.where('childId').equals(childId).delete();
      if (rows.length > 0) topics.add('parentSuggestions');
      return rows.length;
    },
    async clearAll() {
      await db.parentSuggestions.clear();
      topics.add('parentSuggestions');
    },
  };

  const diary: DiarySnapshotRepository = {
    async capture(input) {
      const profilesList = await profiles.list();
      const careEvents: CareEvent[] = [];
      for (const profile of profilesList) {
        let before = null as TimelineCursor | null;
        for (;;) {
          const page = await care.listPage(profile.childId, 200, before);
          careEvents.push(...page.events);
          if (!page.nextCursor) break;
          before = page.nextCursor;
        }
      }
      return assembleDiaryArchive({
        createdAtMs: input.createdAtMs,
        schemaCompatibility: input.schemaCompatibility || WEB_SCHEMA_VERSION,
        profiles: profilesList,
        careEvents,
        sessions: await sessions.listAll(),
        drafts: await drafts.listAll(),
        revisions: await revisions.listRevisions(),
        receipts: await revisions.listReceipts(),
        deletions: await revisions.listDeletions(),
        meta: await meta.listEntries(),
      });
    },
    async replace(archive) {
      await db.searchDocuments.clear();
      await db.careEvents.clear();
      await db.sessions.clear();
      await db.drafts.clear();
      await db.revisions.clear();
      await db.operationReceipts.clear();
      await db.deletionMarkers.clear();
      await db.photoAttachmentJobs.clear();
      await db.photoAttachments.clear();
      await db.parentSuggestions.clear();
      await db.shareSnapshots.clear();
      await db.portfolioItems.clear();
      await db.projects.clear();
      // Private sync cursor/outbox must not survive a diary replace.
      await db.childPrivateSyncState.clear();
      await db.childProfiles.clear();
      await db.meta.clear();
      for (const profile of archive.profiles) {
        await profiles.save(profile);
      }
      for (const entry of archive.meta) {
        await meta.set(entry.key, entry.value);
      }
      for (const event of archive.careEvents) {
        await care.save(event);
      }
      for (const session of archive.sessions) {
        await sessions.save(session);
      }
      for (const draft of archive.drafts) {
        await drafts.save(draft);
      }
      for (const revision of archive.revisions) {
        await revisions.saveRevision(revision);
      }
      for (const receipt of archive.receipts) {
        await revisions.saveReceipt(receipt);
      }
      for (const deletion of archive.deletions) {
        await revisions.saveDeletion(deletion);
      }
      topics.add('care');
      topics.add('sessions');
      topics.add('drafts');
      topics.add('revisions');
      topics.add('profile');
      topics.add('attachments');
      topics.add('projects');
      topics.add('portfolio');
      topics.add('shares');
      topics.add('parentSuggestions');
    },
  };

  return {
    care,
    sessions,
    drafts,
    revisions,
    profiles,
    meta,
    search,
    attachments,
    projects,
    portfolio,
    shares,
    parentSuggestions,
    diary,
  };
}

async function listWebCarePage(
  db: LumiWebDatabase,
  childId: ChildId,
  limit: number,
  before: TimelineCursor | null,
) {
  const safeLimit = Math.max(0, limit);
  const rows = await db.careEvents.where('childId').equals(childId).toArray();
  const events = rows
    .map((row) =>
      careEventFromRow({
        event_id: row.eventId,
        child_id: row.childId,
        event_type: row.eventType,
        revision_id: row.revisionId,
        sort_at_ms: row.sortAtMs,
        payload_json: row.payloadJson,
      }),
    )
    .filter((event) =>
      isBeforeTimelineCursor(careSortAtMs(event), event.eventId, before),
    )
    .sort(compareCareTimelineDesc)
    .slice(0, safeLimit);
  return {
    events,
    nextCursor: events.length < safeLimit ? null : nextTimelineCursor(events),
  };
}

async function putSearchDocument(db: LumiWebDatabase, event: CareEvent): Promise<void> {
  const doc = searchDocumentFromCareEvent(event);
  await db.searchDocuments.put({
    entityId: doc.entityId,
    childId: doc.childId,
    sortAtMs: doc.sortAtMs,
    docType: doc.docType,
    textNormalized: doc.textNormalized,
  });
}

function webDeletionFromRow(row: {
  deletionId: string;
  entityId: string;
  entityType: string;
  deletedAtMs: number;
  revisionId: string;
  retainUntilMs: number;
  payloadJson?: string | null;
  payloadPurged?: number | null;
}) {
  return deletionFromRow({
    deletion_id: row.deletionId,
    entity_id: row.entityId,
    entity_type: row.entityType,
    deleted_at_ms: row.deletedAtMs,
    revision_id: row.revisionId,
    retain_until_ms: row.retainUntilMs,
    payload_json: row.payloadJson ?? null,
    payload_purged: row.payloadPurged ?? 0,
  });
}

function mapQuotaError(error: unknown): void {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'QuotaExceededError' || /quota/i.test(message)) {
    throw new AppError('STORAGE', 'Browser storage quota was exceeded', {
      details: { reason: 'storage_full' },
      retryable: true,
      cause: error,
    });
  }
}

export async function ensureChildProfileRow(
  db: LumiWebDatabase,
  input: {
    childId: string;
    displayName: string;
    birthDate?: string | null;
    summaryTimeZone: string;
    payloadJson?: string;
  },
): Promise<void> {
  await db.childProfiles.put({
    childId: input.childId,
    displayName: input.displayName,
    birthDate: input.birthDate ?? null,
    summaryTimeZone: input.summaryTimeZone,
    payloadJson: input.payloadJson ?? encodeJson({ childId: input.childId }),
  });
}
