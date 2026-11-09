export { sealAttachmentBlob, openAttachmentBlob } from './sealedBlobCodec';
export type { SealedAttachmentBlob } from './sealedBlobCodec';
export { createMemoryPrivateAttachmentStore } from './memoryPrivateAttachmentStore';
export { createMemoryAttachmentRepository } from './memoryAttachmentRepository';
export { createSyntheticPhotoProcessor } from './syntheticPhotoProcessor';
export {
  MEDIA_ARCHIVE_FORMAT,
  buildMediaArchiveBundle,
  openMediaArchiveBundle,
  parseMediaArchiveBundle,
  serializeMediaArchiveBundle,
} from './mediaArchive';
export type { MediaArchiveBundle, MediaArchiveManifest } from './mediaArchive';

/** Lazy Expo/RN adapters — keep Node contract tests off the React Native bundle. */
export async function loadExpoPhotoPicker() {
  return import('./expoPhotoPicker');
}
export async function loadFilePrivateAttachmentStore() {
  return import('./filePrivateAttachmentStore');
}
export async function loadPersonalAttachmentServices() {
  return import('./createPersonalAttachmentServices');
}
export async function loadDexieAttachmentRepository() {
  return import('./dexieAttachmentRepository');
}
