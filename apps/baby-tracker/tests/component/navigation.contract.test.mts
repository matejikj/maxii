import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../src');

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('four Czech tab titles and header profile entry are present', () => {
  const navigator = read('app/navigation/RootNavigator.tsx');
  assert.match(navigator, /title: 'Dnes'/);
  assert.match(navigator, /title: 'Péče'/);
  assert.match(navigator, /title: 'Rozvoj'/);
  assert.match(navigator, /title: 'Historie'/);
  assert.match(navigator, /Profile/);
  assert.doesNotMatch(navigator, /EXPO_PUBLIC_LUMI_API_URL|signIn|login/i);
});

test('welcome is skippable and does not require account or birthday', () => {
  const welcome = read('features/shell/WelcomeScreen.tsx');
  assert.match(welcome, /Přeskočit úvod/);
  assert.match(welcome, /Nastavit profil \(volitelné\)/);
  assert.match(welcome, /neblokuje deník/);
  assert.doesNotMatch(welcome, /permission request|signIn|createAccount|maskot povinn/i);
});

test('today offers show-today history action with Czech copy', () => {
  const today = read('features/today/TodayScreen.tsx');
  assert.match(today, /showTodayRecords|Zobrazit dnešní záznamy/);
  const visual = read('features/today/TodayVisuals.tsx');
  assert.match(visual, /Dnes s/);
  assert.match(today, /Otevřít profil a nastavení/);
  const copy = read('features/ui/productCopy.ts');
  assert.match(copy, /Zobrazit dnešní záznamy/);
});

test('history screen exposes filters, search, drafts and trash without network', () => {
  const history = read('features/history/HistoryScreen.tsx');
  assert.match(history, /Zrušit filtry|clearHistoryFilters/);
  assert.match(history, /Nedávno smazané|trash/);
  assert.match(history, /Koncepty|drafts/);
  assert.match(history, /rebuildSearchIndex|Obnovit hledání/);
  assert.doesNotMatch(history, /fetch\(|EXPO_PUBLIC_LUMI_API_URL|signIn/i);
  const detail = read('features/history/EventDetailScreen.tsx');
  assert.match(detail, /softDeleteCare|Upravit/);
  assert.match(detail, /undoSoftDelete|Zpět/);
});

test('startup copy never asks for login when storage fails', () => {
  const startup = read('application/startupState.ts');
  assert.match(startup, /Přihlášení ani síť nepotřebujete/);
  assert.match(startup, /Nový prázdný profil nevytváříme/);
  assert.doesNotMatch(startup, /přihlášte se|sign in|login required/i);
});
