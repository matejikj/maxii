import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(here, '../../src/features/profile/SettingsPanel.tsx');
const profilePath = path.join(here, '../../src/features/profile/ProfileScreen.tsx');
const lockPath = path.join(here, '../../src/features/shell/AppLockGate.tsx');

test('settings UI groups privacy controls without a second calm-mode switch', () => {
  const settings = [
    'SettingsPanel.tsx',
    'AppearanceSettings.tsx',
    'ReminderSettings.tsx',
    'settingsPresentation.ts',
  ]
    .map((file) => fs.readFileSync(path.join(path.dirname(settingsPath), file), 'utf8'))
    .join('\n');
  const profile = fs.readFileSync(profilePath, 'utf8');
  assert.match(profile, /SettingsPanel/);
  assert.match(settings, /Pohyb postav/);
  assert.match(settings, /Připomínky/);
  assert.match(settings, /Úplné smazání/);
  assert.match(settings, /Diagnostika/);
  assert.match(settings, /Zámek aplikace/);
  assert.match(settings, /Uloženo v zařízení/);
  assert.match(settings, /Přenosná záloha/);
  assert.match(settings, /Vzdálená záloha/);
  assert.doesNotMatch(settings, /klidn(ý|ého) režim|calm mode/i);
  assert.doesNotMatch(settings, /task-19|Co-Authored-By/i);
});

test('app lock gate explains PIN does not rotate the diary key', () => {
  const source = fs.readFileSync(lockPath, 'utf8');
  assert.match(source, /šifrovací klíč|SQLCipher|přenosnou zálohu/i);
  assert.match(source, /lockOnBackground/);
});
