/* LUMI personal web shell: cache versioned public assets only — never auth, diaries, or diagnostics. */
const CACHE = 'lumi-public-v1';
const PRECACHE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  // Do not skipWaiting here — a calm client moment must activate the worker so
  // an open care form is never force-reloaded mid-edit.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
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
        if (request.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        throw error;
      }
    }),
  );
});
