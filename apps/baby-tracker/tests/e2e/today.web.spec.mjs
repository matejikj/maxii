import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distWeb = path.join(here, '../../dist-web');

test.beforeAll(() => {
  test.skip(
    !fs.existsSync(distWeb),
    'dist-web missing — run npm run export:web in apps/baby-tracker first.',
  );
});

async function skipWelcomeIfPresent(page) {
  const skip = page.getByRole('button', { name: 'Přeskočit úvod' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
  }
}

test('welcome can be skipped and Today shows without an account', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('LUMI').first()).toBeVisible();
  await skipWelcomeIfPresent(page);
  await expect(page.getByRole('heading', { name: /Dnes s / })).toBeVisible();
  await expect(page.getByTestId('today-date')).toBeVisible();
});

test('diaper direct action persists after reload on the prepared web export', async ({ page }) => {
  await page.goto('/');
  await skipWelcomeIfPresent(page);
  await expect(page.getByTestId('today-screen')).toBeVisible();
  await page.getByTestId('quick-diaper').click();
  await expect(page.getByText('Zapsat plenku nyní')).toBeVisible({ timeout: 15_000 });
  await page.getByText('Zapsat mokrou', { exact: true }).click();
  await expect(page.getByText('Přebalení uloženo.')).toBeVisible({ timeout: 15_000 });
  // Last-care card updates without leaving Today.
  await expect(page.getByText(/Plenka/i).first()).toBeVisible({ timeout: 15_000 });
  // Fresh navigation (not reload) avoids racing an just-activated service worker cache.
  await page.goto('/', { waitUntil: 'networkidle' });
  await skipWelcomeIfPresent(page);
  await expect(page.getByRole('heading', { name: /Dnes s / })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Plenka|mokrá|Přebalení/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test('service worker registers and serves the shell offline after first visit', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByText('LUMI').first()).toBeVisible();

  const registration = await page.evaluate(async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error('service worker did not claim the page')),
            15_000,
          );
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              clearTimeout(timer);
              resolve(undefined);
            },
            { once: true },
          );
        });
      }
      return {
        ok: true,
        state: reg.active?.state ?? null,
        controlling: Boolean(navigator.serviceWorker.controller),
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
  expect(registration.ok, JSON.stringify(registration)).toBeTruthy();
  expect(registration.controlling, JSON.stringify(registration)).toBeTruthy();

  // Online revisit so the controlling worker can cache hashed shell assets.
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByText('LUMI').first()).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const cache = await caches.open('lumi-public-v2');
        const shell =
          (await cache.match('/index.html')) ||
          (await cache.match('./index.html')) ||
          (await cache.match('/'));
        return Boolean(shell);
      }),
    )
    .toBeTruthy();

  // Prefer goto over reload: CDP offline can fail reload before the SW intercepts.
  await context.setOffline(true);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('LUMI').first()).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
});

test('accessibility: Today exposes header and primary diaper action by role/name', async ({
  page,
}) => {
  await page.goto('/');
  await skipWelcomeIfPresent(page);
  await expect(page.getByRole('heading', { name: /Dnes s / })).toBeVisible();
  await expect(page.getByRole('button', { name: /Plenka|diaper|quick-diaper/i }).or(
    page.getByTestId('quick-diaper'),
  )).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Otevřít profil a nastavení' }),
  ).toBeVisible();
});
