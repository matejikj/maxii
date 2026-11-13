import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('family durability card and account panel wire the four parent labels', () => {
  const card = readFileSync(
    join(root, 'src/features/family/FamilyDurabilityStatusCard.tsx'),
    'utf8',
  );
  const panel = readFileSync(join(root, 'src/features/profile/FamilyAccountPanel.tsx'), 'utf8');
  const copy = readFileSync(join(root, 'src/features/ui/productCopy.ts'), 'utf8');

  assert.match(card, /buildFamilyDurabilityPresentation/);
  assert.match(card, /claims other offline phones/i);
  assert.match(panel, /FamilyDurabilityStatusCard/);
  assert.match(copy, /awaitingTransfer:\s*'Čeká na přenos\.'/);
  assert.match(copy, /synchronized:\s*'Synchronizováno\.'/);
  assert.match(copy, /backupCreated:\s*'Záloha vytvořena\.'/);
  assert.match(copy, /synchronizedCaveat/);
  assert.match(copy, /backupDistinctFromSync/);
});
