import { ed25519 } from '@noble/curves/ed25519.js';
import { canonicalizeJson, utf8Bytes } from './canonicalize';
import { base64UrlToBytes, hexToUint8, sha256Hex } from './bytes';
import {
  CONTENT_PACK_FORMAT,
  CONTENT_PACK_LIMITS,
  CONTENT_PACK_SIGNATURE_ALGORITHM,
  CONTENT_PACK_SIGNATURE_FORMAT,
  CONTENT_READER_VERSION,
} from './limits';
import { findTrustedKey } from './trust';
import type { ContentPackFileBytes, ContentPackManifest, ContentPackSignature } from './types';
import { validateContentPackManifest } from './validatePack';

export type VerifyPackOptions = {
  readonly allowDevelopmentKeys?: boolean;
  readonly supportedReaderVersion?: string;
  readonly knownRevokedActivityIds?: ReadonlySet<string>;
  readonly highestAcceptedGenerationByPackId?: ReadonlyMap<string, number>;
};

export type VerifyPackResult =
  | { ok: true; manifest: ContentPackManifest; signature: ContentPackSignature }
  | { ok: false; code: string; message: string };

/**
 * Verify signature, digests, schema, generation floor and revoked activities
 * before any activation. Never disables checks for “offline convenience”.
 */
export function verifyContentPack(
  manifestRaw: unknown,
  signatureRaw: unknown,
  files: readonly ContentPackFileBytes[],
  options: VerifyPackOptions = {},
): VerifyPackResult {
  const signature = parseSignature(signatureRaw);
  if (!signature.ok) return signature;

  const sigBytes = utf8Bytes(JSON.stringify(signatureRaw));
  if (sigBytes.byteLength > CONTENT_PACK_LIMITS.maxSignatureBytes) {
    return {
      ok: false,
      code: 'signature_too_large',
      message: 'Signature envelope exceeds the pack budget.',
    };
  }

  const validated = validateContentPackManifest(manifestRaw);
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.errors[0]?.code ?? 'manifest',
      message: validated.errors[0]?.message ?? 'Invalid manifest',
    };
  }
  const manifest = validated.manifest;

  const readerVersion = options.supportedReaderVersion ?? CONTENT_READER_VERSION;
  if (manifest.readerVersion !== readerVersion) {
    return {
      ok: false,
      code: 'reader_unsupported',
      message: `Unsupported readerVersion "${manifest.readerVersion}".`,
    };
  }

  const trusted = findTrustedKey(
    signature.value.keyId,
    options.allowDevelopmentKeys === undefined
      ? {}
      : { allowDevelopmentKeys: options.allowDevelopmentKeys },
  );
  if (!trusted) {
    return {
      ok: false,
      code: 'unknown_or_dev_key',
      message: `Key "${signature.value.keyId}" is not trusted for this build.`,
    };
  }

  const message = utf8Bytes(canonicalizeJson(manifest));
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlToBytes(signature.value.signature);
  } catch {
    return { ok: false, code: 'signature_encoding', message: 'Signature is not valid base64url.' };
  }
  if (signatureBytes.length !== 64) {
    return { ok: false, code: 'signature_length', message: 'Ed25519 signature must be 64 bytes.' };
  }
  const publicKey = hexToUint8(trusted.publicKeyHex);
  if (!ed25519.verify(signatureBytes, message, publicKey)) {
    return {
      ok: false,
      code: 'signature_invalid',
      message: 'Manifest signature verification failed.',
    };
  }

  const floor = options.highestAcceptedGenerationByPackId?.get(manifest.packId) ?? 0;
  if (manifest.generation < floor) {
    return {
      ok: false,
      code: 'generation_too_low',
      message: `Generation ${manifest.generation} is below the accepted floor ${floor}.`,
    };
  }

  const revoked = options.knownRevokedActivityIds;
  if (revoked) {
    for (const revisionId of manifest.activityRevisionIds) {
      const activityId = revisionId.includes('.')
        ? revisionId.slice(0, revisionId.indexOf('.'))
        : revisionId;
      if (revoked.has(activityId) || revoked.has(revisionId)) {
        return {
          ok: false,
          code: 'revoked_activity',
          message: `Pack references revoked activity "${revisionId}".`,
        };
      }
    }
  }

  if (files.length !== manifest.files.length) {
    return {
      ok: false,
      code: 'file_count_mismatch',
      message: 'Staged file count does not match the manifest.',
    };
  }

  const byLogicalId = new Map(files.map((file) => [file.logicalId, file]));
  let total = 0;
  for (const entry of manifest.files) {
    const file = byLogicalId.get(entry.logicalId);
    if (!file) {
      return {
        ok: false,
        code: 'missing_file',
        message: `Missing staged file "${entry.logicalId}".`,
      };
    }
    if (file.bytes.byteLength !== entry.byteLength) {
      return {
        ok: false,
        code: 'file_length_mismatch',
        message: `Byte length mismatch for "${entry.logicalId}".`,
      };
    }
    if (file.bytes.byteLength > CONTENT_PACK_LIMITS.maxFileBytes) {
      return {
        ok: false,
        code: 'file_too_large',
        message: `File "${entry.logicalId}" exceeds the per-file budget.`,
      };
    }
    const digest = sha256Hex(file.bytes);
    if (digest !== entry.sha256) {
      return {
        ok: false,
        code: 'digest_mismatch',
        message: `SHA-256 mismatch for "${entry.logicalId}".`,
      };
    }
    total += file.bytes.byteLength;
  }
  if (total !== manifest.totalBytes) {
    return {
      ok: false,
      code: 'total_bytes_mismatch',
      message: 'Sum of file lengths does not match totalBytes.',
    };
  }
  if (total > CONTENT_PACK_LIMITS.maxPackBytes) {
    return {
      ok: false,
      code: 'pack_too_large',
      message: 'Pack exceeds the total byte budget.',
    };
  }

  return { ok: true, manifest, signature: signature.value };
}

