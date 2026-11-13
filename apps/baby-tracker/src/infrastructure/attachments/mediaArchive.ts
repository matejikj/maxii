import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';
import {
  classifyPhotoExportCompleteness,
  type PhotoAttachment,
  type PhotoExportCompleteness,
} from '../../domain/attachments';
import {
  openPortableBackup,
  parsePortableBackup,
  sealPortableBackup,
  serializePortableBackup,
  type Argon2idParams,
  type PortableBackupEnvelope,
} from '../crypto/portableBackup';

/**
 * Companion media archive for diary photos. Each rendition stays a separately
 * sealed envelope so payloads are never stuffed into one giant JSON AEAD blob.
 * Full libsodium secretstream remains a future binding once proven in-runtime.
 */
export const MEDIA_ARCHIVE_FORMAT = 'lumi.portable-media.v1' as const;

const mediaManifestSchema = z.object({
  format: z.literal(MEDIA_ARCHIVE_FORMAT),
  createdAtMs: z.number().int().nonnegative(),
  // Legacy archives without the field stay incomplete — never upgrade the claim.
  completeness: z
    .enum(['full_photo_backup', 'incomplete_photo_export'])
    .default('incomplete_photo_export'),
  attachments: z.array(
    z.object({
      attachmentId: z.string().min(1),
      childId: z.string().min(1),
      eventId: z.string().min(1),
      hostEventType: z.enum(['note', 'milestone', 'experience']),
      orderIndex: z.number().int().nonnegative(),
      caption: z.string().nullable(),
      createdAtMs: z.number().int().nonnegative(),
      renditions: z.array(
        z.object({
          renditionId: z.string().min(1),
          role: z.enum(['display', 'thumbnail']),
          mime: z.literal('image/jpeg'),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          byteLength: z.number().int().positive(),
          sha256: z.string().regex(/^[0-9a-f]{64}$/i),
          normalizationVersion: z.string().min(1),
          blobPath: z.string().min(1),
        }),
      ),
    }),
  ),
});

export type MediaArchiveManifest = z.infer<typeof mediaManifestSchema>;

export type MediaArchiveBundle = {
  manifestEnvelope: PortableBackupEnvelope;
  blobs: Record<string, PortableBackupEnvelope>;
  completeness: PhotoExportCompleteness;
};

/**
 * Decide whether every live attachment has a durable display copy ready for
 * a full photographic backup claim.
 */
export function assessMediaArchiveCompleteness(
  attachments: readonly PhotoAttachment[],
): PhotoExportCompleteness {
  const expected = attachments
    .filter((row) => row.deletedAtMs == null)
    .map((row) => row.attachmentId);
  const included = attachments
    .filter(
      (row) =>
        row.deletedAtMs == null &&
        row.renditions.some(
          (rendition) => rendition.role === 'display' && rendition.availability === 'durable',
        ),
    )
    .map((row) => row.attachmentId);
  return classifyPhotoExportCompleteness({
    expectedAttachmentIds: expected,
    includedAttachmentIds: included,
  });
}

