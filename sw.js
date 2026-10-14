/* Manna service worker: app works offline; Bible books cached; daily readings fetched fresh when online. */
const VERSION = 'manna-v7';
const SHELL = ['./', 'index.html', 'app.js', 'search-worker.js', 'manifest.webmanifest', 'data/books.json', 'data/year.json', 'data/vmap.json', 'data/prayers.json', 'armory.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const BIBLE = 'manna-bible-v1';
const DAYS = 'manna-days';
const STUDY = 'manna-study-v1';

self.addEventListener('install', e => {
  // Fetch fresh copies (bypass the browser's short-term cache). Wait for the user to tap "Update" before switching.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith('manna-v') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data && e.data.type === 'skip-waiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const path = url.pathname;
  if (/\/data\/(cpdv|drc)\/\d+\.json$/.test(path)) { e.respondWith(cacheFirst(e.request, BIBLE)); return; }
  if (/\/data\/(xref|catena)\/\d+\.json$/.test(path)) { e.respondWith(cacheFirst(e.request, STUDY)); return; }
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

/* Save a list of files for offline use, one at a time (keeps memory low). */
let downloading = {};
self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.type !== 'download' || !m.urls || downloading[m.key]) return;
  downloading[m.key] = true;
  e.waitUntil((async () => {
    const c = await caches.open(m.cache || BIBLE);
    let done = 0, ok = true;
    for (let i = 0; i < m.urls.length; i++) {
      const url = new URL(m.urls[i], self.registration.scope).href;
      try {
        if (!(await c.match(url))) {
          const res = await fetch(url);
          if (!res.ok) throw 0;
          await c.put(url, res);
        }
        done++;
      } catch { ok = false; }
      if (i % 5 === 4 || i === m.urls.length - 1) broadcast({ type: 'dl-progress', key: m.key, done });
    }
    broadcast({ type: 'dl-done', key: m.key, done, ok });
    downloading[m.key] = false;
  })());
});
async function broadcast(msg) {
  for (const cl of await self.clients.matchAll({ includeUncontrolled: true })) cl.postMessage(msg);
}
