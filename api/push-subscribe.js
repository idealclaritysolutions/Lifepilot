import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, subscription } = req.body
  if (!userId || !subscription) return res.status(400).json({ error: 'Missing userId or subscription' })

  try {
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      subscription,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    
    if (error) {
      console.error('[Push] Save error:', error.message)
      return res.status(500).json({ error: 'Failed to save subscription' })
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[Push] Exception:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
}
