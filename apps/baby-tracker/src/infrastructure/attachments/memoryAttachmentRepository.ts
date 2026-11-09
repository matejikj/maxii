import type {
  AttachmentImportJob,
  AttachmentRepository,
  PhotoAttachment,
} from '../../domain/attachments';
import type { EntityId } from '../../domain';

/** Test double repository. Soft-deleted rows stay queryable until purge. */
export function createMemoryAttachmentRepository(): AttachmentRepository {
  const attachments = new Map<string, PhotoAttachment>();
  const jobs = new Map<string, AttachmentImportJob>();

  return {
    async listForEvent(eventId: EntityId) {
      return [...attachments.values()]
        .filter((row) => row.eventId === eventId && row.deletedAtMs == null)
        .sort((a, b) => a.orderIndex - b.orderIndex);
    },
    async getById(attachmentId) {
      return attachments.get(attachmentId) ?? null;
    },
    async save(attachment) {
      attachments.set(attachment.attachmentId, structuredClone(attachment));
    },
    async softDelete({ attachmentId, deletedAtMs, retainUntilMs }) {
      const current = attachments.get(attachmentId);
      if (!current) return;
      attachments.set(attachmentId, {
        ...current,
        deletedAtMs,
        retainUntilMs,
      });
    },
    async saveJob(job) {
      jobs.set(job.jobId, structuredClone(job));
    },
    async getJob(jobId) {
      return jobs.get(jobId) ?? null;
    },
    async listJobsForEvent(eventId) {
      return [...jobs.values()].filter((job) => job.eventId === eventId);
    },
  };
}
