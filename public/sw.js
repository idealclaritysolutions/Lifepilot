// Life Pilot AI Service Worker — Push notifications + scheduled reminders

const CACHE_NAME = 'lifepilot-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: event.data.tag || 'lifepilot-' + Date.now(),
      requireInteraction: event.data.persistent || false,
      data: event.data.data || {},
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'done', title: 'Done ✓' },
        { action: 'snooze', title: 'Later' },
      ],
    })
  }

  if (event.data.type === 'SCHEDULE_REMINDER') {
    // Store the reminder in IndexedDB for the timer to pick up
    const { id, text, triggerAt } = event.data
    scheduleReminder(id, text, triggerAt)
  }

  if (event.data.type === 'CANCEL_REMINDER') {
    cancelReminder(event.data.id)
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  const action = event.action
  const data = event.notification.data || {}
  event.notification.close()

  if (action === 'done' && data.itemId) {
    // Notify the app to mark item as done
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        for (const client of clientList) {
          client.postMessage({ type: 'COMPLETE_ITEM', id: data.itemId })
        }
      })
    )
  } else if (action === 'snooze' && data.itemId) {
    // Reschedule notification for 1 hour later
    const later = Date.now() + 3600000
    scheduleReminder(data.itemId, event.notification.body, later)
  } else {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        return clients.openWindow('/')
      })
    )
  }
})

// Simple in-memory reminder store (service workers can be killed, so we also use setTimeout)
const reminders = new Map()

function scheduleReminder(id, text, triggerAt) {
  // Cancel existing reminder for this id
  if (reminders.has(id)) clearTimeout(reminders.get(id))
  
  const delay = Math.max(0, triggerAt - Date.now())
  const timer = setTimeout(() => {
    self.registration.showNotification('⏰ Life Pilot AI', {
      body: text,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'reminder-' + id,
      requireInteraction: true,
      data: { itemId: id },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'done', title: 'Done ✓' },
        { action: 'snooze', title: '1hr later' },
      ],
    })
    reminders.delete(id)
  }, delay)
  
  reminders.set(id, timer)
}

function cancelReminder(id) {
  if (reminders.has(id)) {
    clearTimeout(reminders.get(id))
    reminders.delete(id)
  }
}

// Web Push event — fires even when app is completely closed
self.addEventListener('push', (event) => {
  let data = { title: 'Life Pilot AI ✦', body: 'You have a new notification', data: {} }
  try {
    if (event.data) data = event.data.json()
  } catch {}
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Life Pilot AI ✦', {
      body: data.body || 'Tap to open Life Pilot AI',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: data.tag || 'lifepilot-nudge',
      requireInteraction: false,
      data: data.data || { url: '/' },
      actions: [
        { action: 'open', title: 'Open' },
      ],
    })
  )
})
