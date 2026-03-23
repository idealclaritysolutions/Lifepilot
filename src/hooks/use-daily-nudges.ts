import { useEffect, useCallback } from 'react'
import type { AppState } from '@/App'

const NUDGE_MESSAGES = {
  journal: [
    "The people who know themselves best are the ones who write things down. 60 seconds is all it takes.",
    "Something happened today worth remembering. Even if it felt small — it's yours. Capture it.",
    "Most people forget 90% of their day by tomorrow. Your journal keeps the moments that matter.",
    "Your future self will thank you for writing today. What's one thing worth saving?",
    "Two minutes of honest writing does more for clarity than two hours of overthinking.",
  ],
  chat: [
    "Got something on your mind? Talk to Life Pilot AI — it's like texting your most organized friend.",
    "That thing you keep forgetting to do? Tell Life Pilot AI. It'll track it so you don't have to.",
    "Need to buy something, plan a meal, or set a reminder? Life Pilot AI handles it in seconds.",
  ],
  people: [
    "When's the last time you checked on someone important to you? Life Pilot AI remembers so you don't have to.",
    "Important dates slip through the cracks. Add your loved ones' birthdays so you never miss one.",
  ],
  board: [
    "Checking things off feels better than it should. Your board is waiting.",
    "Three things. Just focus on three things today. Open your board and pick them.",
  ],
  habits: [
    "Small daily actions create big life changes. Have you checked off your habits today?",
    "Your streak is counting on you today. One tap and you're one step closer to the person you're becoming.",
  ],
  task: [
    'You\'ve got "TASK" on your list. Even starting is progress — what\'s the first tiny step?',
    'Quick nudge: "TASK" is still waiting for you. You put it there for a reason. You\'ve got this.',
    '"TASK" is still on your board. Remember — done is better than perfect.',
  ],
}

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

// Module-level set: survives re-renders, prevents race conditions when
// mount/visibilitychange/focus all trigger runNudgeCheck nearly simultaneously.
// Acts as a synchronous guard before localStorage can be written.
const sentInSession = new Set<string>()

function showNotification(title: string, body: string, tag: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    
    // Try service worker (works in background)
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION', title, body, tag,
      })
      return true
    }
    
    // Fallback: direct Notification API
    new Notification(title, { body, icon: '/icon-192.png', tag })
    return true
  } catch { return false }
}

// Schedule a notification via Service Worker setTimeout (survives longer than main thread)
function scheduleViaSW(text: string, tag: string, delayMs: number) {
  try {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_REMINDER',
        id: tag,
        text,
        triggerAt: Date.now() + delayMs,
      })
      return true
    }
  } catch {}
  return false
}