export async function buildMediaArchiveBundle(input: {
  attachments: PhotoAttachment[];
  readBlob: (blobKey: string) => Promise<Uint8Array>;
  password: string;
  createdAtMs: number;
  argonParams?: Argon2idParams;
  /**
   * Partial archives stay usable for text recovery but must be requested
   * explicitly — never labeled as a full photographic backup by default.
   */
  allowIncomplete?: boolean;
}): Promise<MediaArchiveBundle> {
  const completeness = assessMediaArchiveCompleteness(input.attachments);
  if (!completeness.complete && !input.allowIncomplete) {
    throw new Error('incomplete_photo_export');
  }

  const blobs: Record<string, PortableBackupEnvelope> = {};
  const manifestAttachments: MediaArchiveManifest['attachments'] = [];

  for (const attachment of input.attachments) {
    if (attachment.deletedAtMs != null) continue;
    const renditions: MediaArchiveManifest['attachments'][number]['renditions'] = [];
    for (const rendition of attachment.renditions) {
      if (rendition.availability !== 'durable') continue;
      const bytes = await input.readBlob(rendition.blobKey);
      if (bytesToHex(sha256(bytes)) !== rendition.sha256) {
        throw new Error(`Digest mismatch for ${rendition.blobKey}`);
      }
      const blobPath = `${attachment.attachmentId}/${rendition.role}.jpg.sealed.json`;
      blobs[blobPath] = sealPortableBackup(bytes, input.password, input.argonParams);
      renditions.push({
        renditionId: rendition.renditionId,
        role: rendition.role,
        mime: 'image/jpeg',
        width: rendition.width,
        height: rendition.height,
        byteLength: rendition.byteLength,
        sha256: rendition.sha256,
        normalizationVersion: rendition.normalizationVersion,
        blobPath,
      });
    }
    if (renditions.length === 0) continue;
    manifestAttachments.push({
      attachmentId: attachment.attachmentId,
      childId: attachment.childId,
      eventId: attachment.eventId,
      hostEventType: attachment.hostEventType,
      orderIndex: attachment.orderIndex,
      caption: attachment.caption,
      createdAtMs: attachment.createdAtMs,
      renditions,
    });
  }

  const manifest: MediaArchiveManifest = {
    format: MEDIA_ARCHIVE_FORMAT,
    createdAtMs: input.createdAtMs,
    completeness: completeness.label,
    attachments: manifestAttachments,
  };
  const manifestEnvelope = sealPortableBackup(
    utf8ToBytes(`${JSON.stringify(manifest)}\n`),
    input.password,
    input.argonParams,
  );
  return { manifestEnvelope, blobs, completeness };
}

export function openMediaArchiveBundle(
  bundle: MediaArchiveBundle,
  password: string,
): {
  manifest: MediaArchiveManifest;
  blobs: Record<string, Uint8Array>;
  completeness: PhotoExportCompleteness;
} {
  const manifestBytes = openPortableBackup(bundle.manifestEnvelope, password);
  const parsed = mediaManifestSchema.safeParse(JSON.parse(new TextDecoder().decode(manifestBytes)));
  if (!parsed.success) {
    throw new Error('Invalid media archive manifest');
  }
  const opened: Record<string, Uint8Array> = {};
  for (const [path, envelope] of Object.entries(bundle.blobs)) {
    opened[path] = openPortableBackup(
      parsePortableBackup(serializePortableBackup(envelope)),
      password,
    );
  }
  for (const attachment of parsed.data.attachments) {
    for (const rendition of attachment.renditions) {
      const bytes = opened[rendition.blobPath];
      if (!bytes) throw new Error(`Missing media blob ${rendition.blobPath}`);
      if (bytes.byteLength !== rendition.byteLength) {
        throw new Error(`Media blob length mismatch for ${rendition.blobPath}`);
      }
      if (bytesToHex(sha256(bytes)).toLowerCase() !== rendition.sha256.toLowerCase()) {
        throw new Error(`Media blob digest mismatch for ${rendition.blobPath}`);
      }
    }
  }
  const completeness: PhotoExportCompleteness =
    parsed.data.completeness === 'full_photo_backup'
      ? { complete: true, label: 'full_photo_backup' }
      : {
          complete: false,
          label: 'incomplete_photo_export',
          missingAttachmentIds: [],
        };
  return { manifest: parsed.data, blobs: opened, completeness };
}

export function serializeMediaArchiveBundle(bundle: MediaArchiveBundle): string {
  return `${JSON.stringify({
    format: MEDIA_ARCHIVE_FORMAT,
    manifestEnvelope: bundle.manifestEnvelope,
    blobs: bundle.blobs,
  })}\n`;
}

export function parseMediaArchiveBundle(raw: string): MediaArchiveBundle {
  const parsed = JSON.parse(raw) as {
    format?: string;
    manifestEnvelope: PortableBackupEnvelope;
    blobs: Record<string, PortableBackupEnvelope>;
  };
  if (parsed.format !== MEDIA_ARCHIVE_FORMAT) {
    throw new Error('Unsupported media archive format');
  }
  return {
    manifestEnvelope: parsePortableBackup(serializePortableBackup(parsed.manifestEnvelope)),
    blobs: Object.fromEntries(
      Object.entries(parsed.blobs).map(([path, envelope]) => [
        path,
        parsePortableBackup(serializePortableBackup(envelope)),
      ]),
    ),
    // Wire format omits the live assessment; open() re-reads the sealed label.
    completeness: { complete: false, label: 'incomplete_photo_export', missingAttachmentIds: [] },
  };
}
