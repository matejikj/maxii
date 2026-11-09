import type { AttachmentRepository } from '../../domain/attachments';
import type { UnitOfWorkFactory } from '../../domain';

/**
 * Binds attachment metadata writes to the personal UnitOfWork so native SQL /
 * web Dexie rows share the same transactional boundary as care events.
 */
export function createUnitOfWorkAttachmentRepository(
  unitOfWork: UnitOfWorkFactory,
): AttachmentRepository {
  return {
    listForEvent(eventId) {
      return unitOfWork.run((uow) => uow.attachments.listForEvent(eventId));
    },
    getById(attachmentId) {
      return unitOfWork.run((uow) => uow.attachments.getById(attachmentId));
    },
    save(attachment) {
      return unitOfWork.run((uow) => uow.attachments.save(attachment));
    },
    softDelete(input) {
      return unitOfWork.run((uow) => uow.attachments.softDelete(input));
    },
    saveJob(job) {
      return unitOfWork.run((uow) => uow.attachments.saveJob(job));
    },
    getJob(jobId) {
      return unitOfWork.run((uow) => uow.attachments.getJob(jobId));
    },
    listJobsForEvent(eventId) {
      return unitOfWork.run((uow) => uow.attachments.listJobsForEvent(eventId));
    },
  };
}
