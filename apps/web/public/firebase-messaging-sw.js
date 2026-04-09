// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAXSE0D1Pa2UV34lmz6V7aCxX8_WD3IMwc",
  authDomain: "taskflow-98484.firebaseapp.com",
  projectId: "taskflow-98484",
  storageBucket: "taskflow-98484.firebasestorage.app",
  messagingSenderId: "816380669467",
  appId: "1:816380669467:web:934516e878c748185292be",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'TaskFlow';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.data?.tag || 'default',
    data: payload.data,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const deepLink = event.notification.data?.deepLink || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            deepLink,
          });
          return;
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(deepLink);
      }
    })
  );
});