function parseSignature(
  raw: unknown,
): { ok: true; value: ContentPackSignature } | { ok: false; code: string; message: string } {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'signature_shape', message: 'Signature must be an object.' };
  }
  const record = raw as Record<string, unknown>;
  if (Object.keys(record).length !== 4) {
    // Reject unexpected keys to keep the envelope strict.
    const allowed = new Set(['format', 'algorithm', 'keyId', 'signature']);
    for (const key of Object.keys(record)) {
      if (!allowed.has(key)) {
        return { ok: false, code: 'signature_key', message: `Unexpected signature key "${key}".` };
      }
    }
  }
  if (record.format !== CONTENT_PACK_SIGNATURE_FORMAT) {
    return { ok: false, code: 'signature_format', message: 'Unknown signature format.' };
  }
  if (record.algorithm !== CONTENT_PACK_SIGNATURE_ALGORITHM) {
    return { ok: false, code: 'signature_algorithm', message: 'Unsupported signature algorithm.' };
  }
  if (typeof record.keyId !== 'string' || record.keyId.length < 1 || record.keyId.length > 64) {
    return { ok: false, code: 'signature_key_id', message: 'Invalid signature keyId.' };
  }
  if (typeof record.signature !== 'string' || record.signature.length < 1) {
    return { ok: false, code: 'signature_value', message: 'Missing signature value.' };
  }
  return {
    ok: true,
    value: {
      format: CONTENT_PACK_SIGNATURE_FORMAT,
      algorithm: CONTENT_PACK_SIGNATURE_ALGORITHM,
      keyId: record.keyId,
      signature: record.signature,
    },
  };
}

export function assertManifestFormat(value: unknown): value is ContentPackManifest {
  return (
    value != null &&
    typeof value === 'object' &&
    (value as { format?: unknown }).format === CONTENT_PACK_FORMAT
  );
}
