import { createClient } from '@supabase/supabase-js'

// Shared server-side admin auth for Life Pilot API routes.
// Leading underscore: Vercel does not route this file as an endpoint.
//
// Admin access is granted to signed-in Supabase users whose email is
// listed in the ADMIN_EMAILS env var (comma-separated). When ADMIN_EMAILS
// is unset/empty the list is empty and NO user is an admin (fail closed).

export function getServiceClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false
  const admins = getAdminEmails()
  if (admins.length === 0) return false
  return admins.includes(email.trim().toLowerCase())
}

// Verify the `Authorization: Bearer <token>` header against Supabase Auth.
// Returns the Supabase user object, or null when the header is missing,
// malformed, or the token does not verify. The Supabase client is
// injectable (optional second arg) so tests can stub auth.getUser().
export async function verifyUser(req, client) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization
  if (!authHeader || typeof authHeader !== 'string') return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1].trim()
  if (!token) return null

  const supabase = client || getServiceClient()
  if (!supabase || typeof supabase.auth?.getUser !== 'function') return null

  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error) return null
    return data?.user || null
  } catch {
    return null
  }
}

// Gate a handler behind admin auth. Returns the verified admin user, or
// writes the error response and returns null:
//   401 — no token / token did not verify
//   403 — signed in, but email is not in ADMIN_EMAILS
export async function requireAdmin(req, res, client) {
  const user = await verifyUser(req, client)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  if (!isAdminEmail(user.email)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return user
}
