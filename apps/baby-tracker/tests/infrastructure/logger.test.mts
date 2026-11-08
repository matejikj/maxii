import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLogger, formatLogLine, sanitizeLogFields } from '../../src/infrastructure/telemetry/logger.ts';

const CANARY_NOTE = 'CANARY_CARE_NOTE_7f3a9c';
const CANARY_DOB = 'CANARY_DOB_2019-04-01';

test('logger allowlist drops care notes and DOB canaries from the serialized line', () => {
  const lines: string[] = [];
  const logger = createLogger((line) => lines.push(line));
  logger.info('save_attempt', {
    code: 'STORAGE',
    note: CANARY_NOTE,
    dateOfBirth: CANARY_DOB,
    childName: 'Secret Child',
    ok: false,
  });
  assert.equal(lines.length, 1);
  const line = lines[0] ?? '';
  assert.equal(line.includes(CANARY_NOTE), false);
  assert.equal(line.includes(CANARY_DOB), false);
  assert.equal(line.includes('Secret Child'), false);
  assert.match(line, /"code":"STORAGE"/);
  assert.match(line, /"ok":false/);
  assert.match(line, /\[redacted\]/);
});

test('sanitizeLogFields redacts unknown keys even before sink formatting', () => {
  const sanitized = sanitizeLogFields({
    code: 'VALIDATION',
    payload: { note: CANARY_NOTE },
  });
  assert.equal(sanitized.code, 'VALIDATION');
  assert.equal(sanitized.payload, '[redacted]');
  const formatted = formatLogLine('error', 'boom', { dateOfBirth: CANARY_DOB, retryable: true });
  assert.equal(formatted.includes(CANARY_DOB), false);
  assert.match(formatted, /"retryable":true/);
});
