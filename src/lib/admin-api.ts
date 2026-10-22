import { supabase } from '@/lib/supabase'

// ─── ADMIN / COACHING API CLIENT ─────────────────────────────────
//
// All three endpoints are authenticated with the signed-in user's
// Supabase access token (Authorization: Bearer <token>). The server
// verifies the token and enforces the admin allowlist
// (/api/analytics, /api/admin-coaching) or the caller's own Guided
// status (/api/my-coaching). No admin key is ever sent from the client.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function getAuthHeaders(): Promise<{ Authorization: string } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

async function authedFetch(path: string): Promise<any> {
  const headers = await getAuthHeaders()
  if (!headers) {
    throw new ApiError(401, 'Not signed in')
  }
  const res = await fetch(path, { headers })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {}
    throw new ApiError(res.status, message)
  }
  return res.json()
}

export async function fetchAdminAnalytics(): Promise<any> {
  return authedFetch('/api/analytics')
}

export async function fetchAdminCoaching(): Promise<any> {
  return authedFetch('/api/admin-coaching')
}

export async function fetchMyCoaching(): Promise<any> {
  return authedFetch('/api/my-coaching')
}
