import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'

const VAPID_PUBLIC_KEY = 'BPQLndj1vTD1lJaoXHuPUIqkhEJxfqgRayBrKIoswHIWRf5RNJdTeH79tk7AKNWGgVUxDgSmiaQbI5ePpXCjZuc'

export function usePushSubscribe(notificationsEnabled: boolean) {
  const { user } = useAuth()

  useEffect(() => {
    if (!notificationsEnabled || !user?.id) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'granted') return

    const subscribe = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        // Check if already subscribed
        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          // Re-send to server in case it was lost
          await fetch('/api/push-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, subscription: existing.toJSON() }),
          })
          return
        }
        
        // New subscription
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(
            atob(VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
          ),
        })
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, subscription: sub.toJSON() }),
        })
        console.log('[Push] Auto-subscribed to Web Push')
      } catch (err) {
        console.warn('[Push] Auto-subscribe failed:', err)
      }
    }

    // Delay to let SW fully register
    const t = setTimeout(subscribe, 5000)
    return () => clearTimeout(t)
  }, [notificationsEnabled, user?.id])
}
