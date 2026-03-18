import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  // Revoke the token
  const { data } = await supabase.from('google_tokens').select('access_token').eq('user_id', userId).single()
  if (data?.access_token) {
    try { await fetch(`https://oauth2.googleapis.com/revoke?token=${data.access_token}`, { method: 'POST' }) } catch {}
  }

  await supabase.from('google_tokens').delete().eq('user_id', userId)
  return res.status(200).json({ disconnected: true })
}
