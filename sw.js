/* Manna service worker: app works offline; Bible books cached; daily readings fetched fresh when online. */
const VERSION = 'manna-v2';
const SHELL = ['./', 'index.html', 'app.js', 'search-worker.js', 'manifest.webmanifest', 'data/books.json', 'data/year.json', 'data/vmap.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const BIBLE = 'manna-bible-v1';
const DAYS = 'manna-days';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith('manna-v') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const path = url.pathname;
  if (/\/data\/(cpdv|drc)\/\d+\.json$/.test(path)) { e.respondWith(cacheFirst(e.request, BIBLE)); return; }
  if (/\/days\//.test(path)) { e.respondWith(networkFirst(e.request, DAYS)); return; }
  e.respondWith(staleWhileRevalidate(e.request, VERSION));
});

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}
async function networkFirst(req, name) {
  const c = await caches.open(name);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    const hit = await c.match(req, { ignoreSearch: true });
    return hit || new Response('{}', { status: 504, headers: { 'Content-Type': 'application/json' } });
  }
}
async function staleWhileRevalidate(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || new Response('Offline', { status: 503 });
}

/* Save a whole Bible version for offline use, one book at a time. */
let downloading = {};
self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type !== 'download' || downloading[m.trans]) return;
  downloading[m.trans] = true;
  e.waitUntil((async () => {
    const c = await caches.open(BIBLE);
    let done = 0, ok = true;
    for (let i = 0; i < m.total; i++) {
      const url = new URL(`data/${m.trans}/${i}.json`, self.registration.scope).href;
      try {
        if (!(await c.match(url))) {
          const res = await fetch(url);
          if (!res.ok) throw 0;
          await c.put(url, res);
        }
        done++;
      } catch { ok = false; }
      if (i % 5 === 4 || i === m.total - 1) broadcast({ type: 'dl-progress', trans: m.trans, done });
    }
    broadcast({ type: 'dl-done', trans: m.trans, done, ok });
    downloading[m.trans] = false;
  })());
});
async function broadcast(msg) {
  for (const cl of await self.clients.matchAll({ includeUncontrolled: true })) cl.postMessage(msg);
}
