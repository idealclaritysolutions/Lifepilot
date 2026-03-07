// In-memory event store (resets on cold start ~15 min inactivity)
// All events also logged to console (visible in Vercel Logs dashboard permanently)
const events = []

const ADMIN_KEY = process.env.ANALYTICS_ADMIN_KEY || 'lifepilot-admin-2026'

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // POST: log an event
  if (req.method === 'POST') {
    try {
      const event = req.body || {}
      event.timestamp = event.timestamp || new Date().toISOString()

      // Anonymize IP (strip last octet)
      const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '0.0.0.0').split(',')[0].trim()
      const parts = ip.split('.')
      event.anonIp = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.xxx` : 'unknown'

      // Device detection
      const ua = req.headers['user-agent'] || ''
      if (/iPhone|iPad/.test(ua)) event.device = 'iOS'
      else if (/Android/.test(ua)) event.device = 'Android'
      else if (/Macintosh/.test(ua)) event.device = 'Mac'
      else if (/Windows/.test(ua)) event.device = 'Windows'
      else event.device = 'Other'

      // Browser detection
      if (/Chrome/.test(ua) && !/Edg/.test(ua)) event.browser = 'Chrome'
      else if (/Safari/.test(ua) && !/Chrome/.test(ua)) event.browser = 'Safari'
      else if (/Firefox/.test(ua)) event.browser = 'Firefox'
      else if (/Edg/.test(ua)) event.browser = 'Edge'
      else event.browser = 'Other'

      events.push(event)
      // Keep max 10000 events in memory
      if (events.length > 10000) events.splice(0, events.length - 10000)

      // Log to Vercel console (permanent)
      console.log('[ANALYTICS]', JSON.stringify(event))

      return res.status(200).json({ ok: true })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to log event' })
    }
  }

  // GET: return aggregated stats (requires admin key)
  if (req.method === 'GET') {
    const key = req.query.key
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ error: 'Invalid admin key' })
    }

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Daily counts for last 14 days
    const dailyCounts = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dailyCounts[d.toISOString().split('T')[0]] = 0
    }

    const devices = {}
    const browsers = {}
    const tabUsage = {}
    const uniqueIps = new Set()
    let todayEvents = 0
    let weekEvents = 0
    const recentErrors = []

    events.forEach(e => {
      const day = (e.timestamp || '').substring(0, 10)
      if (dailyCounts.hasOwnProperty(day)) dailyCounts[day]++
      if (day === todayStr) todayEvents++
      if (new Date(e.timestamp) >= weekAgo) weekEvents++
      if (e.anonIp) uniqueIps.add(e.anonIp)
      if (e.device) devices[e.device] = (devices[e.device] || 0) + 1
      if (e.browser) browsers[e.browser] = (browsers[e.browser] || 0) + 1
      if (e.type === 'tab_view' && e.tab) tabUsage[e.tab] = (tabUsage[e.tab] || 0) + 1
      if (e.type === 'error') recentErrors.push(e)
    })

    return res.status(200).json({
      serverTime: now.toISOString(),
      totalEvents: events.length,
      uniqueUsers: uniqueIps.size,
      todayEvents,
      weekEvents,
      dailyCounts,
      devices,
      browsers,
      tabUsage,
      recentEvents: events.slice(-50).reverse(),
      recentErrors: recentErrors.slice(-20).reverse(),
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
