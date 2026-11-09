import type {
  AttachmentImportJob,
  AttachmentRepository,
  PhotoAttachment,
} from '../../domain/attachments';
import { withOfflinePinDefault } from '../../domain/attachments';
import type { EntityId } from '../../domain';
import type { LumiWebDatabase } from '../database/web/lumiWebDatabase';

/** Web metadata repository backed by the private diary IndexedDB. */
export function createDexieAttachmentRepository(db: LumiWebDatabase): AttachmentRepository {
  return {
    async listForEvent(eventId: EntityId) {
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
    },
    async softDelete({ attachmentId, deletedAtMs, retainUntilMs }) {
      const current = await this.getById(attachmentId);
      if (!current) return;
      const next = { ...current, deletedAtMs, retainUntilMs };
      await this.save(next);
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
}
