import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const distWeb = path.join(root, 'dist-web');
const hasWebExport = fs.existsSync(distWeb);

/**
 * Web E2E: Today shell needs a static Expo export on :4173. Multitab storage
 * tests boot their own fixture server and do not require dist-web.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  ...(hasWebExport
    ? {
        webServer: {
          command: 'npx --yes serve dist-web -l 4173',
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
