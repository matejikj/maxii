/* LUMI personal web shell: cache versioned public assets only — never auth, diaries, or diagnostics. */
const CACHE = 'lumi-public-v2';
/** Absolute same-origin shell paths — relative cache.add can fail on redirects from `/`. */
const PRECACHE = ['/', '/index.html'];

async function matchShell(cache) {
  return (
    (await cache.match('/index.html')) ||
    (await cache.match('/')) ||
    (await cache.match('./index.html')) ||
    (await cache.match('./'))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) {
              await cache.put(url, response.clone());
              // Also store under /index.html when `/` served the shell document.
              if (url === '/' && response.headers.get('content-type')?.includes('text/html')) {
                await cache.put('/index.html', response.clone());
              }
            }
          } catch {
            // Skip optional shell files so one missing asset cannot block offline start.
          }
        }),
      );
      // First install may activate immediately. Later updates stay waiting until
      // the client sends LUMI_ACTIVATE_SW so an open care form is not reloaded.
      if (!self.registration.active) {
        await self.skipWaiting();
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      // Take control of already-open tabs on first activation so offline restart
      // works without forcing a mid-form reload via skipWaiting during install.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LUMI_ACTIVATE_SW') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never put private API/auth/diagnostic responses into the public cache.
  if (url.pathname.includes('/api/') || url.pathname.includes('diagnostics')) return;

  const isDocument = request.mode === 'navigate' || request.destination === 'document';

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        if (isDocument) {
          const shell = await matchShell(cache);
          if (shell) return shell;
        }
        throw error;
      }
    }),
  );
});
