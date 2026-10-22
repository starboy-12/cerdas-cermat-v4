const CACHE = 'cerdas-cermat-shell-v4';
const SHELL = [
  '/', '/index.html', '/styles.css', '/book-layout.css', '/storybook.css',
  '/reader-motion.css', '/config.js?v=2', '/app.js?v=3', '/manifest.webmanifest',
  '/assets/dana-qr.svg',
  '/assets/storybook/ATTRIBUTIONS.md', '/assets/storybook/animals-habitat.jpg',
  '/assets/storybook/alphabet-animals.png', '/assets/storybook/values-sharing.png',
  '/assets/storybook/history-scroll.jpg', '/assets/storybook/prophets-symbols.svg',
  '/assets/storybook/adam-garden.svg', '/assets/storybook/noah-ark.svg',
  '/assets/storybook/yusuf-story.svg', '/assets/storybook/musa-story.svg',
  '/assets/storybook/ibrahim-story.svg', '/assets/storybook/hijrah-map.svg',
  '/assets/storybook/madinah-welcome.svg', '/assets/storybook/first-revelation.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('cerdas-cermat-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put('/index.html', copy)); return response;
    }).catch(() => caches.match('/index.html')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); return response;
    })));
    return;
  }
  event.respondWith(fetch(request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request)));
});
