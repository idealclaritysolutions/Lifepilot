// ─── ADMIN VISIBILITY GATE (CLIENT SIDE ONLY) ────────────────────
//
// This module controls NAV VISIBILITY ONLY: it decides whether the
// signed-in user *sees* the "Admin" entry in the header menu.
//
// It is NOT a security boundary. The real enforcement happens on the
// server: /api/analytics and /api/admin-coaching verify the caller's
// Supabase bearer token against the server-side ADMIN_EMAILS allowlist
// and return 401/403 for anyone who is not the owner. A user who
// tampers with this client check would only reveal a menu entry whose
// API calls then fail.
//
// Configure via the VITE_ADMIN_EMAILS env var (comma-separated).
// Empty / unset = nobody sees Admin.

const rawAdminEmails: string = import.meta.env.VITE_ADMIN_EMAILS || ''

export const ADMIN_EMAILS: string[] = rawAdminEmails
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter((e: string) => e.length > 0)

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  if (ADMIN_EMAILS.length === 0) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
