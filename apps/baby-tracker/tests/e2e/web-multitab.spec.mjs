import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, 'fixtures/multitab');
const dexieSrc = path.join(here, '../../../../node_modules/dexie/dist/dexie.min.js');

test.describe('web diary multitab coordination', () => {
  /** @type {import('node:http').Server} */
  let server;
  let baseURL = '';

  test.beforeAll(async () => {
    test.skip(!fs.existsSync(dexieSrc), 'dexie.min.js missing from node_modules');
    // Copy Dexie next to the harness so Chromium can load it same-origin.
    fs.copyFileSync(dexieSrc, path.join(fixtureDir, 'dexie.min.js'));

    server = http.createServer((req, res) => {
      const urlPath = req.url === '/' ? '/index.html' : req.url;
      const filePath = path.join(fixtureDir, urlPath.replace(/^\//, ''));
      if (!filePath.startsWith(fixtureDir) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const ext = path.extname(filePath);
      const type =
        ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(fs.readFileSync(filePath));
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseURL = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const copied = path.join(fixtureDir, 'dexie.min.js');
    if (fs.existsSync(copied)) fs.unlinkSync(copied);
  });

  test('second tab cannot steal a live write lease or duplicate an active sleep', async ({
    browser,
  }) => {
    const stamp = Date.now();
    const lockName = `locks_${stamp}`;
    const diaryName = `diary_${stamp}`;
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.goto(baseURL);
    await pageB.goto(baseURL);
    await expect(pageA.locator('#status')).toHaveText('harness-ready');
    await expect(pageB.locator('#status')).toHaveText('harness-ready');

    await pageA.evaluate(
      ({ lockName, diaryName }) => {
        window.__tab = window.LumiMultitabHarness.create('tab_a', lockName, diaryName);
      },
      { lockName, diaryName },
    );
    await pageB.evaluate(
      ({ lockName, diaryName }) => {
        window.__tab = window.LumiMultitabHarness.create('tab_b', lockName, diaryName);
      },
      { lockName, diaryName },
    );

    await pageA.evaluate(async () => window.__tab.acquireWrite());
    const secondLease = await pageB.evaluate(async () => {
      try {
        await window.__tab.acquireWrite();
        return 'acquired';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    expect(secondLease).toBe('tab_lease_held');

    await pageA.evaluate(async () => {
      await window.__tab.releaseWrite();
      await window.__tab.startSleep('sleep_a');
    });
    const secondSleep = await pageB.evaluate(async () => {
      try {
        await window.__tab.startSleep('sleep_b');
        return 'started';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    expect(secondSleep).toBe('active_session_exists');

    // Crashed tab leaves an expired lease; the other tab recovers.
    await pageA.evaluate(async () => window.__tab.acquireWrite());
    await pageB.evaluate(
      ({ lockName }) => window.LumiMultitabHarness.bumpClock(lockName, 5000),
      { lockName },
    );
    await pageA.evaluate(
      ({ lockName }) => window.LumiMultitabHarness.bumpClock(lockName, 5000),
      { lockName },
    );
    const recovered = await pageB.evaluate(async () => {
      await window.__tab.acquireWrite();
      await window.__tab.releaseWrite();
      return 'recovered';
    });
    expect(recovered).toBe('recovered');

    await context.close();
  });
});
