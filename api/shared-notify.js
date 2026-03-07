// Push notifications for shared list changes
// Called client-side after adding/removing/checking items
// In a future version this would be triggered by Supabase webhooks

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // For now, just acknowledge — real push notifications require storing push subscriptions
  // in the database per user, which we'll wire up when the subscription endpoint is ready
  const { action, itemText, listName, userId } = req.body || {}
  console.log(`[SHARED-LIST-NOTIFY] ${action}: "${itemText}" in "${listName}" by ${userId}`)

  return res.status(200).json({ ok: true, message: 'Notification logged' })
}
