const CACHE_VERSION = 'bingo-audio-v1';
const AUDIO_CACHE = `bingo-audio-runtime-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('bingo-audio-runtime-') && key !== AUDIO_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isAudioRequest(request) {
  const url = new URL(request.url);
  if (request.destination === 'audio') return true;
  return /\.(mp3|ogg)(\?|$)/i.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!isAudioRequest(event.request)) return;

  event.respondWith(
    caches.open(AUDIO_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: false });
      if (cached) return cached;

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (_) {
        if (cached) return cached;
        throw _;
      }
    }),
  );
});
