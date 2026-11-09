import { Platform } from 'react-native';
import { randomBytes } from '@noble/hashes/utils.js';
import type { AttachmentServices } from '../../domain/attachments';
import type { LumiWebDatabase } from '../database/web/lumiWebDatabase';
import { createDexieAttachmentRepository } from './dexieAttachmentRepository';
import { createExpoPhotoPicker } from './expoPhotoPicker';
import { createFileAttachmentRepository } from './fileAttachmentRepository';
import { createFilePrivateAttachmentStore } from './filePrivateAttachmentStore';
import { createMemoryAttachmentRepository } from './memoryAttachmentRepository';
import { createMemoryPrivateAttachmentStore } from './memoryPrivateAttachmentStore';
import { createSyntheticPhotoProcessor } from './syntheticPhotoProcessor';

/**
 * Personal offline photo services. Native keeps sealed JPEG files and metadata
 * under the app documents tree so confirmed photos survive restart without a
 * remote. Web prefers Dexie metadata when a diary handle is provided.
 */
export function createPersonalAttachmentServices(input?: {
  blobKey?: Uint8Array;
  webDb?: LumiWebDatabase;
}): AttachmentServices {
  const key = input?.blobKey ?? randomBytes(32);
  const native = Platform.OS !== 'web';
  const repository = input?.webDb
    ? createDexieAttachmentRepository(input.webDb)
    : native
      ? createFileAttachmentRepository()
      : createMemoryAttachmentRepository();
  return {
    picker: createExpoPhotoPicker(),
    processor: createSyntheticPhotoProcessor(),
    blobs: native
      ? createFilePrivateAttachmentStore({ key })
      : createMemoryPrivateAttachmentStore({ key }),
    repository,
  };
}
