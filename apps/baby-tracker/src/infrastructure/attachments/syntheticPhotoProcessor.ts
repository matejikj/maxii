import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { NormalizedPhotoBytes, PhotoProcessor, PickedPhotoCandidate } from '../../domain/attachments';
import {
  ATTACHMENT_LIMITS,
  buildNormalizeAttempts,
  buildThumbnailAttempts,
  evaluatePhotoInput,
  scaledSize,
  stripJpegMetadata,
} from '../../domain/attachments';
import { buildMinimalJpeg } from '../../domain/attachments/stripJpegMetadata';

/**
 * Deterministic processor for Node tests. Treats candidate dimensions as truth
 * and emits stripped synthetic JPEGs sized by the normalize ladder.
 */
export function createSyntheticPhotoProcessor(): PhotoProcessor {
  return {
    async normalizeDisplay(candidate: PickedPhotoCandidate): Promise<NormalizedPhotoBytes> {
      const decision = evaluatePhotoInput(candidate);
      if (!decision.ok) {
        throw new Error(`${decision.code}: ${decision.message}`);
      }
      const width = candidate.width ?? 1200;
      const height = candidate.height ?? 900;
      const attempts = buildNormalizeAttempts(Math.max(width, height));
      for (const attempt of attempts) {
        const size = scaledSize(width, height, attempt.maxEdgePx);
        const bytes = stripJpegMetadata(
          buildMinimalJpeg({
            withExifGps: true,
            comment: `q=${attempt.jpegQuality};${size.width}x${size.height}`,
          }),
        );
        // Synthetic payload stays tiny; enforce the product byte ceiling anyway.
        if (bytes.byteLength <= ATTACHMENT_LIMITS.displayMaxBytes) {
          return {
            mime: 'image/jpeg',
            bytes,
            width: size.width,
            height: size.height,
            sha256: bytesToHex(sha256(bytes)),
          };
        }
      }
      throw new Error('photo_normalize_failed');
    },
    async normalizeThumbnail(display: NormalizedPhotoBytes): Promise<NormalizedPhotoBytes> {
      const attempts = buildThumbnailAttempts(Math.max(display.width, display.height));
      for (const attempt of attempts) {
        const size = scaledSize(display.width, display.height, attempt.maxEdgePx);
        const bytes = stripJpegMetadata(
          buildMinimalJpeg({ comment: `thumb;q=${attempt.jpegQuality}` }),
        );
        if (bytes.byteLength <= ATTACHMENT_LIMITS.thumbnailMaxBytes) {
          return {
            mime: 'image/jpeg',
            bytes,
            width: size.width,
            height: size.height,
            sha256: bytesToHex(sha256(bytes)),
          };
        }
      }
      throw new Error('photo_thumbnail_failed');
    },
  };
}
