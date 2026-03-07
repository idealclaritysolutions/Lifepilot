import { useEffect, useCallback, useRef } from 'react'
import type { AppState } from '@/App'
import { hasFeature } from '@/App'

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
  "Got something on your mind? Talk to LifePilot — it's like texting your most organized friend.",
  "That thing you keep forgetting to do? Tell LifePilot. It'll track it so you don't have to.",
  "Need to buy something, plan a meal, or set a reminder? LifePilot handles it in seconds.",
]

const PEOPLE_NUDGES = [
  "When's the last time you checked on someone important to you? LifePilot remembers so you don't have to.",
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

// Send message to SW using the most reliable path available
async function sendToSW(msg: any): Promise<boolean> {
  try {
    // Path 1: Direct controller
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage(msg)
      return true
    }
    // Path 2: Wait for SW to be ready, then use active worker
    const reg = await navigator.serviceWorker?.ready
    if (reg?.active) {
      reg.active.postMessage(msg)
      return true
    }
  } catch {}
  return false
}

// Fallback: use main-thread setTimeout + Notification API
function scheduleMainThread(id: string, text: string, triggerAt: number) {
  const delay = Math.max(0, triggerAt - Date.now())
  if (delay > 4 * 60 * 60 * 1000) return // Don't schedule >4hr main-thread timers (unreliable)
  setTimeout(() => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('LifePilot ✦', { body: text, icon: '/icon-192.png', tag: id })
      }
    } catch {}
  }, delay)
}

async function scheduleNudge(id: string, text: string, triggerAt: number) {
  const sent = await sendToSW({ type: 'SCHEDULE_REMINDER', id, text, triggerAt })
  // Always set a main-thread backup for near-term nudges
  if (triggerAt - Date.now() < 4 * 60 * 60 * 1000) {
    scheduleMainThread(id, text, triggerAt)
  }
}

export function useDailyNudges(state: AppState) {
  const enabled = !!state.profile.notificationsEnabled
  const tier = state.subscription?.tier || 'free'
  const canUseNudges = hasFeature(tier, 'daily_nudges')
  const scheduledRef = useRef(false)

  const doSchedule = useCallback(async () => {
    if (!enabled || !canUseNudges) return  // Only for tiers with daily_nudges feature
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const today = new Date().toDateString()
    const lastScheduledKey = 'lp-nudge-scheduled'
    const lastScheduledTime = localStorage.getItem(lastScheduledKey + '-time')
    const lastScheduledDate = localStorage.getItem(lastScheduledKey)
    
    // Re-schedule if: different day, OR it's been more than 2 hours since last schedule
    // This ensures recovery when service worker is terminated
    const timeSinceLastSchedule = lastScheduledTime ? Date.now() - parseInt(lastScheduledTime, 10) : Infinity
    const shouldReschedule = lastScheduledDate !== today || timeSinceLastSchedule > 2 * 60 * 60 * 1000
    
    if (!shouldReschedule && scheduledRef.current) return

    const now = new Date()

    // 1. Feature discovery nudge — one random nudge at a pleasant time
    const featureNudge = ALL_FEATURE_NUDGES[Math.floor(Math.random() * ALL_FEATURE_NUDGES.length)]
    const featureHours = [10, 14, 19]
    // Use >= to include the current hour if we're at the start of that hour
    const featureHour = featureHours.find(h => h > now.getHours() || (h === now.getHours() && now.getMinutes() < 30))
    if (featureHour) {
      const featureTime = new Date(now)
      featureTime.setHours(featureHour, Math.floor(Math.random() * 20), 0, 0)
      await scheduleNudge('daily-feature-' + today, featureNudge.msg, featureTime.getTime())
    }

    // 2. Proactive task reminders — up to 3 pending tasks at 11 AM, 2 PM, 5 PM
    const pendingTasks = state.items.filter(i => i.status === 'pending')
    if (pendingTasks.length > 0) {
      const shuffled = [...pendingTasks].sort(() => Math.random() - 0.5)
      const tasksToNudge = shuffled.slice(0, Math.min(3, shuffled.length))
      const taskHours = [11, 14, 17]
      for (let i = 0; i < tasksToNudge.length; i++) {
        const hour = taskHours[i]
        if (hour <= now.getHours()) continue
        const template = TASK_NUDGES[Math.floor(Math.random() * TASK_NUDGES.length)]
        const msg = template.replace(/TASK/g, tasksToNudge[i].text)
        const nudgeTime = new Date(now)
        nudgeTime.setHours(hour, Math.floor(Math.random() * 15) + 5, 0, 0)
        await scheduleNudge('task-nudge-' + tasksToNudge[i].id + '-' + today, msg, nudgeTime.getTime())
      }
    }

    // 3. Evening journal reminder at 8:30 PM if no entry today
    const todayEntries = state.journal.filter(e => new Date(e.createdAt).toDateString() === today)
    if (todayEntries.length === 0 && now.getHours() < 20) {
      const journalTime = new Date(now)
      journalTime.setHours(20, 30, 0, 0)
      await scheduleNudge('journal-evening-' + today,
        "Your day had moments worth remembering. Take 60 seconds to write one down before it slips away.",
        journalTime.getTime())
    }

    // 4. Habit check-in at 9 PM if habits exist but none checked today
    if (state.habits.length > 0 && now.getHours() < 21) {
      const todayStr = now.toISOString().split('T')[0]
      const anyDone = state.habits.some(h => h.completions.includes(todayStr))
      if (!anyDone) {
        const habitTime = new Date(now)
        habitTime.setHours(21, 0, 0, 0)
        await scheduleNudge('habit-evening-' + today,
          "Your habits are waiting for today's check mark. One tap keeps your streak alive.",
          habitTime.getTime())
      }
    }

    // Only mark as scheduled AFTER all scheduling succeeded
    localStorage.setItem(lastScheduledKey, today)
    localStorage.setItem(lastScheduledKey + '-time', Date.now().toString())
    scheduledRef.current = true
  }, [enabled, canUseNudges, state.items, state.journal, state.habits])

  useEffect(() => {
    // Wait for SW to be ready before scheduling
    const trySchedule = async () => {
      try {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.ready
        }
      } catch {}
      // Small delay to ensure SW controller is populated
      setTimeout(() => doSchedule(), 2000)
    }
    trySchedule()

    // Re-check every 2 hours
    const interval = setInterval(doSchedule, 2 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [doSchedule])
}
