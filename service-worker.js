// Service Worker tolerante (no falla si faltan iconos)
const CACHE_NAME = 'planazoo-v2';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/enhancers.js',
  './js/supabase-bootstrap.js',
  './api-compound.js',
  // Si añades icons/, puedes incluirlos aquí también.
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Cachear de forma tolerante
      await Promise.allSettled(CORE.map(asset => fetch(asset, {cache:'no-cache'}).then(r => r.ok && cache.put(asset, r))));
    } finally {
      self.skipWaiting();
    }
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        const res = await fetch(e.request);
        const clone = res.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(e.request, clone);
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
  }
});
