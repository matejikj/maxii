import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

export function hexToUint8(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new RangeError('Expected even-length hex');
  }
  return hexToBytes(hex.toLowerCase());
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  const base64 = encodeBase64(bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLength);
  return decodeBase64(base64);
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
  }
  return out;
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const cleaned = base64.replace(/=+$/g, '');
  const out = new Uint8Array(Math.floor((cleaned.length * 3) / 4));
  let outIndex = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = alphabet.indexOf(cleaned[i]!);
    const b = alphabet.indexOf(cleaned[i + 1]!);
    const c = i + 2 < cleaned.length ? alphabet.indexOf(cleaned[i + 2]!) : 0;
    const d = i + 3 < cleaned.length ? alphabet.indexOf(cleaned[i + 3]!) : 0;
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new RangeError('Invalid base64');
    }
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (outIndex < out.length) out[outIndex++] = (triple >> 16) & 255;
    if (i + 2 < cleaned.length && outIndex < out.length) out[outIndex++] = (triple >> 8) & 255;
    if (i + 3 < cleaned.length && outIndex < out.length) out[outIndex++] = triple & 255;
  }
  return out.subarray(0, outIndex);
}

export { bytesToHex };
