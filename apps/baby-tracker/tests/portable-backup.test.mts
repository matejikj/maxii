import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_ARGON2ID_PARAMS,
  PortableBackupError,
  openPortableBackup,
  parsePortableBackup,
  sealPortableBackup,
  serializePortableBackup,
} from '../src/infrastructure/crypto/portableBackup.ts';

test('portable backup round-trips across seal and open with bounded Argon2id', () => {
  const plaintext = new TextEncoder().encode(JSON.stringify({ events: [{ type: 'diaper' }] }));
  const password = 'correct-horse-recovery';
  const envelope = sealPortableBackup(plaintext, password, {
    ...DEFAULT_ARGON2ID_PARAMS,
    t: 1,
    m: 32,
  });
  const serialized = serializePortableBackup(envelope);
  const parsed = parsePortableBackup(serialized);
  const opened = openPortableBackup(parsed, password);
  assert.equal(new TextDecoder().decode(opened), new TextDecoder().decode(plaintext));

  assert.throws(
    () => openPortableBackup(parsed, 'wrong-password'),
    (error: unknown) =>
      error instanceof PortableBackupError && error.code === 'AUTHENTICATION_FAILED',
  );
});

test('portable backup rejects oversized KDF parameters before deriving', () => {
  const plaintext = new TextEncoder().encode('x');
  assert.throws(
    () =>
      sealPortableBackup(plaintext, 'pw', {
        ...DEFAULT_ARGON2ID_PARAMS,
        m: 1_000_000,
      }),
    (error: unknown) => error instanceof PortableBackupError && error.code === 'UNSUPPORTED_PARAMS',
  );

  const sealed = sealPortableBackup(plaintext, 'pw', { ...DEFAULT_ARGON2ID_PARAMS, t: 1, m: 32 });
  const hostile = {
    ...sealed,
    kdf: { ...sealed.kdf, m: 1_000_000 },
  };
  assert.throws(
    () => openPortableBackup(hostile, 'pw'),
    (error: unknown) =>
      error instanceof PortableBackupError &&
      (error.code === 'INVALID_ENVELOPE' || error.code === 'UNSUPPORTED_PARAMS'),
  );
});

test('tampered header fails authentication instead of decrypting', () => {
  const sealed = sealPortableBackup(new TextEncoder().encode('care-note'), 'pw', {
    ...DEFAULT_ARGON2ID_PARAMS,
    t: 1,
    m: 32,
  });
  const tampered = {
    ...sealed,
    kdf: { ...sealed.kdf, t: 2 },
  };
  assert.throws(
    () => openPortableBackup(tampered, 'pw'),
    (error: unknown) =>
      error instanceof PortableBackupError && error.code === 'AUTHENTICATION_FAILED',
  );
});
