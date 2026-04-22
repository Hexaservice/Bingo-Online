const CACHE_VERSION = 'v3';
const APP_SHELL_CACHE = `bingo-app-shell-${CACHE_VERSION}`;
const AUDIO_CACHE = `bingo-audio-runtime-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/css/desktopFrame.css',
  '/img/Logo-BingOnline-nuevo500p.png',
  '/img/apple-touch-icon.png',
  '/img/android-chrome-192x192.png',
  '/img/android-chrome-512x512.png',
  '/img/favicon.ico',
  '/img/favicon-16x16.ico',
  '/img/favicon-32x32.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith('bingo-app-shell-') && key !== APP_SHELL_CACHE) ||
                (key.startsWith('bingo-audio-runtime-') && key !== AUDIO_CACHE),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAudioRequest(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/sonidos/')) return false;
  if (request.destination === 'audio') return true;
  return /\.wav(\?|$)/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(APP_SHELL_CACHE);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(APP_SHELL_CACHE);
          return (await cache.match(event.request)) || (await cache.match('/index.html'));
        }),
    );
    return;
  }

  if (!isAudioRequest(event.request)) return;

  event.respondWith(
    caches.open(AUDIO_CACHE).then(async (cache) => {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (_) {
        const cached = await cache.match(event.request, { ignoreSearch: false });
        if (cached) return cached;
        throw _;
      }
    }),
  );
});
