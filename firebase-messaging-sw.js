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

// Uygulama kapalıyken gelen bildirimler
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'OptionFlow', {
    body:    body ?? '',
    icon:    icon ?? '/icon-192.png',
    badge:        '/icon-192.png',
    data:         payload.data ?? {},
    vibrate:      [200, 100, 200]
  });
});

// Bildirime tıklanınca uygulamayı aç
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
