import type {
  AttachmentImportJob,
  AttachmentRepository,
  PhotoAttachment,
} from '../../domain/attachments';
import { withOfflinePinDefault } from '../../domain/attachments';
import type { EntityId } from '../../domain';

type Snapshot = {
  attachments: PhotoAttachment[];
  jobs: AttachmentImportJob[];
};

const FILE_NAME = 'photo-attachments-meta.v1.json';

/**
 * Durable attachment metadata beside sealed blobs. Survives process death on
 * native without waiting for a full UnitOfWork SQL adapter wiring.
 */
export function createFileAttachmentRepository(): AttachmentRepository {
  async function load(): Promise<Snapshot> {
    const FileSystem = await import('expo-file-system/legacy');
    const root = FileSystem.documentDirectory;
    if (!root) return { attachments: [], jobs: [] };
    const path = `${root}lumi-private-attachments/${FILE_NAME}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || info.isDirectory) return { attachments: [], jobs: [] };
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as Snapshot;
    return {
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.map((row) => withOfflinePinDefault(row))
        : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  }

  async function saveSnapshot(snapshot: Snapshot): Promise<void> {
    const FileSystem = await import('expo-file-system/legacy');
    const root = FileSystem.documentDirectory;
    if (!root) throw new Error('documentDirectory unavailable for attachment metadata');
    const dir = `${root}lumi-private-attachments/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    await FileSystem.writeAsStringAsync(`${dir}${FILE_NAME}`, `${JSON.stringify(snapshot)}\n`);
  }

  return {
    async listForEvent(eventId: EntityId) {
      const snapshot = await load();
      return snapshot.attachments
        .filter((row) => row.eventId === eventId && row.deletedAtMs == null)
        .sort((a, b) => a.orderIndex - b.orderIndex);
    },
    async listAll() {
      const snapshot = await load();
      return snapshot.attachments
        .filter((row) => row.deletedAtMs == null)
        .sort((a, b) => a.createdAtMs - b.createdAtMs || a.orderIndex - b.orderIndex);
    },
    async getById(attachmentId) {
      const snapshot = await load();
      return snapshot.attachments.find((row) => row.attachmentId === attachmentId) ?? null;
    },
    async save(attachment) {
      const snapshot = await load();
      const next = snapshot.attachments.filter((row) => row.attachmentId !== attachment.attachmentId);
      next.push(attachment);
      await saveSnapshot({ ...snapshot, attachments: next });
    },
    async softDelete({ attachmentId, deletedAtMs, retainUntilMs }) {
      const current = await this.getById(attachmentId);
      if (!current) return;
      await this.save({ ...current, deletedAtMs, retainUntilMs });
    },
    async saveJob(job) {
      const snapshot = await load();
      const next = snapshot.jobs.filter((row) => row.jobId !== job.jobId);
      next.push(job);
      await saveSnapshot({ ...snapshot, jobs: next });
    },
    async getJob(jobId) {
      const snapshot = await load();
      return snapshot.jobs.find((row) => row.jobId === jobId) ?? null;
    },
    async listJobsForEvent(eventId) {
      const snapshot = await load();
      return snapshot.jobs.filter((job) => job.eventId === eventId);
    },
  };
}
