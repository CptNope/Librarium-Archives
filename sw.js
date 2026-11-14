/* The Archives offline. Everything the hall needs is kept in the browser the first time it loads; after
 * that the hall opens with no connection. Pages are fetched fresh when the network is there (so an update
 * shows at once) and from the cache when it is not; everything else comes from the cache and is refreshed
 * behind the scenes. The Pages workflow writes the release number in place of __VERSION__. */
const CACHE = 'librarium-archives-__VERSION__';
const CORE = ['./', 'index.html', 'css/archives.css', 'js/rules.js', 'js/archives.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('librarium-archives-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === location.origin, fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname), three = url.hostname === 'cdnjs.cloudflare.com';
  if (!ours && !fonts && !three) return;
  if (req.mode === 'navigate') { // the page: fresh if possible
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    const fresh = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || fresh;
  }));
});
