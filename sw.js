// Firebase Messaging — background push (compat scripts önce gelmeli)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDQQ7GlZ0j6kR_FSTSN06RRGdxY5GMHrHs",
  authDomain:        "optionflow-ef59d.firebaseapp.com",
  projectId:         "optionflow-ef59d",
  storageBucket:     "optionflow-ef59d.firebasestorage.app",
  messagingSenderId: "977067075912",
  appId:             "1:977067075912:web:3732b70b3343fd4c906b7d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  var title = (payload.notification && payload.notification.title) || 'OptionFlow';
  var body  = (payload.notification && payload.notification.body)  || '';
  self.registration.showNotification(title, {
    body:    body,
    icon:    '/option-flow/icon-192.png',
    badge:   '/option-flow/icon-192.png',
    data:    payload.data || {},
    vibrate: [200, 100, 200]
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/option-flow/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes(self.location.origin) && 'focus' in list[i]) {
          list[i].navigate(url);
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Offline Cache ────────────────────────────────────────────────────────────
var CACHE     = 'optflow-v7';
var CDN_CACHE = 'optflow-cdn-v1';

var FIREBASE_API = [
  'firebaseio.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'fcm.googleapis.com',
  'firebase.googleapis.com'
];

var CDN_HOSTS = [
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

  // Firebase API çağrıları — asla cache'leme
  if (FIREBASE_API.some(function(h) { return url.hostname.endsWith(h); })) return;

  var isSameOrigin = url.origin === self.location.origin;
  var isCDN = CDN_HOSTS.indexOf(url.hostname) !== -1;

  if (!isSameOrigin && !isCDN) return;

  if (isCDN) {
    // CDN: cache-first
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
