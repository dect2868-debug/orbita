// ORBITA — офлайн-режим (PWA): сайт открывается даже без интернета.
// Стратегия «сеть в приоритете, кэш как запасной вариант» —
// данные всегда свежие, а кэш спасает при пропаже связи.
const CACHE = 'orbita-v8';
const PRE = [
  './',
  'index.html',
  'schedule.html',
  'support.html',
  'news.html',
  'style.css',
  'layout.js',
  'auth.js',
  'script.js',
  'assets/hero-poster.jpg',
  'assets/hero-loop.mp4',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(PRE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // API-запросы не трогаем
  if (req.url.includes('/api/')) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(m => m || caches.match('index.html'))
      )
  );
});
