import type { ChildId, EntityId } from '../ids';
import type {
  AttachmentHostEventType,
  AttachmentId,
  AttachmentImportJob,
  NormalizedPhotoBytes,
  PhotoAttachment,
  PickedPhotoCandidate,
} from './types';

export type PhotoPickerResult =
  | { status: 'cancelled' }
  | { status: 'picked'; candidates: PickedPhotoCandidate[] }
  | { status: 'unavailable'; message: string };

export type PhotoPicker = {
  /**
   * System library picker only. Must not request microphone or camera for the
   * first local release.
   */
  pickPhotos(input: { remainingSlots: number }): Promise<PhotoPickerResult>;
};

export type PhotoProcessor = {
  /** Decode + re-encode to a stripped JPEG under diary display limits. */
  normalizeDisplay(candidate: PickedPhotoCandidate): Promise<NormalizedPhotoBytes>;
  /** Build a small stripped JPEG thumbnail from already-normalized display bytes. */
  normalizeThumbnail(display: NormalizedPhotoBytes): Promise<NormalizedPhotoBytes>;
};

export type PrivateAttachmentBlobStore = {
  writeDurable(input: { blobKey: string; bytes: Uint8Array; aad: string }): Promise<void>;
  readDurable(input: { blobKey: string; aad: string }): Promise<Uint8Array>;
  deleteDurable(blobKey: string): Promise<void>;
  hasDurable(blobKey: string): Promise<boolean>;
};

export type AttachmentRepository = {
  listForEvent(eventId: EntityId): Promise<PhotoAttachment[]>;
  /** Active (non-deleted) attachments across events — used for space inventory. */
  listAll(): Promise<PhotoAttachment[]>;
  /** Soft-deleted rows still inside or past the undo/trash window. */
  listSoftDeleted(): Promise<PhotoAttachment[]>;
  getById(attachmentId: AttachmentId): Promise<PhotoAttachment | null>;
  save(attachment: PhotoAttachment): Promise<void>;
  softDelete(input: {
    attachmentId: AttachmentId;
    deletedAtMs: number;
    retainUntilMs: number;
  }): Promise<void>;
  saveJob(job: AttachmentImportJob): Promise<void>;
  getJob(jobId: string): Promise<AttachmentImportJob | null>;
  listJobsForEvent(eventId: EntityId): Promise<AttachmentImportJob[]>;
};

export type AttachPhotosInput = {
  childId: ChildId;
  eventId: EntityId;
  hostEventType: AttachmentHostEventType;
  candidates: PickedPhotoCandidate[];
  captions?: Array<string | null>;
  nowMs: number;
  createId: (prefix: string) => string;
};

export type AttachPhotosResult = {
  attached: PhotoAttachment[];
  failed: Array<{ index: number; code: string; message: string }>;
};

/**
 * Optional free-space probe used before photo import. Null means unknown —
 * never invent a successful reservation from a missing probe.
 */
export type DeviceFreeSpaceProbe = {
  probeFreeBytes(): Promise<number | null>;
};

export type AttachmentServices = {
  picker: PhotoPicker;
  processor: PhotoProcessor;
  blobs: PrivateAttachmentBlobStore;
  repository: AttachmentRepository;
  freeSpace?: DeviceFreeSpaceProbe;
};
