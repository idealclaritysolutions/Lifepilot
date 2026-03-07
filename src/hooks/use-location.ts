import { useState, useCallback } from 'react'

export interface UserLocation {
  latitude: number
  longitude: number
  city?: string
  state?: string
  country?: string
  timestamp: number
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(async (): Promise<UserLocation | null> => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return null
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const loc: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
          }

          // Reverse geocode to get city name (free API)
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json&zoom=10`,
              { headers: { 'User-Agent': 'LifePilot/1.0' } }
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

          setLocation(loc)
          setLoading(false)
          resolve(loc)
        },
        (err) => {
          setError(err.message)
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
