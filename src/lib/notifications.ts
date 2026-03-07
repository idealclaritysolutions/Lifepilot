// Push notification service — schedule reminders that work even when app is closed

let notificationPermission: NotificationPermission = 'default'
const scheduledTimers: Map<string, number> = new Map()

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  
  if (Notification.permission === 'granted') {
    notificationPermission = 'granted'
    return true
  }
  
  if (Notification.permission === 'denied') {
    notificationPermission = 'denied'
    return false
  }

  const result = await Notification.requestPermission()
  notificationPermission = result
  return result === 'granted'
}

export function getNotificationStatus(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

export function sendNotification(title: string, body: string, tag?: string): void {
  if (Notification.permission !== 'granted') return

  // If service worker is active, use it for better reliability
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      tag: tag || 'lifepilot-' + Date.now(),
    })
    return
  }

  // Fallback to direct notification
  new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: tag || 'lifepilot-' + Date.now(),
    requireInteraction: true,
  })
}

export function scheduleReminder(itemId: string, text: string, dueDate: string): void {
  // Cancel existing timer for this item
  cancelReminder(itemId)

  const due = new Date(dueDate)
  const now = new Date()

  // Schedule for the morning of the due date (8 AM)
  const reminderTime = new Date(due)
  reminderTime.setHours(8, 0, 0, 0)

  // Also schedule a day-before reminder at 7 PM
  const dayBefore = new Date(due)
  dayBefore.setDate(dayBefore.getDate() - 1)
  dayBefore.setHours(19, 0, 0, 0)

  const msUntilDayBefore = dayBefore.getTime() - now.getTime()
  const msUntilDueDay = reminderTime.getTime() - now.getTime()

  if (msUntilDayBefore > 0 && msUntilDayBefore < 7 * 24 * 3600000) {
    const timer = window.setTimeout(() => {
      sendNotification(
        '📋 LifePilot Reminder',
        `Tomorrow: ${text}`,
        `lifepilot-eve-${itemId}`
      )
    }, msUntilDayBefore)
    scheduledTimers.set(`${itemId}-eve`, timer)
  }

  if (msUntilDueDay > 0 && msUntilDueDay < 7 * 24 * 3600000) {
    const timer = window.setTimeout(() => {
      sendNotification(
        '⚡ LifePilot — Due Today!',
        text,
        `lifepilot-due-${itemId}`
      )
    }, msUntilDueDay)
    scheduledTimers.set(`${itemId}-due`, timer)
  }

  // If due within 2 hours, send an immediate heads up
  if (msUntilDueDay > 0 && msUntilDueDay < 2 * 3600000) {
    sendNotification(
      '⏰ Coming up soon!',
      text,
      `lifepilot-soon-${itemId}`
    )
  }
}

// Test function to trigger a nudge notification immediately
export async function testNudgeNotification(type: 'feature' | 'task' | 'journal' | 'habit'): Promise<boolean> {
  if (Notification.permission !== 'granted') {
    console.log('[v0] Notification permission not granted')
    return false
  }

  const messages: Record<string, { title: string; body: string }> = {
    feature: {
      title: 'LifePilot',
      body: "Got something on your mind? Talk to LifePilot — it's like texting your most organized friend."
    },
    task: {
      title: 'LifePilot',
      body: 'You\'ve got "Test Task" on your list. Even starting is progress — what\'s the first tiny step?'
    },
    journal: {
      title: 'LifePilot',
      body: "Your day had moments worth remembering. Take 60 seconds to write one down before it slips away."
    },
    habit: {
      title: 'LifePilot',
      body: "Your habits are waiting for today's check mark. One tap keeps your streak alive."
    }
  }

  const { title, body } = messages[type]
  const tag = `test-nudge-${type}-${Date.now()}`

  // Try service worker first
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      tag,
    })
    console.log('[v0] Test nudge sent via service worker:', type)
    return true
  }

  // Fallback to direct notification
  try {
    new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      requireInteraction: true,
    })
    console.log('[v0] Test nudge sent directly:', type)
    return true
  } catch (e) {
    console.error('[v0] Failed to send test nudge:', e)
    return false
  }
}

export function cancelReminder(itemId: string): void {
  const eveTimer = scheduledTimers.get(`${itemId}-eve`)
  const dueTimer = scheduledTimers.get(`${itemId}-due`)
  if (eveTimer) { clearTimeout(eveTimer); scheduledTimers.delete(`${itemId}-eve`) }
  if (dueTimer) { clearTimeout(dueTimer); scheduledTimers.delete(`${itemId}-due`) }
}

export function scheduleAllReminders(items: { id: string; text: string; dueDate?: string; status: string }[]): void {
  items.forEach(item => {
    if (item.dueDate && item.status === 'pending') {
      scheduleReminder(item.id, item.text, item.dueDate)
    }
  })
}
