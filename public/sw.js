/**
 * Workspace service worker.
 *
 * Scope is '/' (served from the domain root), but Dox (/dox/) and Grids
 * (/grids/) register their own service workers on narrower scopes — so this
 * worker never intercepts or caches their requests. It only handles the
 * Workspace landing page and its own assets under /js, /css, /icons and
 * /manifest.json.
 *
 * Strategy:
 *   - /api/*                    -> network only, never cached
 *   - navigation requests       -> network first, cache fallback (offline shell)
 *   - static assets (js/css/png)-> cache first, refresh in background
 */

const VERSION = 'workspace-v1';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// The minimal app shell so the login/home page can open offline.
const PRECACHE_URLS = [
  '/',
  '/workspace.css',
  '/js/themes.js',
  '/js/auth.js',
  '/js/workspace.js',
  '/js/pwa.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          // Only clean up caches this worker version owns.
          .filter((key) => key.startsWith('workspace-') && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Same-origin only — let Dox and Grids workers handle their own scopes.
  if (url.origin !== self.location.origin) return;

  // Never intercept API traffic (auth and user data must stay live).
  if (url.pathname.startsWith('/api/')) return;

  // Leave Dox and Grids to their own service workers.
  if (url.pathname.startsWith('/dox/') || url.pathname.startsWith('/grids/')) return;

  // Navigation requests: network first so logins land on the fresh page,
  // falling back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put('/', responseToCache));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets: cache first, refresh in the background.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
