import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

async function getValidToken(userId) {
  const { data } = await supabase.from('google_tokens').select('*').eq('user_id', userId).single()
  if (!data) return null

  // Check if token is expired
  if (new Date(data.expires_at) < new Date()) {
    // Refresh token
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
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    return newTokens.access_token
  }
  return data.access_token
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const userId = req.query.userId || req.body?.userId
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const token = await getValidToken(userId)
  if (!token) return res.status(401).json({ error: 'Google not connected', needsAuth: true })

  try {
    if (req.method === 'GET') {
      // Fetch upcoming events
      const now = new Date().toISOString()
      const maxDate = new Date(Date.now() + 7 * 86400000).toISOString()
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(maxDate)}&maxResults=20&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const calData = await calRes.json()
      const events = (calData.items || []).map(e => ({
        id: e.id,
        title: e.summary || 'No title',
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location,
        description: e.description?.substring(0, 200),
        allDay: !!e.start?.date,
      }))
      return res.status(200).json({ events })
    }

    if (req.method === 'POST') {
      // Create a new event
      const { title, date, startTime, endTime, description, location } = req.body
      if (!title) return res.status(400).json({ error: 'Missing event title' })

      let eventBody = { summary: title }
      if (description) eventBody.description = description
      if (location) eventBody.location = location

      if (startTime && date) {
        // Timed event
        const tz = req.body.timezone || 'America/New_York'
        eventBody.start = { dateTime: `${date}T${startTime}:00`, timeZone: tz }
        eventBody.end = { dateTime: `${date}T${endTime || startTime.replace(/(\d+):/, (_, h) => `${(parseInt(h) + 1) % 24}:`)}:00`, timeZone: tz }
      } else if (date) {
        // All-day event
        eventBody.start = { date }
        const nextDay = new Date(date + 'T12:00:00')
        nextDay.setDate(nextDay.getDate() + 1)
        eventBody.end = { date: nextDay.toISOString().split('T')[0] }
      } else {
        return res.status(400).json({ error: 'Missing date' })
      }

      const createRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(eventBody),
        }
      )
      const created = await createRes.json()
      return res.status(200).json({ event: { id: created.id, title: created.summary, start: created.start?.dateTime || created.start?.date } })
    }
  } catch (err) {
    console.error('[Calendar] Error:', err.message)
    return res.status(500).json({ error: 'Calendar API error' })
  }
}
