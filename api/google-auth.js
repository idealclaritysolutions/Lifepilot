import { signState } from './_google-crypto.js'

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(500).json({ error: 'Google client ID not configured' })

  const userId = req.query.userId || 'anonymous'
  const redirectUri = `https://getlifepilot.app/api/google-callback`

  // v1 = Google Calendar ONLY (Gmail task-pulling is v2, so
  // gmail.readonly is deliberately NOT requested here).
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ')

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(signState(userId))}`

  res.redirect(302, authUrl)
}
