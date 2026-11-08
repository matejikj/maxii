import { ed25519 } from '@noble/curves/ed25519.js';
import { canonicalizeJson, utf8Bytes } from './canonicalize';
import { bytesToBase64Url, hexToUint8 } from './bytes';
import {
  CONTENT_PACK_SIGNATURE_ALGORITHM,
  CONTENT_PACK_SIGNATURE_FORMAT,
} from './limits';
import type { ContentPackManifest, ContentPackSignature } from './types';

export function signContentPackManifest(
  manifest: ContentPackManifest,
  privateKeyHex: string,
  keyId: string,
): ContentPackSignature {
  const message = utf8Bytes(canonicalizeJson(manifest));
  const secret = hexToUint8(privateKeyHex);
  if (secret.length !== 32) {
    throw new RangeError('Ed25519 private key must be 32 bytes');
  }
  const signature = ed25519.sign(message, secret);
  return {
    format: CONTENT_PACK_SIGNATURE_FORMAT,
    algorithm: CONTENT_PACK_SIGNATURE_ALGORITHM,
    keyId,
    signature: bytesToBase64Url(signature),
  };
}
