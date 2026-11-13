import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

test.beforeAll(() => {
  test.skip(
    !fs.existsSync(fileURLToPath(new URL('../../dist-web', import.meta.url))),
    'Run a fresh export:web before exercising the milestone screen.',
  );
});

test('milestone atlas records, edits and restores catalog and custom memories', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Přeskočit úvod' });
  const development = page.getByTestId('forest-tab-development');
  await Promise.race([
    skip.waitFor({ state: 'visible' }),
    development.waitFor({ state: 'visible' }),
  ]);
  if (await skip.isVisible()) await skip.click();
  await development.click();
  await page.getByTestId('development-tab-milestones').click();
  await expect(page.getByTestId('milestones-hero')).toBeVisible();
  await expect(page.getByTestId('milestones-filters')).toHaveAttribute('aria-expanded', 'false');
  await page.getByTestId('milestones-search').fill('sluvka');
  await page.getByTestId('milestone-first-words').click();
  await expect(page.getByRole('button', { name: /Zdroj: CDC/ })).toBeAttached();
  await page.getByTestId('milestones-record').click();
  await page.getByTestId('milestones-title').fill('První slůvko „ahoj“');
  await page.getByTestId('milestones-note').fill('Pozdravilo nás u dveří.');
  await page.getByTestId('milestones-save').click();
  await expect(page.getByTestId('milestones-saved')).toBeVisible();
  const memories = page.locator('[data-testid^="milestone-memory-"]');
  await expect(memories).toHaveCount(1);
  await memories.first().click();
  await page.getByTestId('milestones-edit').click();
  await page.getByTestId('milestones-title').fill('První „ahoj“ s úsměvem');
  await page.getByTestId('milestones-save').click();
  await expect(memories).toHaveCount(1);
  await expect(memories.first()).toContainText('První „ahoj“ s úsměvem');
  await page.getByTestId('milestones-add-custom').click();
  await page.getByTestId('milestones-title').fill('Naše první společná říkanka');
  await page.getByTestId('milestones-save').click();
  await expect(memories).toHaveCount(2);
  await page.reload();
  await development.click();
  await page.getByTestId('development-tab-milestones').click();
  await page.getByTestId('milestones-show-memories').click();
  await expect(memories).toHaveCount(2);
  await page.getByTestId('milestones-show-atlas').click();
  await page.getByTestId('milestones-filters').click();
  await page.getByTestId('milestones-category-movement').click();
  await page.getByTestId('milestones-period-second-year').click();
  await expect(page.getByTestId('milestone-first-steps')).toBeAttached();
  await expect(page.getByTestId('milestone-first-words')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 780 });
  for (const id of ['inspiration', 'library', 'together', 'milestones']) {
    const box = await page.getByTestId(`development-tab-${id}`).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
  }
  expect(runtimeErrors).toEqual([]);
});
