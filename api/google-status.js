import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const userId = req.query.userId
  if (!userId) return res.status(200).json({ connected: false })

  const { data } = await supabase.from('google_tokens').select('google_email, updated_at').eq('user_id', userId).single()
  return res.status(200).json({
    connected: !!data,
    email: data?.google_email || null,
    connectedAt: data?.updated_at || null,
  })
}
