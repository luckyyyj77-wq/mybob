const CACHE_NAME = 'mybob-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // 해시가 붙은 불변 빌드 자산: cache-first — 한 번 받으면 네트워크를 다시 타지 않는다
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // 페이지 문서: network-first, 성공 시 캐시 갱신, 오프라인이면 캐시 폴백
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((cached) => cached ?? new Response('', { status: 503 }))
        )
    );
  }
  // 그 외(RSC prefetch, public 자산 등)는 브라우저 기본 동작에 맡긴다
});
