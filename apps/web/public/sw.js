// TaskFlow Service Worker v2
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
  
  // Build notification options
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    tag: data.tag || `conversation-${data.data?.conversation_id || 'default'}`,
    renotify: true,
    data: {
      url: data.url || '/',
      conversation_id: data.data?.conversation_id,
      message_id: data.data?.message_id,
    },
    // Action buttons - "Mark as Read" only (click opens chat)
    actions: data.data?.conversation_id ? [
      {
        action: 'mark-read',
        title: 'Mark as Read',
        icon: '/icons/icon-192x192.png'
      }
    ] : []
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'TaskFlow', options)
  )
})

// Notification click event - opens the chat
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data
  const action = event.action

  // Handle "Mark as Read" action button click
  if (action === 'mark-read' && data?.conversation_id) {
    event.waitUntil(
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: data.conversation_id }),
        credentials: 'include'
      }).catch(() => {
        // Silently fail - user can mark as read when they open the app
      })
    )
    return
  }

  // Default: open the chat (clicking on notification body)
  const url = data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
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
