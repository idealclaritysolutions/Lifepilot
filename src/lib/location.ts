// Location service — get user's position and find nearby places

export interface UserLocation {
  latitude: number
  longitude: number
  city?: string
  region?: string
}

let cachedLocation: UserLocation | null = null

export async function getUserLocation(): Promise<UserLocation | null> {
  if (cachedLocation) return cachedLocation

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc: UserLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }
        // Try reverse geocoding for city name
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json&addressdetails=1`,
            { headers: { 'User-Agent': 'LifePilotAI/1.0' } }
          )
          if (res.ok) {
            const data = await res.json()
            loc.city = data.address?.city || data.address?.town || data.address?.village || ''
            loc.region = data.address?.state || ''
          }
        } catch {}
        cachedLocation = loc
        resolve(loc)
      },
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: false }
    )
  })
}

export function getGoogleMapsSearchUrl(query: string, location?: UserLocation | null): string {
  const q = encodeURIComponent(query)
  if (location) {
    return `https://www.google.com/maps/search/${q}/@${location.latitude},${location.longitude},14z`
  }
  return `https://www.google.com/maps/search/${q}`
}

export function getGoogleMapsDirectionsUrl(destination: string, location?: UserLocation | null): string {
  const dest = encodeURIComponent(destination)
  if (location) {
    return `https://www.google.com/maps/dir/${location.latitude},${location.longitude}/${dest}`
  }
  return `https://www.google.com/maps/dir//${dest}`
}
