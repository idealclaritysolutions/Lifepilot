import { useEffect, useRef, useCallback } from 'react'
import type { LifeItem } from '@/App'
import { isNative } from '@/lib/native'

const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window
const hasSWSupport = typeof navigator !== 'undefined' && 'serviceWorker' in navigator

export function useNotifications() {
  const swRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!hasSWSupport) return
    
    navigator.serviceWorker.register('/sw.js').then(reg => {
      swRef.current = reg
    }).catch(err => console.warn('SW failed:', err))

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'COMPLETE_ITEM') {
        window.dispatchEvent(new CustomEvent('lifepilot-complete', { detail: { id: event.data.id } }))
      }
    })
  }, [])

  // On the native app the WebView's Notification API does not work —
  // permission must go through Capacitor's LocalNotifications. The
  // old web-only path always failed on native, which is why the
  // Settings toggle could never turn on even with the OS permission
  // allowed.
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isNative()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        const checked = await LocalNotifications.checkPermissions()
        if (checked.display === 'granted') return true
        const req = await LocalNotifications.requestPermissions()
        return req.display === 'granted'
      } catch {
        return false
      }
    }
    if (!hasNotificationSupport) return false
    try {
      if (Notification.permission === 'granted') return true
      const result = await Notification.requestPermission()
      return result === 'granted'
    } catch {
      return false
    }
  }, [])

  const sendNotification = useCallback((title: string, body: string, data?: any) => {
    if (isNative()) {
      // Fire-and-forget local notification on native (WebView
      // Notification is a no-op there, so this never delivered).
      import('@capacitor/local-notifications').then(({ LocalNotifications }) =>
        LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 2_000_000_000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) },
            extra: data || {},
          }],
        })
      ).catch(() => {})
      return true
    }
    const reg = swRef.current
    if (reg) {
      try {
        reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'lp-' + Date.now(),
          data: data || {},
        }).catch(() => {
          // Fallback
          try { if (hasNotificationSupport && Notification.permission === 'granted') new Notification(title, { body, icon: '/icon-192.png' }) } catch {}
        })
        return true
      } catch {}
    }
    
    try {
      if (hasNotificationSupport && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png' })
        return true
      }
    } catch {}
    return false
  }, [])

  const scheduleReminder = useCallback((item: LifeItem) => {
    if (!item.dueDate) return false
    const active = swRef.current?.active
    if (!active) return false
    
    try {
      const dueDate = new Date(item.dueDate + 'T09:00:00')
      const dayBefore = new Date(dueDate.getTime() - 16 * 3600000)
      
      if (dayBefore.getTime() > Date.now()) {
        active.postMessage({
          type: 'SCHEDULE_REMINDER',
          id: item.id + '-pre',
          text: `Heads up — "${item.text}" is due tomorrow!`,
          triggerAt: dayBefore.getTime(),
        })
      }
      
      if (dueDate.getTime() > Date.now()) {
        active.postMessage({
          type: 'SCHEDULE_REMINDER',
          id: item.id,
          text: item.text,
          triggerAt: dueDate.getTime(),
        })
      }
    } catch {}
    return true
  }, [])

  const cancelReminder = useCallback((itemId: string) => {
    try {
      const active = swRef.current?.active
      if (active) {
        active.postMessage({ type: 'CANCEL_REMINDER', id: itemId })
        active.postMessage({ type: 'CANCEL_REMINDER', id: itemId + '-pre' })
      }
    } catch {}
  }, [])

  return { requestPermission, sendNotification, scheduleReminder, cancelReminder }
}
