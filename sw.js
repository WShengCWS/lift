/* LIFT service worker: a real file (the old app built it from a blob: URL, which browsers reject).
   Serves the app shell from cache so LIFT opens with no signal; refreshes the cache in the background.
   Bump VERSION whenever any shell file changes. */
const VERSION = 'lift-2.3.1-1';
const SHELL = [
  './', 'index.html', 'app.css', 'unslop.css', 'motion.css', 'theme.css', 'manifest.webmanifest',
  'data/exercises.js', 'js/lift.js', 'js/store.js', 'js/ui-core.js', 'js/ui-log.js', 'js/ui-views.js', 'js/unslop.js', 'js/motion.js',
  'fonts/manrope.woff2', 'fonts/instrument-serif.woff2', 'fonts/instrument-serif-italic.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('lift-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* later: /api/* (Cloudflare sync) always goes to the network */
  if (url.pathname.includes('/api/')) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(caches.open(VERSION).then(async cache => {
    const key = isPage ? 'index.html' : req;
    const hit = await cache.match(key, {ignoreSearch: isPage});
    const net = fetch(req).then(res => { if (res.ok && res.type === 'basic') cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response('Offline and not cached yet.', {status: 503, headers: {'Content-Type': 'text/plain'}});
  }));
});
