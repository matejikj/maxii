import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const NONCE_BYTES = 24;

export type SealedAttachmentBlob = {
  format: 'lumi.attachment-blob.v1';
  nonceHex: string;
  ciphertextHex: string;
};

/**
 * Per-rendition sealed blobs reuse the audited XChaCha20-Poly1305 primitive.
 * AAD binds the opaque blob key so swapped files fail authentication.
 */
export function sealAttachmentBlob(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: string,
): SealedAttachmentBlob {
  if (key.length !== 32) throw new Error('Attachment blob key must be 32 bytes');
  if (plaintext.length === 0) throw new Error('Cannot seal empty attachment bytes');
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = xchacha20poly1305(key, nonce, utf8ToBytes(aad));
  const ciphertext = cipher.encrypt(plaintext);
  return {
    format: 'lumi.attachment-blob.v1',
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
}

export function openAttachmentBlob(
  key: Uint8Array,
  sealed: SealedAttachmentBlob,
  aad: string,
): Uint8Array {
  if (sealed.format !== 'lumi.attachment-blob.v1') {
    throw new Error('Unsupported attachment blob format');
  }
  const nonce = hexToBytes(sealed.nonceHex);
  const ciphertext = hexToBytes(sealed.ciphertextHex);
  const cipher = xchacha20poly1305(key, nonce, utf8ToBytes(aad));
  try {
    return cipher.decrypt(ciphertext);
  } catch {
    throw new Error('Attachment blob authentication failed');
  }
}
