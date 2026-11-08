import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Canonical payload digest shared with the family sync wire format. */
export function createHash(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}
