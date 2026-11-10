/* GreyTraining service worker — offline-first.
   App files are precached and fetched network-first, so updates arrive on the next launch.
   Fonts, icons and libraries from the CDNs are cached on first use.
   Bump VERSION when the file list below changes. */
var VERSION = 'gt-v2';
var APP = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/data.js', './js/store.js', './js/cloud.js', './js/ui.js', './js/app.js',
  './js/screens/oggi.js', './js/screens/allena.js', './js/screens/gym-views.js', './js/screens/session.js',
  './js/screens/nutri.js', './js/screens/prog.js', './js/screens/coach-profile.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
var CDN = [
  'https://unpkg.com/htm@3.1.1/preact/standalone.umd.js',
  'https://unpkg.com/@phosphor-icons/web@2.1.1',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(APP).then(function () {
      // CDN files are best effort: a failure here must not block the install.
      return Promise.all(CDN.map(function (u) { return c.add(new Request(u, { mode: 'cors' })).catch(function () {}); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Server functions (Vercel): always live, never cached.
  if (url.origin === self.location.origin && /\/api\//.test(url.pathname)) return;

  // Page navigations: network first so updates arrive, cached shell when offline.
  // Only a good response for the app's own page replaces the cached shell.
  if (req.mode === 'navigate') {
    var scopePath = new URL('./', self.location).pathname;
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && !res.redirected && url.origin === self.location.origin && (url.pathname === scopePath || /\/index\.html$/.test(url.pathname))) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
      }
      return res;
    }).catch(function () { return caches.match('./index.html'); }));
    return;
  }

  // App files: network first so a new version shows up on the next launch, cache when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
    return;
  }

  // CDN libraries, fonts and icon fonts are versioned and immutable: cache first, then network.
  // (Supabase API calls go to *.supabase.co and are never cached.)
  if (!/(^|\.)unpkg\.com$|^cdn\.jsdelivr\.net$|fonts\.googleapis\.com$|fonts\.gstatic\.com$/.test(url.hostname)) return;
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
    return hit || net;
  }));
});
