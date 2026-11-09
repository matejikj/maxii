export { ATTACHMENT_LIMITS, ATTACHMENT_SUPPORTED_INPUT_MIME } from './limits';
export type { AttachmentSupportedInputMime } from './limits';
export type {
  AttachmentHostEventType,
  AttachmentId,
  AttachmentImportJob,
  AttachmentImportState,
  AttachmentJobId,
  LocalAvailability,
  LocalPhotoAvailabilityLabel,
  NormalizedPhotoBytes,
  PhotoAttachment,
  PhotoRendition,
  PickedPhotoCandidate,
  RenditionId,
  RenditionRole,
} from './types';
export {
  asAttachmentId,
  asAttachmentJobId,
  asRenditionId,
} from './types';
export {
  assertRemainingPhotoSlots,
  evaluatePhotoInput,
  localAvailabilityLabel,
  sanitizePhotoCaption,
} from './validatePhotoInput';
export {
  buildNormalizeAttempts,
  buildThumbnailAttempts,
  scaledSize,
} from './normalizePlan';
export type { NormalizeAttempt } from './normalizePlan';
export {
  buildMinimalJpeg,
  jpegContainsAsciiCanary,
  stripJpegMetadata,
} from './stripJpegMetadata';
export type {
  AttachmentRepository,
  AttachmentServices,
  AttachPhotosInput,
  AttachPhotosResult,
  PhotoPicker,
  PhotoPickerResult,
  PhotoProcessor,
  PrivateAttachmentBlobStore,
} from './ports';
export {
  detectFamilyPhotoCountConflict,
  presentFamilyPhotoTransferLabel,
} from './familyTransfer';
export type {
  FamilyPhotoConflictKind,
  FamilyPhotoTransferLabel,
} from './familyTransfer';
export {
  classifyPhotoExportCompleteness,
  decideSoleOwnCopyRelease,
  planRecoverableCacheEviction,
} from './attachmentCachePolicy';
export type {
  CacheEvictionPlan,
  LocalPhotoCopyKind,
  LocalPhotoCopyRecord,
  PhotoExportCompleteness,
  SoleOwnReleaseDecision,
} from './attachmentCachePolicy';
export {
  ATTACHMENT_TRASH_RETENTION_MS,
  attachmentTrashRetainUntilMs,
  filterRestoredAttachmentsAgainstErasure,
  planAttachmentPayloadPurge,
} from './attachmentErasurePolicy';
export type {
  AttachmentPurgeCandidate,
  AttachmentPurgeDecision,
  AttachmentRestoreFilterResult,
} from './attachmentErasurePolicy';
