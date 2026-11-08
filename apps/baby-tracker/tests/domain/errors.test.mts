import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError, isAppError } from '../../src/domain/errors.ts';
import { createFrozenClock } from '../../src/infrastructure/testing/frozenClock.ts';
import { createCryptoIdGenerator } from '../../src/infrastructure/ids/cryptoIdGenerator.ts';

test('AppError carries a stable code without embedding care payloads in the message contract', () => {
  const error = new AppError('STORAGE', 'Local save did not finish', {
    details: { stage: 'commit' },
    retryable: true,
  });
  assert.equal(error.code, 'STORAGE');
  assert.equal(error.retryable, true);
  assert.equal(error.details.stage, 'commit');
  assert.equal(isAppError(error), true);
  assert.equal(isAppError(new Error('x')), false);
});

test('frozen clock and crypto ids are deterministic enough for domain tests', () => {
  const clock = createFrozenClock(1_700_000_000_000);
  assert.equal(clock.now().epochMs, 1_700_000_000_000);
  const ids = createCryptoIdGenerator();
  const a = ids.createId('op');
  const b = ids.createId('op');
  assert.match(a, /^op_[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});
