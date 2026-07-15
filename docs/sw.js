'use strict';
// Cache-first service worker. The cache name embeds a build hash, so a new
// deploy invalidates the old cache on the next online visit.
const CACHE = 'fanta-a42447ef';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  // fetch with cache:'no-cache' so a stale HTTP cache (GitHub Pages sends
  // max-age=600) can never be precached as the "new" version
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ASSETS.map((u) =>
        fetch(u, { cache: 'no-cache' }).then((r) => {
          if (!r.ok) throw new Error('precache failed: ' + u);
          return c.put(u, r);
        })
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit ||
      fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('./') : undefined))
    )
  );
});
