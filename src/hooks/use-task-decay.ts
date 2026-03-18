import { useEffect, useRef } from 'react'
import type { AppState, LifeItem } from '@/App'

export function useTaskDecay(
  state: AppState,
  addChat: (msg: { role: 'assistant'; content: string; timestamp?: string }) => void,
  updateItem: (id: string, updates: Partial<LifeItem>) => void
) {
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    if (!state.profile.onboarded) return

    const today = new Date()
    const todayStr = today.toDateString()
    const decayKey = 'lp-task-decay-' + todayStr
    if (localStorage.getItem(decayKey)) return

    // Find stale tasks: pending, no due date, created > 14 days ago
    const staleTasks = state.items.filter(item => {
      if (item.status !== 'pending') return false
      if (item.dueDate) return false // Has a due date, not stale
      const created = new Date(item.createdAt || Date.now())
      const daysOld = Math.floor((today.getTime() - created.getTime()) / 86400000)
      return daysOld >= 14
    })

    if (staleTasks.length === 0) return

    checkedRef.current = true
    localStorage.setItem(decayKey, '1')

    // Only flag up to 3 stale tasks at a time
    const toFlag = staleTasks.slice(0, 3)
    const taskList = toFlag.map(t => {
      const age = Math.floor((today.getTime() - new Date(t.createdAt || Date.now()).getTime()) / 86400000)
      return `• "${t.text}" (${age} days old)`
    }).join('\n')

    const msg = `🧹 **Quick housekeeping** — I noticed ${staleTasks.length} task${staleTasks.length > 1 ? 's' : ''} on your board that ${staleTasks.length > 1 ? "haven't" : "hasn't"} been touched in over 2 weeks:\n\n${taskList}\n\n${staleTasks.length > 3 ? `...and ${staleTasks.length - 3} more.\n\n` : ''}Still relevant? You can:\n• Tell me to **remove** any of them\n• **Set a due date** to commit ("make Submit proposal due Friday")\n• Or just ignore this — I'll check again next week\n\nNo judgment either way. Sometimes letting go of old tasks is the most productive thing you can do. ✨`

    setTimeout(() => {
      addChat({ role: 'assistant', content: msg, timestamp: new Date().toISOString() })
    }, 8000) // Delay so it comes after the morning brief
  }, [state.profile.onboarded, state.items.length])
}
