import crypto from 'node:crypto'

// Shared helpers for the Google Calendar endpoints (v1: Calendar only).
//
// SECURITY NOTES (fixed for the v1 launch):
// - Refresh/access tokens are stored AES-256-GCM encrypted, never in
//   plaintext. The key is derived from GOOGLE_TOKEN_KEY when set,
//   otherwise from the server-only SUPABASE_SERVICE_KEY. No token
//   material ever leaves the server except to Google itself.
// - The OAuth `state` parameter is HMAC-signed with the same key and
//   expires after 10 minutes. The old code passed the raw userId as
//   state, which would have let anyone connect their own Google
//   account to someone else's Life Pilot account.

function getKey() {
  const secret = process.env.GOOGLE_TOKEN_KEY || process.env.SUPABASE_SERVICE_KEY || 'dev-only-fallback'
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptToken(plain) {
  if (!plain) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptToken(stored) {
  if (!stored) return null
  try {
    const buf = Buffer.from(stored, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const enc = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function signState(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId, t: Date.now() })).toString('base64url')
  const sig = crypto.createHmac('sha256', getKey()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyState(state) {
  try {
    const [payload, sig] = state.split('.')
    if (!payload || !sig) return null
    const expect = crypto.createHmac('sha256', getKey()).update(payload).digest('base64url')
    if (sig !== expect) return null
    const { u, t } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!u || Date.now() - t > 10 * 60 * 1000) return null
    return u
  } catch {
    return null
  }
}
