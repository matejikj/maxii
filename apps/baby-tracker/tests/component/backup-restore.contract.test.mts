import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const panelPath = path.join(here, '../../src/features/profile/BackupRestorePanel.tsx');
const profilePath = path.join(here, '../../src/features/profile/ProfileScreen.tsx');

test('profile backup UI distinguishes local, portable, and remote concepts', () => {
  const panel = fs.readFileSync(panelPath, 'utf8');
  const profile = fs.readFileSync(profilePath, 'utf8');
  assert.match(profile, /BackupRestorePanel/);
  assert.match(panel, /Obnova v tomto zařízení/);
  assert.match(panel, /Přenosná záloha/);
  assert.match(panel, /Vzdálená záloha/);
  assert.match(panel, /není v osobní verzi/);
  assert.match(panel, /CSV pro čtení/);
  assert.match(panel, /nahrazuje|Nahrazení/);
  assert.match(panel, /Vrátit stav před obnovou/);
  assert.match(panel, /Načíst poslední export ze složky aplikace/);
  assert.match(panel, /backup-import-load-sidecar/);
  assert.match(panel, /backup-export-create/);
  assert.doesNotMatch(panel, /task-18|Co-Authored-By|as an AI/i);
});
