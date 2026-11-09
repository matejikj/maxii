import type {
  ActiveSession,
  AppMetaRepository,
  CareEvent,
  CareRepository,
  ChildId,
  ChildProfile,
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
  DeletionMarker,
} from '../../../domain';
import type {
  AttachmentImportJob,
  AttachmentRepository,
  PhotoAttachment,
} from '../../../domain/attachments';
import { AppError } from '../../../domain/errors';
import { SCHEMA_VERSION_5 } from './schema/v5';
import { assembleDiaryArchive } from '../diarySnapshotShared';
import { nextTimelineCursor, searchDocumentFromCareEvent } from '../../../domain/projections/historyQuery';
import type { ChangeTopic } from './changeFeed';
import type { PrivateDatabase } from './privateDatabase';
import type { SqlConnection } from './sqlConnection';
import {
  careEventFromRow,
  careEventToRow,
  deletionFromRow,
  deletionToRow,
  draftFromRow,
  draftToRow,
  profileFromRow,
  profileToRow,
  receiptFromRow,
  receiptToRow,
  revisionFromRow,
  revisionToRow,
  sessionFromRow,
  sessionToRow,
  type CareEventRow,
} from './serialization';

export function createNativeUnitOfWorkFactory(
  database: PrivateDatabase,
  options: { faults?: FaultInjection; nowMs?: () => number } = {},
): UnitOfWorkFactory {
  return {
    async run<T>(work: (uow: UnitOfWork) => Promise<T>): Promise<T> {
      return database.writeQueue.run(async () => {
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

        const topics = new Set<ChangeTopic>();
        let result: T | undefined;
        // Use BEGIN/COMMIT on the already-keyed connection. expo-sqlite's
        // withExclusiveTransactionAsync can lose the SQLCipher key on Android
        // and fail with "file is not a database".
        const conn = database.connection;
        await conn.execAsync('BEGIN IMMEDIATE');
        try {
          const uow = createRepositories(conn, topics);
          result = await work(uow);
          if (options.faults?.shouldFail('storage_commit')) {
            throw new AppError('STORAGE', 'Injected commit failure', {
              details: { reason: 'storage_commit' },
              retryable: true,
            });
          }
          if (topics.size > 0) {
            const publishedAtMs = options.nowMs?.() ?? Date.now();
            await conn.runAsync(
              `INSERT INTO change_notifications (published_at_ms, topics_json) VALUES (?, ?)`,
              publishedAtMs,
              JSON.stringify([...topics]),
            );
          }
          await conn.execAsync('COMMIT');
        } catch (error) {
          await conn.execAsync('ROLLBACK').catch(() => undefined);
          throw error;
        }

        if (topics.size > 0) {
          await database.changeFeed.publish([...topics], options.nowMs?.() ?? Date.now());
        }
        return result as T;
      });
    },
  };
}

