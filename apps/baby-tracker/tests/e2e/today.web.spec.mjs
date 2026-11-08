import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distWeb = path.join(here, '../../dist-web');

test.beforeAll(() => {
  test.skip(
    !fs.existsSync(distWeb),
    'dist-web missing — run npm run export:web in apps/baby-tracker first (device/web CI job).',
  );
});

test('Today shell renders brand and empty state on the prepared web export', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('LUMI')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Deník miminka' })).toBeVisible();
  await expect(page.getByText('Každý den spolu')).toBeVisible();
});
