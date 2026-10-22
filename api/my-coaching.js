import { getServiceClient, verifyUser } from './_admin-auth.js'
import { shapeCoachingUser } from './_coaching-shape.js'

// GET only. Any signed-in user; returns ONLY the caller's own coaching
// summary. Non-Guided users get just { isGuided: false, tier } — no other
// user data is ever exposed here, and no other user's row is ever read.
export default async function handler(req, res, injectedClient) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = injectedClient || getServiceClient()
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const user = await verifyUser(req, supabase)
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Load ONLY the caller's own row. Rows may be keyed by user_id or by
    // the legacy clerk_user_id, so match either — always scoped to the
    // verified user's id, never unscoped.
    const { data: row, error } = await supabase
      .from('user_data')
      .select('user_id, app_state, updated_at')
      .or(`user_id.eq.${user.id},clerk_user_id.eq.${user.id}`)
      .limit(1)
      .single()

    // PGRST116 = no rows returned by .single(): user has no row yet.
    if (error && error.code !== 'PGRST116') throw error

    if (!row) {
      return res.status(200).json({ isGuided: false, tier: 'free' })
    }

    const subscription = row.app_state?.subscription || {}
    const tier = subscription.tier || 'free'

    if (tier !== 'enterprise') {
      return res.status(200).json({ isGuided: false, tier })
    }

    const shaped = shapeCoachingUser(row)

    return res.status(200).json({
      isGuided: true,
      tier,
      name: shaped.name,
      subscription: {
        tier,
        activatedAt: subscription.activatedAt ?? null,
        expiresAt: subscription.expiresAt ?? null,
        promoCode: subscription.promoCode ?? null,
      },
      stats: shaped.stats,
      goals: shaped.goals,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
