import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatReminderTime, parseReminderTime, resolveSettingsSection } from '../../src/features/profile/settingsPresentation.ts';

test('reminder time preserves minutes and accepts the full day range', () => {
  assert.deepEqual(parseReminderTime('00:00'), { hour: 0, minute: 0 });
  assert.deepEqual(parseReminderTime('23:59'), { hour: 23, minute: 59 });
  assert.deepEqual(parseReminderTime(' 8:05 '), { hour: 8, minute: 5 });
  for (const hour of [0, 8, 18, 23]) for (const minute of [0, 5, 30, 59]) {
    assert.deepEqual(parseReminderTime(formatReminderTime(hour, minute)), { hour, minute });
  }
});
test('invalid reminder time cannot silently change an existing schedule', () => {
  for (const value of ['', ' ', '24:00', '12:60', '-1:00', '18', '18:5', '9:99', 'abc', '12:00pm', '18:30:00']) {
    assert.throws(() => parseReminderTime(value), /00:00.*23:59/);
  }
});

test('settings links reject unknown sections and safely open the hub', () => {
  assert.equal(resolveSettingsSection('children'), 'children');
  assert.equal(resolveSettingsSection('appearance'), 'appearance');
  for (const value of [undefined, null, '', 'unknown', '__proto__', [], { section: 'privacy' }]) {
    assert.equal(resolveSettingsSection(value), null);
  }
});
