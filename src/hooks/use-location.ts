import { useState, useCallback } from 'react'
import { isNative } from '@/lib/native'

export interface UserLocation {
  latitude: number
  longitude: number
  city?: string
  state?: string
  country?: string
  timestamp: number
}

async function reverseGeocode(loc: UserLocation): Promise<UserLocation> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json&zoom=10`,
      { headers: { 'User-Agent': 'LifePilotAI/1.0' } }
    )
    if (res.ok) {
      const data = await res.json()
      loc.city = data.address?.city || data.address?.town || data.address?.village || ''
      loc.state = data.address?.state || ''
      loc.country = data.address?.country || ''
    }
  } catch {
    // Geocoding failed, but we still have coordinates
  }
  return loc
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(async (): Promise<UserLocation | null> => {
    setLoading(true)
    setError(null)

    // Native: the WebView geolocation prompt is unreliable (it can
    // fail even with the OS permission allowed), so use the
    // Capacitor Geolocation plugin's real OS permission flow.
    if (isNative()) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation')
        const perm = await Geolocation.checkPermissions()
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          const req = await Geolocation.requestPermissions()
          if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
            setError('permission-denied')
            setLoading(false)
            return null
          }
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })
        const loc = await reverseGeocode({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: Date.now(),
        })
        setLocation(loc)
        setLoading(false)
        return loc
      } catch {
        setError('unavailable')
        setLoading(false)
        return null
      }
    }

    if (!navigator.geolocation) {
      setError('unsupported')
      setLoading(false)
      return null
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const loc = await reverseGeocode({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
          })
          setLocation(loc)
          setLoading(false)
          resolve(loc)
        },
        (err) => {
          // Surface the KIND of failure so Settings can tell the
          // user exactly what to fix, instead of a generic toast.
          setError(err.code === 1 ? 'permission-denied' : err.code === 3 ? 'timeout' : 'unavailable')
          setLoading(false)
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      )
    })
  }, [])

  // Build a Google Maps search URL for nearby places
  const getNearbyUrl = useCallback((query: string) => {
    if (location) {
      return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${location.latitude},${location.longitude},14z`
    }
    return `https://www.google.com/maps/search/${encodeURIComponent(query + ' near me')}`
  }, [location])

  const getLocationString = useCallback(() => {
    if (!location) return 'unknown location'
    if (location.city) return `${location.city}, ${location.state || location.country || ''}`
    return `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`
  }, [location])

  return { location, loading, error, requestLocation, getNearbyUrl, getLocationString }
}
