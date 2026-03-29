const CACHE     = 'optflow-v6';
const CDN_CACHE = 'optflow-cdn-v1';

// Firebase API çağrıları — asla cache'leme
const FIREBASE_API = [
  'firebaseio.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'fcm.googleapis.com',
  'firebase.googleapis.com'
];

// Cache'lenecek CDN domain'leri (statik JS/CSS/font)
const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.add('/option-flow/index.html').catch(function(){});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE && k !== CDN_CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);

  // Firebase API çağrıları — service worker'dan geç
  if (FIREBASE_API.some(function(h) { return url.hostname.endsWith(h); })) return;

  var isSameOrigin = url.origin === self.location.origin;
  var isCDN = CDN_HOSTS.indexOf(url.hostname) !== -1;

  // Tanımadığımız dış domain — pas geç
  if (!isSameOrigin && !isCDN) return;

  if (isCDN) {
    // CDN: cache-first (dosyalar nadiren değişir)
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CDN_CACHE).then(function(c) { c.put(e.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // Same-origin: network-first, offline'da cache fallback
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/option-flow/index.html');
        }
      });
    })
  );
});
