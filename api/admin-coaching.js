import { getServiceClient, requireAdmin } from './_admin-auth.js'
import { shapeCoachingUser } from './_coaching-shape.js'

export default async function handler(req, res, injectedClient) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Admin auth: signed-in Supabase user whose email is in ADMIN_EMAILS.
  // (Replaces the old shared-secret key check.)
  const supabase = injectedClient || getServiceClient()
  const admin = await requireAdmin(req, res, supabase || undefined)
  if (!admin) return // requireAdmin already wrote the 401/403 response

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  try {
    // Fetch all user data
    const { data: allUsers, error } = await supabase
      .from('user_data')
      .select('user_id, app_state, updated_at')

    if (error) throw error

    // Filter to Guided (enterprise) tier users only
    const guidedUsers = (allUsers || [])
      .filter(u => u.app_state?.subscription?.tier === 'enterprise')
      .map(shapeCoachingUser)

    return res.status(200).json({ users: guidedUsers, count: guidedUsers.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
