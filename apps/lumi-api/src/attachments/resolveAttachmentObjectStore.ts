import type { ApiConfig } from '../config/env.ts';
import {
  createMemoryAttachmentObjectStore,
  type AttachmentObjectStorePort,
} from './objectStore.ts';
import { createR2AttachmentObjectStore } from './r2AttachmentObjectStore.ts';
import { createS3CompatibleClient } from './s3CompatibleClient.ts';

/**
 * Prefer configured private R2 credentials; otherwise keep the in-memory store
 * so personal CI and local API boots never require a cloud bucket.
 */
export function resolveAttachmentObjectStore(config: ApiConfig): {
  readonly store: AttachmentObjectStorePort;
  readonly provider: 'memory' | 'r2';
} {
  const r2 = config.attachmentObjectStore;
  if (r2?.provider === 'r2' && r2.endpoint && r2.bucket && r2.accessKeyId && r2.secretAccessKey) {
    const client = createS3CompatibleClient({
      config: {
        endpoint: r2.endpoint,
        region: r2.region || 'auto',
        bucket: r2.bucket,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        forcePathStyle: true,
      },
    });
    return {
      store: createR2AttachmentObjectStore({ client }),
      provider: 'r2',
    };
  }
  return { store: createMemoryAttachmentObjectStore(), provider: 'memory' };
}
