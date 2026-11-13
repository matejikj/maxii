import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { argon2id } from '@noble/hashes/argon2.js';
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';

/**
 * Portable recovery envelopes use only audited primitives: Argon2id for password
 * stretching and XChaCha20-Poly1305 for authenticated encryption. The recovery
 * password is never embedded in the file; salt and nonce are public per envelope.
 */
export const PORTABLE_BACKUP_FORMAT = 'lumi.portable-backup.v1' as const;

/** Production cost: three passes over 64 MiB, single lane, 32-byte key. */
export const DEFAULT_ARGON2ID_PARAMS = {
  t: 3,
  m: 65_536,
  p: 1,
  dkLen: 32,
} as const;

/**
 * Upper bounds reject hostile envelopes that would exhaust memory or CPU during
 * import. Values above these limits fail closed without attempting derivation.
 */
export const MAX_ARGON2ID_PARAMS = {
  t: 6,
  m: 131_072,
  p: 4,
  dkLen: 32,
} as const;

const SALT_BYTES = 16;
const NONCE_BYTES = 24;

const argonParamsSchema = z.object({
  t: z.number().int().min(1).max(MAX_ARGON2ID_PARAMS.t),
  m: z.number().int().min(8).max(MAX_ARGON2ID_PARAMS.m),
  p: z.number().int().min(1).max(MAX_ARGON2ID_PARAMS.p),
  dkLen: z.literal(MAX_ARGON2ID_PARAMS.dkLen),
});

const envelopeSchema = z.object({
  format: z.literal(PORTABLE_BACKUP_FORMAT),
  kdf: z.object({
    alg: z.literal('argon2id'),
    saltHex: z
      .string()
      .regex(/^[0-9a-f]+$/i)
      .length(SALT_BYTES * 2),
    t: argonParamsSchema.shape.t,
    m: argonParamsSchema.shape.m,
    p: argonParamsSchema.shape.p,
    dkLen: argonParamsSchema.shape.dkLen,
  }),
  cipher: z.literal('xchacha20poly1305'),
  nonceHex: z
    .string()
    .regex(/^[0-9a-f]+$/i)
    .length(NONCE_BYTES * 2),
  ciphertextHex: z
    .string()
    .regex(/^[0-9a-f]+$/i)
    .min(32),
});

export type Argon2idParams = z.infer<typeof argonParamsSchema>;
export type PortableBackupEnvelope = z.infer<typeof envelopeSchema>;

export class PortableBackupError extends Error {
  readonly code:
    | 'EMPTY_PLAINTEXT'
    | 'EMPTY_PASSWORD'
    | 'INVALID_ENVELOPE'
    | 'UNSUPPORTED_PARAMS'
    | 'AUTHENTICATION_FAILED';

  constructor(code: PortableBackupError['code'], message: string) {
    super(message);
    this.name = 'PortableBackupError';
    this.code = code;
  }
}

function assertPassword(password: string): void {
  if (password.length === 0) {
    throw new PortableBackupError('EMPTY_PASSWORD', 'Recovery password must not be empty.');
  }
}

function assertParams(params: Argon2idParams): Argon2idParams {
  const parsed = argonParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new PortableBackupError(
      'UNSUPPORTED_PARAMS',
      'Argon2id parameters are outside the accepted bounds for this app.',
    );
  }
  return parsed.data;
}

/**
 * Stable JSON used as AEAD additional data so a tampered header fails the tag
 * check instead of being silently reinterpreted.
 */
function headerAad(envelope: Omit<PortableBackupEnvelope, 'ciphertextHex'>): Uint8Array {
  return utf8ToBytes(
    JSON.stringify({
      format: envelope.format,
      kdf: envelope.kdf,
      cipher: envelope.cipher,
      nonceHex: envelope.nonceHex,
    }),
  );
}

function deriveKey(password: string, salt: Uint8Array, params: Argon2idParams): Uint8Array {
  const passwordBytes = utf8ToBytes(password);
  try {
    return argon2id(passwordBytes, salt, {
      t: params.t,
      m: params.m,
      p: params.p,
      dkLen: params.dkLen,
    });
  } finally {
    passwordBytes.fill(0);
  }
}

export function sealPortableBackup(
  plaintext: Uint8Array,
  password: string,
  params: Argon2idParams = DEFAULT_ARGON2ID_PARAMS,
): PortableBackupEnvelope {
  if (plaintext.byteLength === 0) {
    throw new PortableBackupError('EMPTY_PLAINTEXT', 'Refusing to seal an empty backup payload.');
  }
  assertPassword(password);
  const safeParams = assertParams(params);
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const header = {
    format: PORTABLE_BACKUP_FORMAT,
    kdf: {
      alg: 'argon2id' as const,
      saltHex: bytesToHex(salt),
      t: safeParams.t,
      m: safeParams.m,
      p: safeParams.p,
      dkLen: safeParams.dkLen,
    },
    cipher: 'xchacha20poly1305' as const,
    nonceHex: bytesToHex(nonce),
  };
  const key = deriveKey(password, salt, safeParams);
  try {
    const ciphertext = xchacha20poly1305(key, nonce, headerAad(header)).encrypt(plaintext);
    return {
      ...header,
      ciphertextHex: bytesToHex(ciphertext),
    };
  } finally {
    key.fill(0);
  }
}

export function openPortableBackup(envelope: unknown, password: string): Uint8Array {
  assertPassword(password);
  const parsed = envelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    throw new PortableBackupError(
      'INVALID_ENVELOPE',
      'Backup envelope failed schema or bound checks before decryption.',
    );
  }
  const safe = parsed.data;
  const params = assertParams({
    t: safe.kdf.t,
    m: safe.kdf.m,
    p: safe.kdf.p,
    dkLen: safe.kdf.dkLen,
  });
  const salt = hexToBytes(safe.kdf.saltHex);
  const nonce = hexToBytes(safe.nonceHex);
  const ciphertext = hexToBytes(safe.ciphertextHex);
  const key = deriveKey(password, salt, params);
  try {
    return xchacha20poly1305(key, nonce, headerAad(safe)).decrypt(ciphertext);
  } catch {
    throw new PortableBackupError(
      'AUTHENTICATION_FAILED',
      'Backup authentication failed. Wrong password or tampered file.',
    );
  } finally {
    key.fill(0);
  }
}

export function serializePortableBackup(envelope: PortableBackupEnvelope): string {
  return `${JSON.stringify(envelope)}\n`;
}

export function parsePortableBackup(serialized: string): PortableBackupEnvelope {
  let json: unknown;
  try {
    json = JSON.parse(serialized);
  } catch {
    throw new PortableBackupError('INVALID_ENVELOPE', 'Backup file is not valid JSON.');
  }
  const parsed = envelopeSchema.safeParse(json);
  if (!parsed.success) {
    throw new PortableBackupError(
      'INVALID_ENVELOPE',
      'Backup envelope failed schema or bound checks before decryption.',
    );
  }
  return parsed.data;
}
