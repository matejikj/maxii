import { Platform } from 'react-native';
import { randomBytes } from '@noble/hashes/utils.js';
import type { AttachmentServices } from '../../domain/attachments';
import type { UnitOfWorkFactory } from '../../domain';
import type { LumiWebDatabase } from '../database/web/lumiWebDatabase';
import { createDexieAttachmentRepository } from './dexieAttachmentRepository';
import { createDexiePrivateAttachmentStore } from './dexiePrivateAttachmentStore';
import { createExpoPhotoPicker } from './expoPhotoPicker';
import { createExpoPhotoProcessor } from './expoPhotoProcessor';
import { createFileAttachmentRepository } from './fileAttachmentRepository';
import { createFilePrivateAttachmentStore } from './filePrivateAttachmentStore';
import { createMemoryAttachmentRepository } from './memoryAttachmentRepository';
import { createMemoryPrivateAttachmentStore } from './memoryPrivateAttachmentStore';
import { createSyntheticPhotoProcessor } from './syntheticPhotoProcessor';
import { createUnitOfWorkAttachmentRepository } from './unitOfWorkAttachmentRepository';
import { createDeviceFreeSpaceProbe } from './deviceFreeSpaceProbe';
import { createFixedFreeSpaceProbe } from './fixedFreeSpaceProbe';

/**
 * Personal offline photo services. Native keeps sealed JPEG files under the
 * app documents tree; web keeps sealed blobs in a private IndexedDB that is
 * separate from the public service-worker cache. Metadata prefers the diary
 * UnitOfWork so SQL/Dexie rows share care transactions.
 */
export function createPersonalAttachmentServices(input?: {
  blobKey?: Uint8Array;
  webDb?: LumiWebDatabase;
  unitOfWork?: UnitOfWorkFactory;
  /** Force the synthetic processor (Node contract tests without ImageManipulator). */
  useSyntheticProcessor?: boolean;
}): AttachmentServices {
  const key = input?.blobKey ?? randomBytes(32);
  const native = Platform.OS !== 'web';
  const repository = input?.unitOfWork
    ? createUnitOfWorkAttachmentRepository(input.unitOfWork)
    : input?.webDb
      ? createDexieAttachmentRepository(input.webDb)
      : native
        ? createFileAttachmentRepository()
        : createMemoryAttachmentRepository();

  return {
    picker: createExpoPhotoPicker(),
    processor: input?.useSyntheticProcessor
      ? createSyntheticPhotoProcessor()
      : createExpoPhotoProcessor(),
    blobs: native
      ? createFilePrivateAttachmentStore({ key })
      : Platform.OS === 'web'
        ? createDexiePrivateAttachmentStore({ key })
        : createMemoryPrivateAttachmentStore({ key }),
    repository,
    freeSpace: createDeviceFreeSpaceProbe(),
  };
}

/** In-memory sealed store + synthetic codec for Node contract tests. */
export function createTestAttachmentServices(input?: {
  blobKey?: Uint8Array;
  freeBytes?: number | null;
}): AttachmentServices {
  const key = input?.blobKey ?? randomBytes(32);
  return {
    picker: {
      async pickPhotos() {
        return { status: 'cancelled' };
      },
    },
    processor: createSyntheticPhotoProcessor(),
    blobs: createMemoryPrivateAttachmentStore({ key }),
    repository: createMemoryAttachmentRepository(),
    freeSpace: createFixedFreeSpaceProbe(input?.freeBytes ?? null),
  };
}
