import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type {
  NormalizedPhotoBytes,
  PhotoProcessor,
  PickedPhotoCandidate,
} from '../../domain/attachments';
import {
  ATTACHMENT_LIMITS,
  buildNormalizeAttempts,
  buildThumbnailAttempts,
  evaluatePhotoInput,
  scaledSize,
  stripJpegMetadata,
} from '../../domain/attachments';

export type ManipulatedImage = {
  uri: string;
  width: number;
  height: number;
  base64?: string;
};

export type PhotoManipulateFn = (
  uri: string,
  actions: Array<{ resize: { width: number; height: number } }>,
  options: { compress: number; format: 'jpeg'; base64: true },
) => Promise<ManipulatedImage>;

export type TempJpegHandle = {
  uri: string;
  cleanup: () => Promise<void>;
};

export function decodeBase64Jpeg(base64: string): Uint8Array {
  const normalized = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const atobFn = (globalThis as { atob?: (value: string) => string }).atob;
  if (typeof atobFn === 'function') {
    const binary = atobFn(normalized);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  const nodeBuffer = (
    globalThis as {
      Buffer?: { from(data: string, encoding: 'base64'): Uint8Array };
    }
  ).Buffer;
  if (nodeBuffer) {
    return Uint8Array.from(nodeBuffer.from(normalized, 'base64'));
  }
  throw new Error('No base64 decoder available for photo normalization');
}

/**
 * Platform-agnostic normalize ladder. Expo adapters inject manipulate + temp I/O;
 * Node tests inject fakes so ImageManipulator never loads in contract suites.
 */
export function createPhotoNormalizeProcessor(input: {
  manipulate: PhotoManipulateFn;
  writeTempJpeg: (bytes: Uint8Array) => Promise<TempJpegHandle>;
  cleanupUri?: (uri: string) => Promise<void>;
  allowHeic?: boolean;
}): PhotoProcessor {
  const cleanupUri = input.cleanupUri ?? (async () => undefined);

  async function encodeFromUri(
    sourceUri: string,
    width: number,
    height: number,
    attempts: Array<{ maxEdgePx: number; jpegQuality: number }>,
    maxBytes: number,
  ): Promise<NormalizedPhotoBytes> {
    let lastError: unknown = null;
    for (const attempt of attempts) {
      const size = scaledSize(width, height, attempt.maxEdgePx);
      let result: ManipulatedImage | null = null;
      try {
        result = await input.manipulate(
          sourceUri,
          [{ resize: { width: size.width, height: size.height } }],
          {
            compress: attempt.jpegQuality,
            format: 'jpeg',
            base64: true,
          },
        );
        if (!result.base64) {
          throw new Error('photo_normalize_missing_bytes');
        }
        const stripped = stripJpegMetadata(decodeBase64Jpeg(result.base64));
        if (stripped.byteLength > maxBytes) {
          lastError = new Error('photo_display_too_large');
          continue;
        }
        return {
          mime: 'image/jpeg',
          bytes: stripped,
          width: result.width || size.width,
          height: result.height || size.height,
          sha256: bytesToHex(sha256(stripped)),
        };
      } catch (error) {
        lastError = error;
      } finally {
        if (result?.uri && result.uri !== sourceUri) {
          await cleanupUri(result.uri);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('photo_normalize_failed');
  }

  return {
    async normalizeDisplay(candidate: PickedPhotoCandidate): Promise<NormalizedPhotoBytes> {
      const decision = evaluatePhotoInput(candidate, { allowHeic: input.allowHeic === true });
      if (!decision.ok) {
        throw new Error(`${decision.code}: ${decision.message}`);
      }
      const width = candidate.width ?? ATTACHMENT_LIMITS.displayMaxEdgePx;
      const height = candidate.height ?? ATTACHMENT_LIMITS.displayMaxEdgePx;
      const attempts = buildNormalizeAttempts(Math.max(width, height));
      return encodeFromUri(
        candidate.sourceUri,
        width,
        height,
        attempts,
        ATTACHMENT_LIMITS.displayMaxBytes,
      );
    },
    async normalizeThumbnail(display: NormalizedPhotoBytes): Promise<NormalizedPhotoBytes> {
      const temp = await input.writeTempJpeg(display.bytes);
      try {
        const attempts = buildThumbnailAttempts(Math.max(display.width, display.height));
        return await encodeFromUri(
          temp.uri,
          display.width,
          display.height,
          attempts,
          ATTACHMENT_LIMITS.thumbnailMaxBytes,
        );
      } finally {
        await temp.cleanup();
      }
    },
  };
}