export function useDailyNudges(state: AppState) {
  const enabled = !!state.profile.notificationsEnabled
  const tier = state.subscription?.tier || 'free'

  const runNudgeCheck = useCallback(() => {
    if (!enabled) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const now = Date.now()
    const currentHour = new Date().getHours()
    const today = new Date().toDateString()
    
    // ─── STRATEGY: "Last nudge" catch-up system ───
    // Instead of rigid time windows, track when we last sent each nudge type
    // and send if enough time has passed. This guarantees nudges whenever the
    // user opens the app, regardless of what time it is.
    
    const getLastSent = (key: string): number => {
      // Check session Set first — synchronous, prevents race between concurrent checks
      if (sentInSession.has(key)) return 1
      try { return parseInt(localStorage.getItem('lp-nudge-' + key) || '0') } catch { return 0 }
    }
    const markSent = (key: string) => {
      // Write to session Set immediately (synchronous) before localStorage
      sentInSession.add(key)
      try { localStorage.setItem('lp-nudge-' + key, String(now)) } catch {}
    }
    
    // ─── MOOD DETECTION from recent journal ───
    const recentJournal = state.journal.slice(0, 3).map(e => (e.content || '').toLowerCase()).join(' ')
    const isTired = /exhaust|tired|burnt out|burnout|overwhelm|drain|fatigue|can't sleep|insomnia|stressed|anxious|depressed|sad|crying|hopeless/.test(recentJournal)

    const GENTLE_NUDGES = [
      "Just showing up today counts. One small thing is enough. 💛",
      "You don't have to do it all today. What's one thing that would make you feel lighter?",
      "Gentle reminder: rest is productive too. Take care of yourself first.",
      "It's okay to have a low-energy day. What's one tiny win you can grab?",
      "No pressure today. If you do just one thing, let it be something kind for yourself.",
    ]

    // ─── 1. FEATURE/ENGAGEMENT NUDGE — once per day ───
    const lastFeature = getLastSent('feature-' + today)
    if (!lastFeature && currentHour >= 8 && currentHour <= 21) {
      // If mood is low, use gentle nudges instead
      if (isTired) {
        showNotification('Life Pilot AI 💛', pick(GENTLE_NUDGES), 'feature-nudge')
        markSent('feature-' + today)
      } else {
        const categories = Object.keys(NUDGE_MESSAGES) as (keyof typeof NUDGE_MESSAGES)[]
        const cat = categories[Math.floor(Math.random() * categories.length)]
        let msg = pick(NUDGE_MESSAGES[cat])
        if (cat === 'task') {
          const pending = state.items.filter(i => i.status === 'pending')
          if (pending.length > 0) {
            msg = msg.replace(/TASK/g, pending[Math.floor(Math.random() * pending.length)].text)
          } else {
            msg = pick(NUDGE_MESSAGES.chat)
          }
        }
        showNotification('Life Pilot AI ✦', msg, 'feature-nudge')
        markSent('feature-' + today)
      }
    }

    // ─── 2. TASK REMINDERS — once per day per task (paid tiers) ───
    if (tier !== 'free') {
      const lastTaskNudge = getLastSent('tasks-' + today)
      if (!lastTaskNudge) {
        const pendingTasks = state.items.filter(i => i.status === 'pending')
        if (pendingTasks.length > 0 && currentHour >= 9 && currentHour <= 18) {
          const task = pendingTasks[Math.floor(Math.random() * pendingTasks.length)]
          const msg = pick(NUDGE_MESSAGES.task).replace(/TASK/g, task.text)
          // Send now + schedule another for 4 hours from now via SW
          showNotification('📋 Life Pilot AI', msg, 'task-nudge')
          markSent('tasks-' + today)
          // Schedule a second task nudge for later today
          if (currentHour < 15 && pendingTasks.length > 1) {
            const task2 = pendingTasks.find(t => t.id !== task.id) || pendingTasks[0]
            const msg2 = pick(NUDGE_MESSAGES.task).replace(/TASK/g, task2.text)
            scheduleViaSW(msg2, 'task-nudge-2', 4 * 60 * 60 * 1000)
          }
        }
      }
    }

    // ─── 3. EVENING JOURNAL NUDGE — once per day at 7pm+ if no entry ───
    if (currentHour >= 19 && currentHour <= 22) {
      const lastJournal = getLastSent('journal-' + today)
      if (!lastJournal) {
        const todayEntries = state.journal.filter(e => new Date(e.createdAt).toDateString() === today)
        if (todayEntries.length === 0) {
          showNotification('📓 Life Pilot AI',
            "Your day had moments worth remembering. Take 60 seconds to write one down before it slips away.",
            'journal-evening')
          markSent('journal-' + today)
        }
      }
    }

    // ─── 4. EVENING HABIT NUDGE — once per day at 8pm+ if no habits checked ───
    if (tier !== 'free' && currentHour >= 20 && currentHour <= 22) {
      const lastHabit = getLastSent('habits-' + today)
      if (!lastHabit && state.habits.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0]
        const anyDone = state.habits.some(h => h.completions.includes(todayStr))
        if (!anyDone) {
          showNotification('🎯 Life Pilot AI',
            "Your habits are waiting for today's check mark. One tap keeps your streak alive.",
            'habit-evening')
          markSent('habits-' + today)
        }
      }
    }

    // ─── 5. SCHEDULE UPCOMING NUDGES VIA SERVICE WORKER ───
    // Only schedule once per day (deduped) so repeated app opens/focuses
    // don't queue multiple SW timers for the same notification.
    const hoursUntilEvening = Math.max(0, 19 - currentHour)
    if (hoursUntilEvening > 0 && hoursUntilEvening < 8) {
      // Schedule evening journal nudge — once per day only
      const todayEntries = state.journal.filter(e => new Date(e.createdAt).toDateString() === today)
      const alreadyScheduled = getLastSent('sw-journal-sched-' + today)
      if (todayEntries.length === 0 && !getLastSent('journal-' + today) && !alreadyScheduled) {
        scheduleViaSW(
          "Your day had moments worth remembering. Take 60 seconds to write one down.",
          'sw-journal-' + today,
          hoursUntilEvening * 60 * 60 * 1000
        )
        markSent('sw-journal-sched-' + today)
      }
    }

  }, [enabled, tier, state.items, state.journal, state.habits])

  useEffect(() => {
    // Run on mount (after 2 second delay to let SW register)
    const t = setTimeout(runNudgeCheck, 2000)

    // Run every 5 minutes while app is open
    const interval = setInterval(runNudgeCheck, 5 * 60 * 1000)

    // Run when app becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(runNudgeCheck, 1000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Run when window gets focus
    const handleFocus = () => setTimeout(runNudgeCheck, 500)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(t)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [runNudgeCheck])
}
