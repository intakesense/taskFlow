// TaskFlow Service Worker
// Minimal SW for PWA installability and push notifications
// No caching - this is a real-time chat app

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    tag: data.tag || 'taskflow-notification',
    renotify: true,
    data: {
      url: data.url || '/',
    },
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'TaskFlow', options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
