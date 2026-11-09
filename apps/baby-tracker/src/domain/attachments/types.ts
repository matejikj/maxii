import type { ActorId, ChildId, EntityId } from '../ids';
import type { AttachmentSupportedInputMime } from './limits';

export type AttachmentId = string & { readonly __brand: 'AttachmentId' };
export type RenditionId = string & { readonly __brand: 'RenditionId' };
export type AttachmentJobId = string & { readonly __brand: 'AttachmentJobId' };

export function asAttachmentId(value: string): AttachmentId {
  return value as AttachmentId;
}
export function asRenditionId(value: string): RenditionId {
  return value as RenditionId;
}
export function asAttachmentJobId(value: string): AttachmentJobId {
  return value as AttachmentJobId;
}

/** Events that may host optional photos in the first local release. */
export type AttachmentHostEventType = 'note' | 'milestone' | 'experience';

export type RenditionRole = 'display' | 'thumbnail';

/**
 * Local readiness of one immutable rendition. Own/pending copies are never LRU
 * candidates; cache copies may be rebuilt from remote later (family stage).
 */
export type LocalAvailability = 'durable' | 'cache' | 'pending' | 'missing';

export type AttachmentImportState =
  | 'selected'
  | 'normalizing'
  | 'writing'
  | 'linked'
  | 'failed'
  | 'cancelled';

export type PhotoRendition = {
  renditionId: RenditionId;
  attachmentId: AttachmentId;
  role: RenditionRole;
  mime: 'image/jpeg';
  width: number;
  height: number;
  byteLength: number;
  sha256: string;
  normalizationVersion: string;
  blobKey: string;
  availability: LocalAvailability;
};

export type PhotoAttachment = {
  attachmentId: AttachmentId;
  childId: ChildId;
  eventId: EntityId;
  hostEventType: AttachmentHostEventType;
  orderIndex: number;
  caption: string | null;
  recordedBy: ActorId | null;
  createdAtMs: number;
  deletedAtMs: number | null;
  retainUntilMs: number | null;
  /**
   * Explicit "keep offline" pin. The toggle alone is not readiness — durable
   * display bytes must exist before parents see offline confirmation.
   */
  offlinePinned: boolean;
  renditions: PhotoRendition[];
};

export type PickedPhotoCandidate = {
  /** Opaque picker URI — must not be stored after durable confirmation. */
  sourceUri: string;
  mime: string;
  byteLength: number;
  width: number | null;
  height: number | null;
  fileName: string | null;
};

export type NormalizedPhotoBytes = {
  mime: 'image/jpeg';
  bytes: Uint8Array;
  width: number;
  height: number;
  sha256: string;
};

export type AttachmentImportJob = {
  jobId: AttachmentJobId;
  attachmentId: AttachmentId;
  childId: ChildId;
  eventId: EntityId | null;
  state: AttachmentImportState;
  errorCode: string | null;
  sourceMime: AttachmentSupportedInputMime | string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type LocalPhotoAvailabilityLabel =
  | 'preparing'
  | 'local'
  | 'missing'
  | 'failed';
