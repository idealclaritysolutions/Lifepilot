import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

const GENERIC_NUDGES = [
  "Got something on your mind? Talk to Life Pilot AI — your most organized friend.",
  "Need to plan a meal, buy something, or set a reminder? Life Pilot AI handles it in seconds.",
  "The people who know themselves best are the ones who write things down. 60 seconds is all it takes.",
  "Three things. Just focus on three things today. Open your board and pick them.",
  "Your future self will thank you for writing today. What's one thing worth saving?",
]

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// Build ALL applicable nudges for a user, not just one
function buildAllNudges(appState) {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const today = now.toDateString()
  const name = appState?.profile?.name || 'there'
  const nudges = []

  // 1. Overdue tasks
  const overdueTasks = (appState?.items || []).filter(i =>
    i.status === 'pending' && i.dueDate && new Date(i.dueDate) < new Date(todayStr)
  )
  if (overdueTasks.length > 0) {
    const task = overdueTasks[0]
    nudges.push({
      id: 'overdue',
      title: '⚠️ Overdue Task',
      body: `Hey ${name}, "${task.text}" was due ${task.dueDate}. Want to tackle it today or reschedule?`,
    })
  }

  // 2. Tasks due today
  const todayTasks = (appState?.items || []).filter(i =>
    i.status === 'pending' && i.dueDate === todayStr
  )
  if (todayTasks.length > 0) {
    nudges.push({
      id: 'due-today',
      title: '📋 Due Today',
      body: `${name}, you have ${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today: "${todayTasks[0].text}"${todayTasks.length > 1 ? ` and ${todayTasks.length - 1} more` : ''}`,
    })
  }

  // 3. Unchecked habits
  const habits = appState?.habits || []
  if (habits.length > 0) {
    const unchecked = habits.filter(h => !h.completions.includes(todayStr))
    if (unchecked.length > 0) {
      nudges.push({
        id: 'habits',
        title: '🎯 Habits Waiting',
        body: `${name}, ${unchecked.length} habit${unchecked.length > 1 ? 's' : ''} left today: ${unchecked.slice(0, 2).map(h => h.emoji + ' ' + h.name).join(', ')}${unchecked.length > 2 ? '...' : ''}`,
      })
    }
  }

  // 4. Pending tasks (general)
  const pendingTasks = (appState?.items || []).filter(i => i.status === 'pending')
  if (pendingTasks.length > 0) {
    const task = pick(pendingTasks)
    nudges.push({
      id: 'pending',
      title: '📋 Life Pilot AI',
      body: `"${task.text}" is still on your board, ${name}. Even starting is progress!`,
    })
  }

  // 5. No journal entry today (afternoon/evening)
  const todayJournal = (appState?.journal || []).filter(e => new Date(e.createdAt).toDateString() === today)
  if (todayJournal.length === 0) {
    nudges.push({
      id: 'journal',
      title: '📓 Journal Reminder',
      body: `${name}, your day had moments worth remembering. Take 60 seconds to write one down.`,
    })
  }

  // 6. People/birthday coming up
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const upcoming = (appState?.people || []).flatMap(p =>
    (p.events || []).filter(e => {
      if (!e.date) return false
      const [mm, dd] = e.date.split('-').map(Number)
      const eventDate = new Date(now.getFullYear(), mm - 1, dd)
      const diffDays = Math.round((eventDate - todayMidnight) / 86400000)
      return diffDays >= 0 && diffDays <= 3
    }).map(e => {
      const [mm, dd] = e.date.split('-').map(Number)
      const eventDate = new Date(now.getFullYear(), mm - 1, dd)
      const diffDays = Math.round((eventDate - todayMidnight) / 86400000)
      return { ...e, personName: p.name, diffDays }
    })
  )
  if (upcoming.length > 0) {
    const evt = upcoming[0]
    const dayText = evt.diffDays === 0 ? 'today' : evt.diffDays === 1 ? 'tomorrow' : `in ${evt.diffDays} days`
    nudges.push({
      id: 'birthday',
      title: '🎂 Coming Up',
      body: `${evt.personName}'s ${evt.label || 'event'} is ${dayText}! Have you planned something?`,
    })
  }

  // Always have at least one nudge
  if (nudges.length === 0) {
    nudges.push({ id: 'generic', title: 'Life Pilot AI ✦', body: pick(GENERIC_NUDGES) })
  }

  return nudges
}

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization
  const querySecret = req.query?.secret
  if (process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      querySecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID keys not configured' })
  }

  webpush.setVapidDetails('mailto:support@getlifepilot.app', VAPID_PUBLIC, VAPID_PRIVATE)

  try {
    const { data: subs, error } = await supabase.from('push_subscriptions').select('*')
    if (error || !subs || subs.length === 0) {
      return res.status(200).json({ sent: 0, total: subs?.length || 0, error: error?.message })
    }

    let sent = 0, failed = 0

    for (const sub of subs) {
      try {
        // Get user's app state
        let appState = null
        try {
          const { data } = await supabase
            .from('user_data').select('app_state')
            .or(`user_id.eq.${sub.user_id},clerk_user_id.eq.${sub.user_id}`)
            .limit(1).single()
          appState = data?.app_state
        } catch {}

        // Build all applicable nudges
        const allNudges = buildAllNudges(appState)

        // Pick which nudge to send based on what we've already sent today
        // Store sent nudge IDs in a rotation key
        const rotationKey = `nudge-rotation-${sub.user_id}-${new Date().toISOString().split('T')[0]}`
        let sentToday = []
        try {
          const { data: rotData } = await supabase
            .from('push_subscriptions').select('subscription')
            .eq('user_id', sub.user_id).single()
          // Use a temp field to track rotation (stored in memory per cron run)
        } catch {}

        // Morning brief (8-10 AM) — full daily summary as push notification
        const hourNow = new Date().getHours()
        let nudge
        if (hourNow >= 6 && hourNow <= 10) {
          // Build a morning brief push notification
          const habits = appState?.habits || []
          const unchecked = habits.filter(h => !h.completions?.includes(todayStr))
          const pending = (appState?.items || []).filter(i => i.status === 'pending')
          const overdue = pending.filter(i => i.dueDate && new Date(i.dueDate) < new Date(todayStr))
          const dueToday = pending.filter(i => i.dueDate === todayStr)
          
          let briefBody = `Good morning, ${name}! `
          if (overdue.length > 0) briefBody += `⚠️ ${overdue.length} overdue. `
          if (dueToday.length > 0) briefBody += `📋 ${dueToday.length} due today. `
          if (unchecked.length > 0) briefBody += `🎯 ${unchecked.length} habits waiting. `
          if (!overdue.length && !dueToday.length && !unchecked.length) briefBody += `Clean slate today! `
          briefBody += `Open Life Pilot AI to see your full briefing.`
          
          nudge = { title: '☀️ Your Morning Brief', body: briefBody }
        } else {
          // Regular rotation for other times of day
          const nudgeIndex = hourNow % allNudges.length
          nudge = allNudges[nudgeIndex]
        }

        const payload = JSON.stringify({
          title: nudge.title,
          body: nudge.body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: nudge.id || 'nudge', // Same tag = replaces previous notification of same type
          data: { url: '/' },
        })

        await webpush.sendNotification(sub.subscription, payload)
        sent++
      } catch (err) {
        failed++
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }

    console.log(`[Cron Nudge] Sent: ${sent}, Failed: ${failed}, Total: ${subs.length}`)
    return res.status(200).json({ sent, failed, total: subs.length })
  } catch (err) {
    console.error('[Cron Nudge] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
