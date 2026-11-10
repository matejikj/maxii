import { createHash } from 'node:crypto';
import { createR2AttachmentObjectStore } from './r2AttachmentObjectStore.ts';
import { createS3CompatibleClient } from './s3CompatibleClient.ts';

export type AttachmentS3CompatibleDrillCase = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type AttachmentS3CompatibleDrillResult = {
  readonly ok: boolean;
  readonly endpoint: string;
  readonly bucket: string;
  readonly cases: readonly AttachmentS3CompatibleDrillCase[];
};

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * End-to-end private attachment object store against a real S3-compatible
 * endpoint (local Compose S3Mock or future R2). Default API boots stay on
 * memory — this drill is an explicit gated proof, not a personal-mode
 * dependency.
 */
export async function runAttachmentS3CompatibleDrill(input: {
  readonly endpoint: string;
  readonly region?: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}): Promise<AttachmentS3CompatibleDrillResult> {
  const cases: AttachmentS3CompatibleDrillCase[] = [];
  const client = createS3CompatibleClient({
    config: {
      endpoint: input.endpoint,
      region: input.region ?? 'us-east-1',
      bucket: input.bucket,
      accessKeyId: input.accessKeyId,
      secretAccessKey: input.secretAccessKey,
      forcePathStyle: true,
    },
  });

  const bucketOk = await client.ensureBucket();
  cases.push({
    name: 'ensure_bucket',
    ok: bucketOk,
    detail: bucketOk ? 'bucket ready' : 'create/ensure bucket failed',
  });
  if (!bucketOk) {
    return {
      ok: false,
      endpoint: input.endpoint,
      bucket: input.bucket,
      cases,
    };
  }

  const store = createR2AttachmentObjectStore({ client });
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 7, 34, 2]);
  const digest = sha256Hex(bytes);
  const objectKey = `fam/drill_family/att/drill_att/display/intent_${Date.now()}`;

  const staged = await store.putStaging({
    objectKey,
    familyId: 'drill_family',
    attachmentId: 'drill_att',
    role: 'display',
    bytes,
    expectedSha256: digest,
  });
  cases.push({
    name: 'put_staging',
    ok: staged.ok,
    detail: staged.ok ? 'staging object written' : staged.reason,
  });

  const beforeActivate = await store.readActivated(objectKey);
  cases.push({
    name: 'staging_not_readable',
    ok: beforeActivate == null,
    detail:
      beforeActivate == null
        ? 'staging bytes stay unpublished'
        : 'staging leaked as activated',
  });

  const activated = await store.activate(objectKey);
  cases.push({
    name: 'activate',
    ok: activated,
    detail: activated ? 'copied staging→active' : 'activate failed',
  });

  const read = await store.readActivated(objectKey);
  const readOk =
    read != null && read.sha256 === digest && read.bytes.byteLength === bytes.byteLength;
  cases.push({
    name: 'read_activated',
    ok: readOk,
    detail: readOk ? 'activated digest matches' : 'activated read mismatch',
  });

  const removed = await store.tombstoneByAttachment({
    familyId: 'drill_family',
    attachmentId: 'drill_att',
  });
  const afterTombstone = await store.readActivated(objectKey);
  cases.push({
    name: 'tombstone',
    ok: removed >= 1 && afterTombstone == null,
    detail:
      removed >= 1 && afterTombstone == null
        ? `removed ${removed} object(s)`
        : 'tombstone left readable bytes',
  });

  return {
    ok: cases.every((row) => row.ok),
    endpoint: input.endpoint,
    bucket: input.bucket,
    cases,
  };
}

/** Defaults for the Compose S3Mock profile — never used by personal cold boots. */
export const LOCAL_S3_COMPATIBLE_ATTACHMENT_DRILL_DEFAULTS = {
  endpoint: 'http://127.0.0.1:9090',
  region: 'us-east-1',
  bucket: 'lumi-family-photos',
  accessKeyId: 'test',
  secretAccessKey: 'test',
} as const;
