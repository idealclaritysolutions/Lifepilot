import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function getValidToken(userId) {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: data.refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    })
    const newTokens = await refreshRes.json()
    if (!newTokens.access_token) return null
    await supabase.from('google_tokens').update({
      access_token: newTokens.access_token,
      expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
    }).eq('user_id', userId)
    return newTokens.access_token
  }
  return data.access_token
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const userId = req.query.userId
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const token = await getValidToken(userId)
  if (!token) return res.status(401).json({ error: 'Google not connected', needsAuth: true })

  try {
    const query = req.query.q || 'is:unread'
    const maxResults = Math.min(parseInt(req.query.max) || 10, 20)

    // List messages
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listData = await listRes.json()
    if (!listData.messages || listData.messages.length === 0) {
      return res.status(200).json({ emails: [], total: 0 })
    }

    // Fetch details for each message (batch headers only)
    const emails = await Promise.all(
      listData.messages.slice(0, maxResults).map(async (msg) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const msgData = await msgRes.json()
        const headers = msgData.payload?.headers || []
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader('From'),
          subject: getHeader('Subject'),
          date: getHeader('Date'),
          snippet: msgData.snippet?.substring(0, 150),
          isUnread: (msgData.labelIds || []).includes('UNREAD'),
        }
      })
    )

    return res.status(200).json({
      emails,
      total: listData.resultSizeEstimate || emails.length,
    })
  } catch (err) {
    console.error('[Gmail] Error:', err.message)
    return res.status(500).json({ error: 'Gmail API error' })
  }
}