function createRepositories(txn: SqlConnection, topics: Set<ChangeTopic>): UnitOfWork {
  const care: CareRepository = {
    async getById(eventId) {
      const row = await txn.getFirstAsync<CareEventRow>(
        'SELECT event_id, child_id, event_type, revision_id, sort_at_ms, payload_json FROM care_events WHERE event_id = ?',
        eventId,
      );
      return row ? careEventFromRow(row) : null;
    },
    async save(event: CareEvent) {
      const row = careEventToRow(event);
      await txn.runAsync('DELETE FROM care_events WHERE event_id = ?', row.event_id);
      await txn.runAsync(
        `INSERT INTO care_events (event_id, child_id, event_type, revision_id, sort_at_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?)`,
        row.event_id,
        row.child_id,
        row.event_type,
        row.revision_id,
        row.sort_at_ms,
        row.payload_json,
      );
      await upsertSearchDocument(txn, event);
      topics.add('care');
    },
    async delete(eventId: EntityId) {
      await txn.runAsync('DELETE FROM care_events WHERE event_id = ?', eventId);
      await txn.runAsync('DELETE FROM search_documents WHERE entity_id = ?', eventId);
      topics.add('care');
    },
    async listRecent(childId: ChildId, limit: number) {
      const page = await listCarePage(txn, childId, limit, null);
      return page.events;
    },
    async listInSortRange(childId: ChildId, fromSortAtMsInclusive: number, toSortAtMsExclusive: number) {
      const rows = await txn.getAllAsync<CareEventRow>(
        `SELECT event_id, child_id, event_type, revision_id, sort_at_ms, payload_json
         FROM care_events
         WHERE child_id = ? AND sort_at_ms >= ? AND sort_at_ms < ?
         ORDER BY sort_at_ms DESC, event_id DESC`,
        childId,
        fromSortAtMsInclusive,
        toSortAtMsExclusive,
      );
      return rows.map(careEventFromRow);
    },
    async listPage(childId: ChildId, limit: number, before: TimelineCursor | null) {
      return listCarePage(txn, childId, limit, before);
    },
  };
  const sessions: SessionRepository = {
    async getActive(childId: ChildId, kind: SessionKind) {
      const row = await txn.getFirstAsync<{ payload_json: string }>(
        `SELECT payload_json FROM sessions WHERE child_id = ? AND kind = ? AND status IN ('running', 'paused')`,
        childId,
        kind,
      );
      return row ? (sessionFromRow(row) as ActiveSession) : null;
    },
    async save(session: SessionRecord) {
      const row = sessionToRow(session);
      await txn.runAsync('DELETE FROM sessions WHERE session_id = ?', row.session_id);
      await txn.runAsync(
        `INSERT INTO sessions (session_id, child_id, kind, status, payload_json) VALUES (?, ?, ?, ?, ?)`,
        row.session_id,
        row.child_id,
        row.kind,
        row.status,
        row.payload_json,
      );
      topics.add('sessions');
    },
    async listAll() {
      const rows = await txn.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM sessions');
      return rows.map((row) => sessionFromRow(row) as SessionRecord);
    },
  };

  const drafts: DraftRepository = {
    async getById(draftId: EntityId) {
      const row = await txn.getFirstAsync<{ payload_json: string }>(
        'SELECT payload_json FROM drafts WHERE draft_id = ?',
        draftId,
      );
      return row ? draftFromRow(row) : null;
    },
    async save(draft: Draft) {
      const row = draftToRow(draft);
      await txn.runAsync('DELETE FROM drafts WHERE draft_id = ?', row.draft_id);
      await txn.runAsync(
        `INSERT INTO drafts (draft_id, child_id, form_type, original_event_time_ms, updated_at_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?)`,
        row.draft_id,
        row.child_id,
        row.form_type,
        row.original_event_time_ms,
        row.updated_at_ms,
        row.payload_json,
      );
      topics.add('drafts');
    },
    async delete(draftId: EntityId) {
      await txn.runAsync('DELETE FROM drafts WHERE draft_id = ?', draftId);
      topics.add('drafts');
    },
    async listByChild(childId: ChildId) {
      const rows = await txn.getAllAsync<{ payload_json: string }>(
        `SELECT payload_json FROM drafts WHERE child_id = ? ORDER BY updated_at_ms DESC, draft_id DESC`,
        childId,
      );
      return rows.map(draftFromRow);
    },
    async listAll() {
      const rows = await txn.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM drafts');
      return rows.map(draftFromRow);
    },
  };

  const search: SearchIndexRepository = {
    async upsertFromCare(event: CareEvent) {
      await upsertSearchDocument(txn, event);
    },
    async remove(entityId: EntityId) {
      await txn.runAsync('DELETE FROM search_documents WHERE entity_id = ?', entityId);
    },
    async rebuildForChild(childId: ChildId) {
      await txn.runAsync('DELETE FROM search_documents WHERE child_id = ?', childId);
      const rows = await txn.getAllAsync<CareEventRow>(
        `SELECT event_id, child_id, event_type, revision_id, sort_at_ms, payload_json
         FROM care_events WHERE child_id = ?`,
        childId,
      );
      for (const row of rows) {
        await upsertSearchDocument(txn, careEventFromRow(row));
      }
      return rows.length;
    },
    async search(childId: ChildId, normalizedQuery: string, limit: number, before: TimelineCursor | null) {
      if (!normalizedQuery) {
        return listCarePage(txn, childId, limit, before);
      }
      const like = `%${escapeLike(normalizedQuery)}%`;
      const rows =
        before == null
          ? await txn.getAllAsync<CareEventRow>(
              `SELECT c.event_id, c.child_id, c.event_type, c.revision_id, c.sort_at_ms, c.payload_json
               FROM care_events c
               INNER JOIN search_documents s ON s.entity_id = c.event_id
               WHERE s.child_id = ? AND s.text_normalized LIKE ? ESCAPE '\\'
               ORDER BY c.sort_at_ms DESC, c.event_id DESC
               LIMIT ?`,
              childId,
              like,
              limit,
            )
          : await txn.getAllAsync<CareEventRow>(
              `SELECT c.event_id, c.child_id, c.event_type, c.revision_id, c.sort_at_ms, c.payload_json
               FROM care_events c
               INNER JOIN search_documents s ON s.entity_id = c.event_id
               WHERE s.child_id = ?
                 AND s.text_normalized LIKE ? ESCAPE '\\'
                 AND (
                   c.sort_at_ms < ?
                   OR (c.sort_at_ms = ? AND c.event_id < ?)
                 )
               ORDER BY c.sort_at_ms DESC, c.event_id DESC
               LIMIT ?`,
              childId,
              like,
              before.sortAtMs,
              before.sortAtMs,
              before.eventId,
              limit,
            );
      const events = rows.map(careEventFromRow);
      return {
        events,
        nextCursor: events.length < limit ? null : nextTimelineCursor(events),
      };
    },
  };

  const revisions: RevisionRepository = {
    async saveRevision(revision: Revision) {
      const row = revisionToRow(revision);
      await txn.runAsync('DELETE FROM revisions WHERE revision_id = ?', row.revision_id);
      await txn.runAsync(
        `INSERT INTO revisions (
          revision_id, entity_id, operation_id, parent_revision_ids_json, command_type,
          created_at_ms, device_id, actor_id, state_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.revision_id,
        row.entity_id,
        row.operation_id,
        row.parent_revision_ids_json,
        row.command_type,
        row.created_at_ms,
        row.device_id,
        row.actor_id,
        row.state_json,
      );
      topics.add('revisions');
    },
    async findRevision(revisionId: RevisionId) {
      const row = await txn.getFirstAsync<{
        revision_id: string;
        entity_id: string;
        operation_id: string;
        parent_revision_ids_json: string;
        command_type: string;
        created_at_ms: number;
        device_id: string | null;
        actor_id: string | null;
        state_json: string;
      }>('SELECT * FROM revisions WHERE revision_id = ?', revisionId);
      return row ? revisionFromRow(row) : null;
    },
    async saveReceipt(receipt: OperationReceipt) {
      const row = receiptToRow(receipt);
      await txn.runAsync(
        `INSERT INTO operation_receipts (
          operation_id, command_type, intent_captured_at_ms, completed_at_ms,
          entity_ids_json, revision_ids_json, result_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row.operation_id,
        row.command_type,
        row.intent_captured_at_ms,
        row.completed_at_ms,
        row.entity_ids_json,
        row.revision_ids_json,
        row.result_code,
      );
      topics.add('revisions');
    },
    async findReceipt(operationId: OperationId) {
      const row = await txn.getFirstAsync<{
        operation_id: string;
        command_type: string;
        intent_captured_at_ms: number;
        completed_at_ms: number;
        entity_ids_json: string;
        revision_ids_json: string;
        result_code: 'savedLocally';
      }>('SELECT * FROM operation_receipts WHERE operation_id = ?', operationId);
      return row ? receiptFromRow(row) : null;
    },
    async saveDeletion(marker: DeletionMarker) {
      const row = deletionToRow(marker);
      await txn.runAsync('DELETE FROM deletion_markers WHERE deletion_id = ?', row.deletion_id);
      await txn.runAsync(
        `INSERT INTO deletion_markers (
          deletion_id, entity_id, entity_type, deleted_at_ms, revision_id, retain_until_ms,
          payload_json, payload_purged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row.deletion_id,
        row.entity_id,
        row.entity_type,
        row.deleted_at_ms,
        row.revision_id,
        row.retain_until_ms,
        row.payload_json,
        row.payload_purged,
      );
      topics.add('revisions');
    },
    async findDeletion(deletionId: EntityId) {
      const row = await txn.getFirstAsync<{
        deletion_id: string;
        entity_id: string;
        entity_type: string;
        deleted_at_ms: number;
        revision_id: string;
        retain_until_ms: number;
        payload_json: string | null;
        payload_purged: number | null;
      }>('SELECT * FROM deletion_markers WHERE deletion_id = ?', deletionId);
      return row ? deletionFromRow(row) : null;
    },
    async findDeletionByEntityId(entityId: EntityId) {
      const row = await txn.getFirstAsync<{
        deletion_id: string;
        entity_id: string;
        entity_type: string;
        deleted_at_ms: number;
        revision_id: string;
        retain_until_ms: number;
        payload_json: string | null;
        payload_purged: number | null;
      }>('SELECT * FROM deletion_markers WHERE entity_id = ?', entityId);
      return row ? deletionFromRow(row) : null;
    },
    async listDeletions() {
      const rows = await txn.getAllAsync<{
        deletion_id: string;
        entity_id: string;
        entity_type: string;
        deleted_at_ms: number;
        revision_id: string;
        retain_until_ms: number;
        payload_json: string | null;
        payload_purged: number | null;
      }>('SELECT * FROM deletion_markers');
      return rows.map(deletionFromRow);
    },
    async removeDeletion(deletionId: EntityId) {
      await txn.runAsync('DELETE FROM deletion_markers WHERE deletion_id = ?', deletionId);
      topics.add('revisions');
    },
    async listRevisions() {
      const rows = await txn.getAllAsync<{
        revision_id: string;
        entity_id: string;
        operation_id: string;
        parent_revision_ids_json: string;
        command_type: string;
        created_at_ms: number;
        device_id: string | null;
        actor_id: string | null;
        state_json: string;
      }>('SELECT * FROM revisions');
      return rows.map(revisionFromRow);
    },
    async listReceipts() {
      const rows = await txn.getAllAsync<{
        operation_id: string;
        command_type: string;
        intent_captured_at_ms: number;
        completed_at_ms: number;
        entity_ids_json: string;
        revision_ids_json: string;
        result_code: 'savedLocally';
      }>('SELECT * FROM operation_receipts');
      return rows.map(receiptFromRow);
    },
  };

  const profiles: ProfileRepository = {
    async get(childId: ChildId) {
      const row = await txn.getFirstAsync<{ payload_json: string }>(
        'SELECT payload_json FROM child_profiles WHERE child_id = ?',
        childId,
      );
      return row ? profileFromRow(row) : null;
    },
    async list() {
      const rows = await txn.getAllAsync<{ payload_json: string }>(
        'SELECT payload_json FROM child_profiles',
      );
      return rows.map(profileFromRow);
    },
    async save(profile: ChildProfile) {
      const row = profileToRow(profile);
      await txn.runAsync('DELETE FROM child_profiles WHERE child_id = ?', row.child_id);
      await txn.runAsync(
        `INSERT INTO child_profiles (child_id, display_name, birth_date, summary_time_zone, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
        row.child_id,
        row.display_name,
        row.birth_date,
        row.summary_time_zone,
        row.payload_json,
      );
      topics.add('profile');
    },
  };

  const meta: AppMetaRepository = {
    async get(key: string) {
      const row = await txn.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        key,
      );
      return row?.value ?? null;
    },
    async set(key: string, value: string) {
      await txn.runAsync('DELETE FROM app_meta WHERE key = ?', key);
      await txn.runAsync('INSERT INTO app_meta (key, value) VALUES (?, ?)', key, value);
    },
    async listEntries() {
      const rows = await txn.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM app_meta',
      );
      return rows;
    },
  };

  const attachments: AttachmentRepository = {
    async listForEvent(eventId) {
      const rows = await txn.getAllAsync<{ payload_json: string; deleted_at_ms: number | null }>(
        `SELECT payload_json, deleted_at_ms FROM photo_attachments
         WHERE event_id = ?
         ORDER BY order_index ASC, attachment_id ASC`,
        eventId,
      );
      return rows
        .filter((row) => row.deleted_at_ms == null)
        .map((row) => JSON.parse(row.payload_json) as PhotoAttachment);
    },
    async getById(attachmentId) {
      const row = await txn.getFirstAsync<{ payload_json: string }>(
        `SELECT payload_json FROM photo_attachments WHERE attachment_id = ?`,
        attachmentId,
      );
      return row ? (JSON.parse(row.payload_json) as PhotoAttachment) : null;
    },
    async save(attachment) {
      await txn.runAsync('DELETE FROM photo_attachments WHERE attachment_id = ?', attachment.attachmentId);
      // Single-line INSERT keeps the memory SQLCipher test double's parser happy.
      await txn.runAsync(
        `INSERT INTO photo_attachments (attachment_id, child_id, event_id, host_event_type, order_index, caption, recorded_by, created_at_ms, deleted_at_ms, retain_until_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        attachment.attachmentId,
        attachment.childId,
        attachment.eventId,
        attachment.hostEventType,
        attachment.orderIndex,
        attachment.caption,
        attachment.recordedBy,
        attachment.createdAtMs,
        attachment.deletedAtMs,
        attachment.retainUntilMs,
        JSON.stringify(attachment),
      );
      topics.add('attachments');
    },
    async softDelete({ attachmentId, deletedAtMs, retainUntilMs }) {
      const current = await this.getById(attachmentId);
      if (!current) return;
      await this.save({ ...current, deletedAtMs, retainUntilMs });
    },
    async saveJob(job) {
      await txn.runAsync('DELETE FROM photo_attachment_jobs WHERE job_id = ?', job.jobId);
      await txn.runAsync(
        `INSERT INTO photo_attachment_jobs (job_id, attachment_id, child_id, event_id, state, error_code, source_mime, created_at_ms, updated_at_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        job.jobId,
        job.attachmentId,
        job.childId,
        job.eventId,
        job.state,
        job.errorCode,
        job.sourceMime,
        job.createdAtMs,
        job.updatedAtMs,
        JSON.stringify(job),
      );
      topics.add('attachments');
    },
    async getJob(jobId) {
      const row = await txn.getFirstAsync<{ payload_json: string }>(
        `SELECT payload_json FROM photo_attachment_jobs WHERE job_id = ?`,
        jobId,
      );
      return row ? (JSON.parse(row.payload_json) as AttachmentImportJob) : null;
    },
    async listJobsForEvent(eventId) {
      const rows = await txn.getAllAsync<{ payload_json: string }>(
        `SELECT payload_json FROM photo_attachment_jobs WHERE event_id = ?`,
        eventId,
      );
      return rows.map((row) => JSON.parse(row.payload_json) as AttachmentImportJob);
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
        schemaCompatibility: input.schemaCompatibility || SCHEMA_VERSION_5,
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
      await txn.runAsync('DELETE FROM search_documents');
      await txn.runAsync('DELETE FROM care_events');
      await txn.runAsync('DELETE FROM sessions');
      await txn.runAsync('DELETE FROM drafts');
      await txn.runAsync('DELETE FROM revisions');
      await txn.runAsync('DELETE FROM operation_receipts');
      await txn.runAsync('DELETE FROM deletion_markers');
      await txn.runAsync('DELETE FROM photo_attachment_jobs');
      await txn.runAsync('DELETE FROM photo_attachments');
      await txn.runAsync('DELETE FROM child_profiles');
      await txn.runAsync('DELETE FROM app_meta');
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
    },
  };

  return { care, sessions, drafts, revisions, profiles, meta, search, attachments, diary };
}

async function listCarePage(
  txn: SqlConnection,
  childId: ChildId,
  limit: number,
  before: TimelineCursor | null,
) {
  const safeLimit = Math.max(0, limit);
  const rows =
    before == null
      ? await txn.getAllAsync<CareEventRow>(
          `SELECT event_id, child_id, event_type, revision_id, sort_at_ms, payload_json
           FROM care_events
           WHERE child_id = ?
           ORDER BY sort_at_ms DESC, event_id DESC
           LIMIT ?`,
          childId,
          safeLimit,
        )
      : await txn.getAllAsync<CareEventRow>(
          `SELECT event_id, child_id, event_type, revision_id, sort_at_ms, payload_json
           FROM care_events
           WHERE child_id = ?
             AND (
               sort_at_ms < ?
               OR (sort_at_ms = ? AND event_id < ?)
             )
           ORDER BY sort_at_ms DESC, event_id DESC
           LIMIT ?`,
          childId,
          before.sortAtMs,
          before.sortAtMs,
          before.eventId,
          safeLimit,
        );
  const events = rows.map(careEventFromRow);
  return {
    events,
    nextCursor: events.length < safeLimit ? null : nextTimelineCursor(events),
  };
}

async function upsertSearchDocument(txn: SqlConnection, event: CareEvent): Promise<void> {
  const doc = searchDocumentFromCareEvent(event);
  await txn.runAsync('DELETE FROM search_documents WHERE entity_id = ?', doc.entityId);
  await txn.runAsync(
    `INSERT INTO search_documents (entity_id, child_id, sort_at_ms, doc_type, text_normalized)
     VALUES (?, ?, ?, ?, ?)`,
    doc.entityId,
    doc.childId,
    doc.sortAtMs,
    doc.docType,
    doc.textNormalized,
  );
}

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
