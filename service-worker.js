// Service Worker seguro (solo http(s) + GET) con fallback offline
const CACHE = 'planazoo-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // 0) Ignora todo lo que no sea http(s) (evita chrome-extension://, data:, etc.)
  if (!req.url.startsWith('http')) return;

  // 1) Navegación: network-first con fallback a index.html cacheado
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        return net;
      } catch {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        // último recurso: intenta lo que haya en cache para la URL
        const any = await caches.match(req);
        if (any) return any;
        throw new Error('Offline y sin APP_SHELL en cache');
      }
    })());
    return;
  }

  // 2) Solo GET (nunca HEAD/POST/etc.)
  if (req.method !== 'GET') {
    e.respondWith(fetch(req));
    return;
  }

  // 3) Cache-first con actualización en segundo plano, pero solo para http(s) y respuestas válidas
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const net = await fetch(req);

      // No cachees respuestas opacas o no-OK
      if (net && net.ok && net.type === 'basic' && req.url.startsWith(self.location.origin)) {
        const copy = net.clone();
        const c = await caches.open(CACHE);
        try {
          await c.put(req, copy);
        } catch (err) {
          // Ignora fallos de put (por ejemplo, si el req no es cachéable)
          // console.warn('[SW] cache.put fallo', err);
        }
      }
      return net;
    } catch {
      // Fallback: devuelve lo que haya cacheado si existe
      if (cached) return cached;
      throw;
    }
  })());
});
