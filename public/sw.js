// LifePilot Service Worker — Push notifications + scheduled reminders

const CACHE_NAME = 'lifepilot-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Restore any persisted reminders when SW activates
      restoreReminders()
    ])
  )
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

// IndexedDB for persistent reminder storage (survives SW termination)
const DB_NAME = 'lifepilot-sw'
const DB_VERSION = 1
const STORE_NAME = 'reminders'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

async function saveReminderToDB(id, text, triggerAt) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ id, text, triggerAt })
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('Failed to save reminder to IndexedDB:', e)
  }
}

async function deleteReminderFromDB(id) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('Failed to delete reminder from IndexedDB:', e)
  }
}

async function getAllRemindersFromDB() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error('Failed to get reminders from IndexedDB:', e)
    return []
  }
}

// In-memory timers (for active scheduling within this SW session)
const activeTimers = new Map()

function scheduleReminderTimer(id, text, triggerAt) {
  // Cancel existing timer for this id
  if (activeTimers.has(id)) clearTimeout(activeTimers.get(id))
  
  const delay = Math.max(0, triggerAt - Date.now())
  
  // Don't schedule timers for past events
  if (delay <= 0) {
    // Fire immediately if it's in the past but recent (within 5 min)
    if (triggerAt > Date.now() - 5 * 60 * 1000) {
      fireReminder(id, text)
    }
    deleteReminderFromDB(id)
    return
  }
  
  const timer = setTimeout(() => {
    fireReminder(id, text)
    activeTimers.delete(id)
    deleteReminderFromDB(id)
  }, delay)
  
  activeTimers.set(id, timer)
}

function fireReminder(id, text) {
  self.registration.showNotification('LifePilot', {
    body: text,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'reminder-' + id,
    requireInteraction: true,
    data: { itemId: id },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'done', title: 'Done' },
      { action: 'snooze', title: '1hr later' },
    ],
  })
}

async function scheduleReminder(id, text, triggerAt) {
  // Save to IndexedDB for persistence
  await saveReminderToDB(id, text, triggerAt)
  // Set up the in-memory timer for this session
  scheduleReminderTimer(id, text, triggerAt)
}

async function cancelReminder(id) {
  if (activeTimers.has(id)) {
    clearTimeout(activeTimers.get(id))
    activeTimers.delete(id)
  }
  await deleteReminderFromDB(id)
}

// Restore reminders from IndexedDB when SW activates
async function restoreReminders() {
  const reminders = await getAllRemindersFromDB()
  for (const reminder of reminders) {
    scheduleReminderTimer(reminder.id, reminder.text, reminder.triggerAt)
  }
}

// Push event (for future server-sent push notifications)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'LifePilot', body: 'Check your board!' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.data || {},
    })
  )
})
