import { bytesToHex, randomBytes } from '@noble/hashes/utils.js';
import type { IdGenerator } from '../../domain';

/**
 * Cryptographic random IDs avoid sequential guessing and do not encode birth
 * dates or device clocks into entity identity.
 */
export function createCryptoIdGenerator(): IdGenerator {
  return {
    createId(prefix = 'id') {
      return `${prefix}_${bytesToHex(randomBytes(16))}`;
    },
  };
}
