import { useEffect, useRef } from 'react'
import type { AppState } from '@/App'

export function useMorningBrief(state: AppState, addChat: (msg: { role: 'assistant'; content: string; timestamp: string }) => void) {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    if (!state.profile.onboarded || !state.profile.name) return

    const today = new Date().toDateString()
    const briefKey = 'lp-morning-brief-' + today
    if (localStorage.getItem(briefKey)) return

    // Only send between 5am and 2pm
    const hour = new Date().getHours()
    if (hour < 5 || hour > 14) return

    // Don't send if there are already messages from today
    const todayMessages = state.chatHistory.filter(m => {
      try { return new Date(m.timestamp || '').toDateString() === today } catch { return false }
    })
    if (todayMessages.length > 0) return

    sentRef.current = true
    localStorage.setItem(briefKey, '1')

    const name = state.profile.name.split(' ')[0]
    const todayStr = new Date().toISOString().split('T')[0]
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

    // Gather data
    const pendingTasks = state.items.filter(i => i.status === 'pending')
    const todayTasks = pendingTasks.filter(i => i.dueDate === todayStr)
    const overdueTasks = pendingTasks.filter(i => i.dueDate && new Date(i.dueDate) < new Date(todayStr))
    const habits = state.habits
    const uncheckedHabits = habits.filter(h => !h.completions.includes(todayStr))

    // Upcoming birthdays/events in next 3 days
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const upcomingEvents: string[] = []
    for (const person of state.people) {
      for (const evt of person.events || []) {
        if (!evt.date) continue
        const [mm, dd] = evt.date.split('-').map(Number)
        const eventDate = new Date(now.getFullYear(), mm - 1, dd)
        const diff = Math.round((eventDate.getTime() - todayMidnight.getTime()) / 86400000)
        if (diff >= 0 && diff <= 3) {
          upcomingEvents.push(`${person.name}'s ${evt.label || 'event'} is ${diff === 0 ? 'today!' : diff === 1 ? 'tomorrow!' : `in ${diff} days`}`)
        }
      }
    }

    // Build brief
    let brief = `Good morning, ${name}! ☀️ Happy ${dayName}. Here's your daily brief:\n\n`

    if (overdueTasks.length > 0) {
      brief += `⚠️ **${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}** — "${overdueTasks[0].text}"${overdueTasks.length > 1 ? ` and ${overdueTasks.length - 1} more` : ''}. Let's tackle ${overdueTasks.length === 1 ? 'this' : 'these'} today.\n\n`
    }

    if (todayTasks.length > 0) {
      brief += `📋 **${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''} due today:** ${todayTasks.slice(0, 3).map(t => `"${t.text}"`).join(', ')}${todayTasks.length > 3 ? ` +${todayTasks.length - 3} more` : ''}\n\n`
    } else if (pendingTasks.length > 0) {
      brief += `📋 **${pendingTasks.length} task${pendingTasks.length > 1 ? 's' : ''} on your board.** Nothing due today — good day to make progress on "${pendingTasks[0].text}"\n\n`
    }

    if (uncheckedHabits.length > 0 && habits.length > 0) {
      brief += `🎯 **${uncheckedHabits.length} habit${uncheckedHabits.length > 1 ? 's' : ''} to check off:** ${uncheckedHabits.slice(0, 3).map(h => `${h.emoji} ${h.name}`).join(', ')}${uncheckedHabits.length > 3 ? '...' : ''}\n\n`
    }

    if (upcomingEvents.length > 0) {
      brief += `🎂 **Heads up:** ${upcomingEvents.join(' • ')}\n\n`
    }

    // Focus session stats from yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const yesterdayFocus = (state.focusSessions || []).find(s => s.date === yesterday)
    if (yesterdayFocus && yesterdayFocus.minutes > 0) {
      brief += `⏱️ Yesterday you focused for **${yesterdayFocus.minutes} minutes** across ${yesterdayFocus.count} sessions. Nice work!\n\n`
    }

    if (!overdueTasks.length && !todayTasks.length && !uncheckedHabits.length && !upcomingEvents.length) {
      brief += `Looks like a clean slate today. What would you like to focus on?\n\n`
    }

    brief += `What's on your mind? I'm here to help. 💫`

    // Add with slight delay so it feels natural
    setTimeout(async () => {
      // Try to fetch Google Calendar events for today
      try {
        const calRes = await fetch(`/api/google-calendar?userId=${state.profile.name ? 'check' : 'anonymous'}`)
        const calData = await calRes.json()
        if (calData.events && calData.events.length > 0) {
          const todayEvents = calData.events.filter((e: any) => {
            const eventDate = new Date(e.start).toDateString()
            return eventDate === new Date().toDateString()
          })
          if (todayEvents.length > 0) {
            const calList = todayEvents.map((e: any) => {
              const t = new Date(e.start)
              const time = e.allDay ? 'All day' : t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              return `${time} — ${e.title}`
            }).join(', ')
            brief = brief.replace('What\'s on your mind?', `📅 **Calendar today:** ${calList}\n\nWhat's on your mind?`)
          }
        }
      } catch {}

      addChat({ role: 'assistant', content: brief, timestamp: new Date().toISOString() })
    }, 1500)

  }, [state.profile.onboarded, state.profile.name])
}
