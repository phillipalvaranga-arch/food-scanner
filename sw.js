const C = 'foodscan-v2';
const F = [
  './',
  'index.html',
  'style.css',
  'js/app.js',
  'js/rate.js',
  'js/ingredients.js',
  'vendor/html5-qrcode.min.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon.png',
  'icon.ico'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(F)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (/\.(png|ico|svg)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request)));
    return;
  }
  // network-first so updates show right away; saved copy when offline
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(C).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html')))
  );
});
