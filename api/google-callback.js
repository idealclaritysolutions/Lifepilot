import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { code, state: userId } = req.query
  if (!code) return res.redirect('/?google_error=no_code')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    console.error('[Google] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET env vars')
    return res.redirect('/?google_error=not_configured')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Google] Missing Supabase env vars')
    return res.redirect('/?google_error=db_error')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const redirectUri = `https://getlifepilot.app/api/google-callback`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    
    if (!tokens.access_token) {
      console.error('[Google] Token exchange failed:', JSON.stringify(tokens))
      return res.redirect('/?google_error=token_failed')
    }

    // Get user email
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    // Store tokens
    const { error } = await supabase.from('google_tokens').upsert({
      user_id: userId || 'anonymous',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      google_email: profile.email || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    
    if (error) console.error('[Google] DB save error:', error.message)

    console.log(`[Google] Connected for user ${userId}: ${profile.email}`)
    return res.redirect('/?google_connected=true')
  } catch (err) {
    console.error('[Google] Callback error:', err.message || err)
    return res.redirect('/?google_error=server_error')
  }
}
