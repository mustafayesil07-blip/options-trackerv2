const CACHE = 'optflow-v5';

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Sadece index.html'i cache'le — hata olursa install başarısız olmasın
      return c.add('/option-flow/index.html').catch(function(){});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  // Dış domain isteklerini pas geç (Firebase, Vercel proxy vs.)
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      // Network-first: önce network, cache fallback
      return fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        // Offline: cache'den sun
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/option-flow/index.html');
        }
      });
    })
  );
});
