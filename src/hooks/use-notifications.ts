import { useEffect, useRef, useCallback } from 'react'
import type { LifeItem } from '@/App'

const hasNotificationSupport = typeof window !== 'undefined' && 'Notification' in window
const hasSWSupport = typeof navigator !== 'undefined' && 'serviceWorker' in navigator

export function useNotifications() {
  const swRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    console.log('[v0] useNotifications init, hasSWSupport:', hasSWSupport)
    if (!hasSWSupport) return
    
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[v0] Service worker registered successfully:', reg)
      swRef.current = reg
    }).catch(err => console.error('[v0] SW registration failed:', err))

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'COMPLETE_ITEM') {
        window.dispatchEvent(new CustomEvent('lifepilot-complete', { detail: { id: event.data.id } }))
      }
    })
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[v0] requestPermission called, hasNotificationSupport:', hasNotificationSupport)
    if (!hasNotificationSupport) {
      console.log('[v0] No notification support in this browser')
      return false
    }
    try {
      console.log('[v0] Current Notification.permission:', Notification.permission)
      if (Notification.permission === 'granted') {
        console.log('[v0] Already granted')
        return true
      }
      if (Notification.permission === 'denied') {
        console.log('[v0] Permission was previously denied by user')
        return false
      }
      console.log('[v0] Requesting permission...')
      const result = await Notification.requestPermission()
      console.log('[v0] Permission result:', result)
      return result === 'granted'
    } catch (err) {
      console.error('[v0] Error requesting permission:', err)
      return false
    }
  }, [])

  const sendNotification = useCallback((title: string, body: string, data?: any) => {
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
