// Push subscription hook for web push notifications
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushSubscribe(userId?: string) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  // Check current subscription status on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.ready.then(async (registration) => {
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
      setIsSubscribed(!!sub)
    }).catch(() => {})
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported')
      return false
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('VAPID public key not configured')
      return false
    }

    setIsLoading(true)
    try {
      // Request notification permission first
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setIsLoading(false)
        return false
      }

      const registration = await navigator.serviceWorker.ready
      
      // Subscribe to push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      setSubscription(sub)
      setIsSubscribed(true)

      // Save subscription to database
      if (userId && supabase) {
        const subJson = sub.toJSON()
        await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          subscription: subJson,
          endpoint: subJson.endpoint,
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
      }

      setIsLoading(false)
      return true
    } catch (err) {
      console.error('Failed to subscribe to push:', err)
      setIsLoading(false)
      return false
    }
  }, [userId])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return true

    setIsLoading(true)
    try {
      await subscription.unsubscribe()
      setSubscription(null)
      setIsSubscribed(false)

      // Remove from database
      if (userId && supabase) {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId)
      }

      setIsLoading(false)
      return true
    } catch (err) {
      console.error('Failed to unsubscribe from push:', err)
      setIsLoading(false)
      return false
    }
  }, [subscription, userId])

  return {
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    subscription,
  }
}
