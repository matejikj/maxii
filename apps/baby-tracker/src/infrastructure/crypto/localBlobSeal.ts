import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * Device-local authenticated encryption for recovery points that never leave
 * the phone. Uses a random key from the platform vault — not a caregiver password.
 */
export const LOCAL_BLOB_FORMAT = 'lumi.local-blob.v1' as const;

const NONCE_BYTES = 24;

export type SealedLocalBlob = {
  readonly format: typeof LOCAL_BLOB_FORMAT;
  readonly nonceHex: string;
  readonly ciphertextHex: string;
};

export function sealLocalBlob(plaintext: Uint8Array, key: Uint8Array): SealedLocalBlob {
  if (key.byteLength !== 32) {
    throw new RangeError('Local blob key must be 32 bytes');
  }
  if (plaintext.byteLength === 0) {
    throw new RangeError('Refusing to seal an empty local blob');
  }
  const nonce = randomBytes(NONCE_BYTES);
  const aad = utf8ToBytes(LOCAL_BLOB_FORMAT);
  const ciphertext = xchacha20poly1305(key, nonce, aad).encrypt(plaintext);
  return {
    format: LOCAL_BLOB_FORMAT,
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
}

export function openLocalBlob(sealed: SealedLocalBlob, key: Uint8Array): Uint8Array {
  if (sealed.format !== LOCAL_BLOB_FORMAT) {
    throw new RangeError('Unknown local blob format');
  }
  if (key.byteLength !== 32) {
    throw new RangeError('Local blob key must be 32 bytes');
  }
  const nonce = hexToBytes(sealed.nonceHex);
  const ciphertext = hexToBytes(sealed.ciphertextHex);
  const aad = utf8ToBytes(LOCAL_BLOB_FORMAT);
  return xchacha20poly1305(key, nonce, aad).decrypt(ciphertext);
}

export function serializeSealedLocalBlob(sealed: SealedLocalBlob): string {
  return `${JSON.stringify(sealed)}\n`;
}

export function parseSealedLocalBlob(raw: string): SealedLocalBlob {
  const parsed = JSON.parse(raw) as Partial<SealedLocalBlob>;
  if (
    parsed.format !== LOCAL_BLOB_FORMAT ||
    typeof parsed.nonceHex !== 'string' ||
    typeof parsed.ciphertextHex !== 'string'
  ) {
    throw new RangeError('Invalid sealed local blob');
  }
  return {
    format: LOCAL_BLOB_FORMAT,
    nonceHex: parsed.nonceHex,
    ciphertextHex: parsed.ciphertextHex,
  };
}
