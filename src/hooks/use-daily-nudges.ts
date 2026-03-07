import { useEffect, useCallback, useRef } from 'react'
import type { AppState } from '@/App'

const JOURNAL_NUDGES = [
  "The people who know themselves best are the ones who write things down. 60 seconds is all it takes.",
  "Something happened today worth remembering. Even if it felt small — it's yours. Capture it.",
  "Most people forget 90% of their day by tomorrow. Your journal keeps the moments that matter.",
  "Feeling stuck? Writing is how you untangle thoughts you didn't know were knotted.",
  "Your future self will thank you for writing today. What's one thing worth saving?",
  "Not every entry needs to be profound. Sometimes 'today was okay' is enough. Just show up.",
  "You've been through more than you give yourself credit for. Your journal is the proof.",
  "Two minutes of honest writing does more for clarity than two hours of overthinking.",
]

const CHAT_NUDGES = [
  "Got something on your mind? Talk to Life Pilot AI — it's like texting your most organized friend.",
  "That thing you keep forgetting to do? Tell Life Pilot AI. It'll track it so you don't have to.",
  "Need to buy something, plan a meal, or set a reminder? Life Pilot AI handles it in seconds.",
]

const PEOPLE_NUDGES = [
  "When's the last time you checked on someone important to you? Life Pilot AI remembers so you don't have to.",
  "Important dates slip through the cracks. Add your loved ones' birthdays so you never miss one.",
]

const BOARD_NUDGES = [
  "Checking things off feels better than it should. Your board is waiting.",
  "Three things. Just focus on three things today. Open your board and pick them.",
]

const HABITS_NUDGES = [
  "Small daily actions create big life changes. Have you checked off your habits today?",
  "Your streak is counting on you today. One tap and you're one step closer to the person you're becoming.",
]

const TASK_NUDGES = [
  "You've got \"TASK\" on your list. Even starting is progress — what's the first tiny step?",
  "Quick nudge: \"TASK\" is still waiting for you. You put it there for a reason. You've got this.",
  "Just a gentle reminder about \"TASK\". No pressure — but future you will appreciate present you for handling it.",
  "Hey, \"TASK\" hasn't been checked off yet. If it's still important, now might be a good time.",
  "\"TASK\" is still on your board. Remember — done is better than perfect.",
]

const ALL_FEATURE_NUDGES = [
  ...JOURNAL_NUDGES.map(msg => ({ type: 'journal', msg })),
  ...CHAT_NUDGES.map(msg => ({ type: 'chat', msg })),
  ...PEOPLE_NUDGES.map(msg => ({ type: 'people', msg })),
  ...BOARD_NUDGES.map(msg => ({ type: 'board', msg })),
  ...HABITS_NUDGES.map(msg => ({ type: 'habits', msg })),
]

// Fire notification immediately or after a short delay
function fireNotification(id: string, text: string, delayMs: number) {
  if (delayMs <= 0) {
    showNow(id, text)
  } else {
    setTimeout(() => showNow(id, text), delayMs)
  }
}

function showNow(id: string, text: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      // Try service worker first (shows even when tab is in background)
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: 'Life Pilot AI ✦',
          body: text,
          tag: id,
        })
      } else {
        new Notification('Life Pilot AI ✦', { body: text, icon: '/icon-192.png', tag: id })
      }
    }
  } catch {}
}

export function useDailyNudges(state: AppState) {
  const enabled = !!state.profile.notificationsEnabled
  const tier = state.subscription?.tier || 'free'

  const doSchedule = useCallback(() => {
    if (!enabled) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const now = new Date()
    const today = now.toDateString()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // Check what we've already sent today to avoid duplicates
    const sentKey = 'lp-nudges-sent-' + today
    const sentRaw = localStorage.getItem(sentKey)
    const sent: Record<string, boolean> = sentRaw ? JSON.parse(sentRaw) : {}
    const markSent = (key: string) => { sent[key] = true; localStorage.setItem(sentKey, JSON.stringify(sent)) }

    // === FEATURE NUDGE (all tiers) ===
    // One nudge per day: 10am, 2pm, or 7pm (whichever is next)
    const featureSlots = [10, 14, 19]
    for (const hour of featureSlots) {
      if (currentHour === hour && currentMinute < 30 && !sent['feature-' + hour]) {
        const nudge = ALL_FEATURE_NUDGES[Math.floor(Math.random() * ALL_FEATURE_NUDGES.length)]
        fireNotification('daily-feature', nudge.msg, Math.floor(Math.random() * 10000))
        markSent('feature-' + hour)
        break // Only one feature nudge per check
      }
    }

    // === TASK NUDGES (paid tiers) ===
    if (tier !== 'free') {
      const pendingTasks = state.items.filter(i => i.status === 'pending')
      const taskSlots = [{ hour: 11, idx: 0 }, { hour: 14, idx: 1 }, { hour: 17, idx: 2 }]
      for (const slot of taskSlots) {
        if (currentHour === slot.hour && currentMinute < 30 && !sent['task-' + slot.hour] && pendingTasks[slot.idx]) {
          const template = TASK_NUDGES[Math.floor(Math.random() * TASK_NUDGES.length)]
          const msg = template.replace(/TASK/g, pendingTasks[slot.idx].text)
          fireNotification('task-' + slot.hour, msg, Math.floor(Math.random() * 5000))
          markSent('task-' + slot.hour)
        }
      }
    }

    // === JOURNAL NUDGE (all tiers) — 8:30 PM ===
    if (currentHour === 20 && currentMinute >= 25 && currentMinute < 45 && !sent['journal-evening']) {
      const todayEntries = state.journal.filter(e => new Date(e.createdAt).toDateString() === today)
      if (todayEntries.length === 0) {
        fireNotification('journal-evening',
          "Your day had moments worth remembering. Take 60 seconds to write one down before it slips away.", 0)
        markSent('journal-evening')
      }
    }

    // === HABIT NUDGE (paid tiers) — 9 PM ===
    if (tier !== 'free' && currentHour === 21 && currentMinute < 15 && !sent['habit-evening']) {
      const todayStr = now.toISOString().split('T')[0]
      const anyDone = state.habits.some(h => h.completions.includes(todayStr))
      if (state.habits.length > 0 && !anyDone) {
        fireNotification('habit-evening',
          "Your habits are waiting for today's check mark. One tap keeps your streak alive.", 0)
        markSent('habit-evening')
      }
    }

    // Clean up old days
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('lp-nudges-sent-') && key !== sentKey) {
          localStorage.removeItem(key)
        }
      }
    } catch {}
  }, [enabled, tier, state.items, state.journal, state.habits])

  useEffect(() => {
    // Run immediately on mount
    const t = setTimeout(doSchedule, 3000)

    // Check every 10 minutes (catches the nudge windows reliably)
    const interval = setInterval(doSchedule, 10 * 60 * 1000)

    // Also run when app becomes visible (user switches back to app)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') doSchedule()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(t)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [doSchedule])
}
