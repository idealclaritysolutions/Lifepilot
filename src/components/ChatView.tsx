import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AppState, LifeItem } from '@/App'
import { hasFeature } from '@/App'
import { generateAIResponse, detectCategory, uid, QUICK_ACTIONS, type AIAction } from '@/lib/ai-engine'
import { useDocumentUpload } from '@/hooks/use-document-upload'
import { useCalendar } from '@/hooks/use-calendar'
import { getMyHouseholds, addSharedItem, type HouseholdInfo } from '@/lib/supabase'
import { Send, Sparkles, Mic, MicOff, Paperclip, Calendar, MapPin, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  state: AppState
  addItem: (item: LifeItem) => void
  updateItem: (id: string, updates: Partial<LifeItem>) => void
  removeItem: (id: string) => void
  addChat: (msg: { role: 'user' | 'assistant'; content: string }) => void
  addPerson: (person: any) => void
  updatePerson: (id: string, updates: any) => void
  removePerson?: (id: string) => void
  addPurchase: (purchase: any) => void
  incrementMessageCount: () => void
  locationHook: any
  userId?: string
  addHabit?: (habit: any) => void
  updateHabit?: (id: string, updates: any) => void
  removeHabit?: (id: string) => void
  addJournalEntry?: (entry: any) => void
  deleteJournalEntry?: (id: string) => void
  addGoal?: (goal: any) => void
  updateGoal?: (id: string, updates: any) => void
  removeGoal?: (id: string) => void
}

export function ChatView(props: Props) {
  const { state, addItem, updateItem, removeItem, addChat, addPerson, updatePerson, addPurchase, incrementMessageCount, locationHook, userId, addHabit, updateHabit, removeHabit, addJournalEntry } = props
  const [input, setInput] = useState(() => {
    const prefill = sessionStorage.getItem('lp-chat-prefill')
    if (prefill) { sessionStorage.removeItem('lp-chat-prefill'); return prefill }
    return ''
  })
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [actionLog, setActionLog] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingDocItemsRef = useRef<any[]>([])
  const sharedListsRef = useRef<HouseholdInfo[]>([])
  const { analyzeDocument, analyzing } = useDocumentUpload()

  // Load shared lists for AI context
  useEffect(() => {
    if (userId) {
      getMyHouseholds(userId).then(hhs => { sharedListsRef.current = hhs })
    }
  }, [userId])
  const calendar = useCalendar()

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [state.chatHistory, isTyping, actionLog])

  // Execute AI actions
  const executeActions = async (actions: AIAction[]) => {
    const log: string[] = []

    for (const action of actions) {
      switch (action.type) {
        case 'add_item': {
          const p = action.payload
          // Normalize: lowercase, strip punctuation, trim
          const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
          const newText = normalize(p.text || '')

          // DEDUP: Check if a similar task already exists on the board
          const existing = state.items.find(i => {
            if (i.status === 'done') return false
            const existText = normalize(i.text)
            // Exact match after normalization
            if (existText === newText) return true
            // One contains the other
            if (existText.includes(newText) || newText.includes(existText)) return true
            // Word overlap > 60%
            const existWords = new Set(existText.split(/\s+/).filter(w => w.length > 2))
            const newWords = newText.split(/\s+/).filter(w => w.length > 2)
            if (newWords.length > 0 && existWords.size > 0) {
              const overlap = newWords.filter(w => existWords.has(w)).length
              if (overlap / Math.max(existWords.size, newWords.length) > 0.6) return true
            }
            return false
          })

          // Also check if we already added something similar in THIS batch
          const addedInBatch = log.some(l => {
            const ln = normalize(l)
            const nn = newText.substring(0, 15)
            return (ln.includes('added:') || ln.includes('updated:')) && ln.includes(nn)
          })

          if (existing) {
            const updates: any = { text: p.text }
            if (p.dueDate) updates.dueDate = p.dueDate
            updateItem(existing.id, updates)
            log.push(`✏️ Updated: ${p.text} (was already on board)`)
          } else if (addedInBatch) {
            log.push(`✏️ Skipped duplicate: ${p.text}`)
          } else {
            addItem({
              id: uid(),
              text: p.text,
              category: p.category || detectCategory(p.text),
              status: 'pending',
              createdAt: new Date().toISOString(),
              dueDate: p.dueDate,
              snoozeCount: 0,
              ...(p.goalId && { goalId: p.goalId }),
            } as any)
            log.push(`✅ Added: ${p.text}${p.dueDate ? ` (due ${p.dueDate})` : ''}`)
          }
          break
        }
        case 'add_multiple_items': {
          const items = action.payload.items || []
          for (const p of items) {
            addItem({
              id: uid(),
              text: p.text,
              category: p.category || detectCategory(p.text),
              status: 'pending',
              createdAt: new Date().toISOString(),
              dueDate: p.dueDate,
              snoozeCount: 0,
              ...(p.goalId && { goalId: p.goalId }),
            } as any)
          }
          log.push(`✅ Added ${items.length} items to your board`)
          break
        }
        case 'update_item': {
          const p = action.payload
          if (p.id) {
            const src = p.updates || p  // handle both flat and nested formats
            const updates: any = {}
            if (src.text) updates.text = src.text
            if (src.dueDate) updates.dueDate = src.dueDate
            if (src.category) updates.category = src.category
            if (src.status) updates.status = src.status
            if (src.eisenhower) updates.eisenhower = src.eisenhower
            if ('goalId' in src) updates.goalId = src.goalId || undefined
            updateItem(p.id, updates)
            log.push(`✏️ Updated: ${src.text || 'task'}`)
          }
          break
        }
        case 'complete_item': {
          const item = state.items.find(i => i.id === action.payload.id)
          if (item) {
            updateItem(action.payload.id, { status: 'done', completedAt: new Date().toISOString() })
            log.push(`☑️ Completed: ${item.text}`)
          }
          break
        }
        case 'remove_item': {
          const item = state.items.find(i => i.id === action.payload.id)
          if (item) {
            removeItem(action.payload.id)
            log.push(`🗑️ Removed: ${item.text}`)
          }
          break
        }
        case 'snooze_item': {
          const item = state.items.find(i => i.id === action.payload.id)
          if (item) {
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            updateItem(action.payload.id, {
              status: 'snoozed',
              snoozedUntil: tomorrow.toISOString(),
              snoozeCount: (item.snoozeCount || 0) + 1,
            })
            log.push(`⏸️ Snoozed: ${item.text}`)
          }
          break
        }
        case 'clear_completed': {
          const completed = state.items.filter(i => i.status === 'done')
          completed.forEach(i => removeItem(i.id))
          log.push(`🧹 Cleared ${completed.length} completed items`)
          break
        }
        case 'set_timer': {
          const p = action.payload
          const seconds = p.seconds || 60
          const message = p.message || 'Timer done!'
          const timerText = message.toLowerCase().trim()

          // DEDUP: Check if a matching task already exists (AI might have also sent add_item)
          const existingTimer = state.items.find(i => {
            if (i.status === 'done') return false
            const t = i.text.toLowerCase().trim()
            if (t === timerText) return true
            if (t.includes(timerText) || timerText.includes(t)) return true
            return false
          })

          // Also check if add_item in THIS SAME batch already created it
          const alreadyAddedInBatch = log.some(l => {
            const lower = l.toLowerCase()
            return (lower.includes('added:') || lower.includes('updated:')) && lower.includes(timerText.substring(0, 15))
          })

          let taskId: string
          if (existingTimer) {
            taskId = existingTimer.id
          } else if (alreadyAddedInBatch) {
            // Find the item that was just added
            const justAdded = state.items.find(i => i.text.toLowerCase().trim().includes(timerText.substring(0, 15)))
            taskId = justAdded?.id || uid()
          } else {
            taskId = uid()
            addItem({
              id: taskId,
              text: message,
              category: detectCategory(message),
              status: 'pending',
              createdAt: new Date().toISOString(),
              snoozeCount: 0,
            })
            log.push(`✅ Added to board: ${message}`)
          }

          // Request notification permission proactively
          try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch {}

          // Schedule via service worker (survives app being backgrounded)
          // Try multiple paths since SW controller can be null on first load
          const triggerAt = Date.now() + (seconds * 1000)
          const swMsg = { type: 'SCHEDULE_REMINDER', id: 'timer-' + taskId, text: message, triggerAt }
          try {
            if (navigator.serviceWorker?.controller) {
              navigator.serviceWorker.controller.postMessage(swMsg)
            } else {
              // Fallback: get the registration and use active worker
              navigator.serviceWorker?.ready?.then(reg => {
                reg.active?.postMessage(swMsg)
              })
            }
          } catch {}

          // Backup main-thread timer (always runs as insurance)
          setTimeout(() => {
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('⏰ Life Pilot AI', {
                  body: message, icon: '/icon-192.png', tag: 'timer-' + taskId,
                })
              }
            } catch {
              try {
                navigator.serviceWorker?.controller?.postMessage({
                  type: 'SHOW_NOTIFICATION', title: '⏰ Life Pilot AI', body: message, data: { itemId: taskId },
                })
              } catch {}
            }
          }, seconds * 1000)

          const timeStr = seconds >= 60 ? `${Math.round(seconds / 60)} minute${seconds >= 120 ? 's' : ''}` : `${seconds} seconds`
          log.push(`⏰ Timer: ${timeStr} — "${message}"`)
          break
        }
        case 'add_person': {
          const p = action.payload
          const events = (p.events || []).map((e: any) => ({
            id: uid(),
            label: e.label || 'Birthday',
            type: e.type || 'birthday',
            date: e.date,
            year: e.year,
            recurring: e.recurring !== false,
            notes: e.notes || '',
          }))
          addPerson({
            id: uid(),
            name: p.name,
            relationship: p.relationship || 'Friend',
            closeness: p.closeness || 'close',
            events,
            notes: p.notes || '',
            giftHistory: [],
            createdAt: new Date().toISOString(),
          })
          log.push(`👤 Added: ${p.name} (${p.relationship || 'Friend'})${events.length > 0 ? ` with ${events.length} event${events.length > 1 ? 's' : ''}` : ''}`)
          break
        }
        case 'update_person': {
          const p = action.payload
          if (p.id) {
            updatePerson(p.id, p)
            log.push(`✏️ Updated person info`)
          }
          break
        }
        case 'add_event_to_person': {
          const p = action.payload
          const person = state.people.find(pp => pp.id === p.personId)
          if (person && p.event) {
            const newEvent = { id: uid(), ...p.event, recurring: p.event.recurring !== false }
            updatePerson(person.id, { events: [...person.events, newEvent] })
            log.push(`📅 Added ${p.event.label} to ${person.name}`)
          }
          break
        }
        case 'add_to_shared_list': {
          const sl = action.payload
          if (sl.householdId && sl.text && userId) {
            const result = await addSharedItem({
              household_id: sl.householdId,
              text: sl.text,
              category: 'grocery',
              checked: false,
              added_by: userId,
              notes: sl.notes || undefined,
              link: sl.link || undefined,
            })
            if (result) {
              const listName = sharedListsRef.current.find(h => h.id === sl.householdId)?.name || 'shared list'
              log.push(`📋 Added "${sl.text}" to ${listName}`)
            }
          }
          break
        }
        case 'add_habit': {
          const h = action.payload
          if (h.name) {
            const newHabit = {
              id: 'habit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              name: h.name,
              emoji: h.emoji || '⭐',
              frequency: h.frequency || 'daily',
              category: h.category || 'other',
              completions: [],
              createdAt: new Date().toISOString(),
              streakBest: 0,
            }
            addHabit(newHabit)
            log.push(`✅ Created habit: ${h.emoji || '⭐'} ${h.name}`)
          }
          break
        }
        case 'complete_habit': {
          const hp = action.payload
          if (hp.habitName) {
            const today = new Date().toISOString().split('T')[0]
            const match = state.habits.find(h => h.name.toLowerCase().includes(hp.habitName.toLowerCase()))
            if (match && !match.completions.includes(today)) {
              updateHabit(match.id, { completions: [...match.completions, today] })
              log.push(`🎯 Checked off: ${match.emoji} ${match.name}`)
            }
          }
          break
        }
        case 'add_journal': {
          const j = action.payload
          if (j.content) {
            const { extractThemes } = await import('@/components/JournalView')
            const themes = extractThemes(j.content)
            addJournalEntry({
              id: 'journal-' + Date.now(),
              content: j.content,
              mood: j.mood || undefined,
              createdAt: new Date().toISOString(),
              themes,
            })
            log.push(`📓 Journal entry saved`)
          }
          break
        }
        case 'remove_habit': {
          const name = action.payload?.habitName?.toLowerCase()
          if (name) {
            const match = state.habits.find(h => h.name.toLowerCase().includes(name))
            if (match) {
              removeHabit(match.id)
              log.push(`🗑️ Removed habit: ${match.emoji} ${match.name}`)
            }
          }
          break
        }
        case 'update_habit': {
          const hName = action.payload?.habitName?.toLowerCase()
          const updates = action.payload?.updates
          if (hName && updates) {
            const match = state.habits.find(h => h.name.toLowerCase().includes(hName))
            if (match) {
              updateHabit(match.id, updates)
              log.push(`✏️ Updated habit: ${match.emoji} ${match.name}`)
            }
          }
          break
        }
        case 'set_eisenhower': {
          const { itemId, quadrant } = action.payload || {}
          if (itemId && quadrant) {
            updateItem(itemId, { eisenhower: quadrant })
            const labels: Record<string, string> = { do: '🔥 Do First', schedule: '📅 Schedule', delegate: '👋 Delegate', eliminate: '🗑️ Drop It' }
            const item = state.items.find(i => i.id === itemId)
            log.push(`${labels[quadrant] || quadrant}: "${item?.text || itemId}"`)
          }
          break
        }
        case 'google_create_event': {
          const { title, date, startTime, endTime, description, location } = action.payload || {}
          if (title && date) {
            try {
              const res = await fetch('/api/google-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, title, date, startTime, endTime, description, location, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
              })
              const data = await res.json()
              if (data.event) {
                log.push(`📅 Added to Google Calendar: "${title}"`)
              } else if (data.needsAuth) {
                log.push(`⚠️ Google not connected — go to Settings → Integrations`)
              } else {
                log.push(`⚠️ Couldn't add to calendar`)
              }
            } catch { log.push(`⚠️ Calendar error`) }
          }
          break
        }
        case 'google_check_calendar': {
          try {
            const res = await fetch(`/api/google-calendar?userId=${userId}`)
            const data = await res.json()
            if (data.needsAuth) {
              addChat({ role: 'assistant', content: "You haven't connected Google Calendar yet. Go to **Settings → Integrations** and tap **Connect** next to Google Calendar & Gmail. It takes 10 seconds!" })
            } else if (data.events && data.events.length > 0) {
              const eventList = data.events.slice(0, 10).map((e: any) => {
                const d = new Date(e.start)
                const timeStr = e.allDay ? 'All day' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                return `• **${e.title}** — ${dateStr} at ${timeStr}${e.location ? ` (${e.location})` : ''}`
              }).join('\n')
              addChat({ role: 'assistant', content: `📅 Here's what's coming up:\n\n${eventList}` })
            } else {
              addChat({ role: 'assistant', content: "Your calendar looks clear for the next 7 days! Great time to focus or plan something fun." })
            }
          } catch {
            addChat({ role: 'assistant', content: "Couldn't reach Google Calendar right now. Try again in a moment." })
          }
          break
        }
        case 'google_check_email': {
          try {
            const query = action.payload?.query || 'is:unread'
            const res = await fetch(`/api/google-gmail?userId=${userId}&q=${encodeURIComponent(query)}&max=8`)
            const data = await res.json()
            if (data.needsAuth) {
              addChat({ role: 'assistant', content: "You haven't connected Gmail yet. Go to **Settings → Integrations** and tap **Connect** next to Google Calendar & Gmail." })
            } else if (data.emails && data.emails.length > 0) {
              const emailList = data.emails.slice(0, 8).map((e: any) => {
                const from = e.from?.replace(/<.*>/, '').trim() || 'Unknown'
                return `• ${e.isUnread ? '🔴' : '⚪'} **${e.subject || '(no subject)'}** — from ${from}\n  _"${e.snippet || ''}"_`
              }).join('\n\n')
              addChat({ role: 'assistant', content: `📧 ${data.total > 8 ? `Showing 8 of ${data.total}` : `${data.emails.length} email${data.emails.length > 1 ? 's' : ''}`} matching "${query}":\n\n${emailList}` })
            } else {
              addChat({ role: 'assistant', content: `No emails found matching "${query}". Your inbox is looking clean! ✨` })
            }
          } catch {
            addChat({ role: 'assistant', content: "Couldn't reach Gmail right now. Try again in a moment." })
          }
          break
        }

        case 'add_goal': {
          const p = action.payload
          const goalId = `goal-${Date.now()}`
          props.addGoal?.({ id: goalId, title: p.title, targetDate: p.targetDate, category: p.category || 'general',
            createdAt: new Date().toISOString(), milestones: [], linkedHabitIds: [], linkedTaskIds: [], status: 'active' })
          log.push(`🎯 Goal created: ${p.title}`)
          // Store goalId for subsequent add_task_to_goal actions in same batch
          ;(window as any).__lastGoalId = goalId
          break
        }
        case 'add_task_to_goal': {
          const p = action.payload
          const gid = p.goalId || (window as any).__lastGoalId
          if (gid) {
            const taskId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            addItem({ id: taskId, text: p.text, category: p.category || 'general', status: 'pending', createdAt: new Date().toISOString(), snoozeCount: 0, goalId: gid, dueDate: p.dueDate } as any)
            log.push(`📋 Task added to goal: ${p.text}`)
          }
          break
        }
        case 'add_habit_to_goal': {
          const p = action.payload
          const gid = p.goalId || (window as any).__lastGoalId
          const habitId = `habit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
          props.addHabit?.({ id: habitId, name: p.name, emoji: p.emoji || '✅', frequency: p.frequency || 'daily', completions: [], createdAt: new Date().toISOString(), streakBest: 0, notes: '' })
          // Link habit to goal
          if (gid) {
            const goal = state.goals?.find(g => g.id === gid)
            if (goal) {
              props.updateGoal?.(gid, { linkedHabitIds: [...(goal.linkedHabitIds || []), habitId] })
            }
          }
          log.push(`🔁 Habit created: ${p.name}`)
          break
        }
        case 'complete_goal': {
          const p = action.payload
          if (p.goalId) {
            props.updateGoal?.(p.goalId, { status: 'completed', completedAt: new Date().toISOString() })
            log.push(`✅ Goal completed!`)
          }
          break
        }
        case 'update_goal': {
          const p = action.payload
          if (p.goalId && p.updates) {
            props.updateGoal?.(p.goalId, p.updates)
            log.push(`✏️ Goal updated`)
          }
          break
        }
        case 'remove_goal': {
          const p = action.payload
          if (p.goalId) {
            props.removeGoal?.(p.goalId)
            log.push(`🗑️ Goal removed`)
          }
          break
        }
        case 'remove_person': {
          const p = action.payload
          if (p.id) {
            props.removePerson?.(p.id)
            log.push(`🗑️ Person removed`)
          }
          break
        }
        case 'delete_journal': {
          const p = action.payload
          if (p.id) {
            props.deleteJournalEntry?.(p.id)
            log.push(`🗑️ Journal entry deleted`)
          }
          break
        }
      }
    }

    if (log.length > 0) {
      setActionLog(log)
      setTimeout(() => setActionLog([]), 5000)
    }
  }

  // ─── CHAT VOICE — mirrors journal voice pattern exactly ─────────
  const chatFinalSegmentsRef = useRef<string[]>([])
  const chatSeenFinalsRef = useRef<Set<string>>(new Set())
  const chatProcessedIdxRef = useRef(0)
  const chatStoppedByUserRef = useRef(false)
  const chatRestartTimeoutRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      chatStoppedByUserRef.current = true
      try { recognitionRef.current?.abort() } catch {}
      if (chatRestartTimeoutRef.current) clearTimeout(chatRestartTimeoutRef.current)
    }
  }, [])

  const chatBuildDisplay = () => {
    return chatFinalSegmentsRef.current.join(' ').trim()
  }

  const launchChatRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    const isAndroid = /android/i.test(navigator.userAgent)
    rec.continuous = !isAndroid  // Android: false prevents duplication. iOS: true for smooth recording.
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => setIsListening(true)

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = chatProcessedIdxRef.current; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const transcript = e.results[i][0].transcript.trim()
          if (!transcript) { chatProcessedIdxRef.current = i + 1; continue }
          const fp = transcript.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
          if (fp && !chatSeenFinalsRef.current.has(fp)) {
            chatSeenFinalsRef.current.add(fp)
            chatFinalSegmentsRef.current.push(transcript)
          }
          chatProcessedIdxRef.current = i + 1
        } else {
          interim = e.results[i][0].transcript
        }
      }
      const display = chatFinalSegmentsRef.current.join(' ') + (interim ? ' ' + interim : '')
      // Smart punctuation: capitalize first letter, add period at end
      let cleaned = display.trim()
      if (cleaned) cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      setInput(cleaned)
    }

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      console.warn('Chat voice error:', e.error)
    }

    rec.onend = () => {
      if (!chatStoppedByUserRef.current) {
        const isAndroid = /android/i.test(navigator.userAgent)
        if (isAndroid) {
          // Android: stop cleanly. Text stays in input. User taps mic to continue or send.
          setIsListening(false)
        } else {
          // iOS: restart seamlessly
          chatProcessedIdxRef.current = 0
          chatRestartTimeoutRef.current = setTimeout(() => {
            if (!chatStoppedByUserRef.current) launchChatRecognition()
            else setIsListening(false)
          }, 500)
        }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = rec
    try { rec.start() } catch { setIsListening(false) }
  }

  const toggleVoice = () => {
    if (isListening) {
      // Stop recording
      chatStoppedByUserRef.current = true
      if (chatRestartTimeoutRef.current) clearTimeout(chatRestartTimeoutRef.current)
      try { recognitionRef.current?.abort() } catch {}
      setIsListening(false)
      const currentText = input.trim()
      chatFinalSegmentsRef.current = []
      chatSeenFinalsRef.current = new Set()
      chatProcessedIdxRef.current = 0
      if (currentText) setTimeout(() => handleSend(currentText), 300)
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error("Voice not available in this browser. Try Chrome or Safari."); return }

    chatFinalSegmentsRef.current = []
    chatSeenFinalsRef.current = new Set()
    chatProcessedIdxRef.current = 0
    chatStoppedByUserRef.current = false
    try { recognitionRef.current?.abort() } catch {}
    if (chatRestartTimeoutRef.current) clearTimeout(chatRestartTimeoutRef.current)
    launchChatRecognition()
  }

  const handleSend = async (text?: string) => {
    // Stop voice FIRST before reading input
    if (isListening) {
      chatStoppedByUserRef.current = true
      if (chatRestartTimeoutRef.current) clearTimeout(chatRestartTimeoutRef.current)
      try { recognitionRef.current?.abort() } catch {}
      setIsListening(false)
      chatFinalSegmentsRef.current = []
      chatSeenFinalsRef.current = new Set()
      chatProcessedIdxRef.current = 0
    }
    
    const message = text || input.trim()
    if (!message || isTyping) return

    // Clear input immediately
    setInput('')

    // Check if user is responding to a document analysis with pending items
    if (pendingDocItemsRef.current.length > 0) {
      const lower = message.toLowerCase()
      const items = pendingDocItemsRef.current

      addChat({ role: 'user', content: message })
      setInput('')

      // "Add them all" / "add all" / "yes" / "add to board"
      if (/add.*(all|them|everything)|yes.*add|put.*board|add.*board/.test(lower)) {
        const actions: AIAction[] = [{ type: 'add_multiple_items', payload: { items } }]
        executeActions(actions)
        addChat({ role: 'assistant', content: `Done! Added all ${items.length} items to your board. ✅` })
        pendingDocItemsRef.current = []
        return
      }

      // "Add just #1 and #3" or "add 1, 3, 5"
      const numberMatches = lower.match(/\d+/g)
      if (numberMatches && /add|keep|just|only/.test(lower)) {
        const indices = numberMatches.map(n => parseInt(n) - 1).filter(i => i >= 0 && i < items.length)
        if (indices.length > 0) {
          const selected = indices.map(i => items[i])
          const actions: AIAction[] = [{ type: 'add_multiple_items', payload: { items: selected } }]
          executeActions(actions)
          addChat({ role: 'assistant', content: `Added ${selected.length} item${selected.length > 1 ? 's' : ''} to your board. ✅` })
          pendingDocItemsRef.current = []
          return
        }
      }

      // "Grocery list" / "create a grocery list"
      if (/grocery/.test(lower)) {
        const groceryItems = items.map((item: any) => ({ ...item, category: 'grocery' }))
        const actions: AIAction[] = [{ type: 'add_multiple_items', payload: { items: groceryItems } }]
        executeActions(actions)
        addChat({ role: 'assistant', content: `Added ${items.length} items to your Grocery List. 🛒` })
        pendingDocItemsRef.current = []
        return
      }

      // "No" / "just summarize" / "skip" / "nevermind"
      if (/no|skip|never ?mind|just.*summar|don.?t add|cancel/.test(lower)) {
        addChat({ role: 'assistant', content: `No problem! I'll just keep the summary for your reference. Let me know if you need anything else.` })
        pendingDocItemsRef.current = []
        return
      }

      // If none of the above matched, clear pending items and let the normal AI handle it
      pendingDocItemsRef.current = []
    }

    // Check message limit for ALL tiers (no tier is unlimited now)
    const limits = (await import('@/App')).TIER_LIMITS[state.subscription.tier]
    const planNames = (await import('@/App')).PLAN_NAMES
    const today = new Date().toDateString()
    const todayMessages = state.usageToday.date === today ? state.usageToday.messages : 0
    if (todayMessages >= limits.messagesPerDay) {
      const tier = state.subscription.tier
      const currentPlan = planNames[tier]
      let upgradeMsg = ''
      if (tier === 'free') upgradeMsg = `Upgrade to **Life Pilot** ($16.99/mo) for 40 messages/day — your thoughts deserve space.`
      else if (tier === 'pro') upgradeMsg = `Upgrade to **Inner Circle** ($34.99/mo) for 100 messages/day and shared lists, habits, and more.`
      else if (tier === 'premium') upgradeMsg = `Upgrade to **Guided** ($129.99/mo) for 300 messages/day plus monthly coaching calls.`
      else upgradeMsg = `You're on our top tier — your limit resets tomorrow. Thank you for being a Guided member! 🙏`
      addChat({ role: 'assistant', content: `You've reached your ${limits.messagesPerDay} daily messages on ${currentPlan}. 💛\n\n${upgradeMsg}\n\nTap the 👑 icon to see plans.` })
      return
    }

    incrementMessageCount()
    addChat({ role: 'user', content: message })
    setInput('')
    setIsTyping(true)

    try {
      const sharedLists = sharedListsRef.current.map(h => ({ id: h.id, name: h.name }))
      let response = await generateAIResponse(message, state, state.chatHistory, sharedLists)
      
      // Check if AI wants to search the web
      let searchAction = response.actions.find(a => a.type === 'web_search')
      
      // Fallback: detect search intent client-side if Claude didn't emit web_search
      if (!searchAction) {
        const lower = message.toLowerCase()
        const searchTriggers = [
          // Direct search requests
          /\b(search|look up|find|browse|google|shop)\b/,
          // Current events
          /\b(news|current|latest|recent|today|happening|trending)\b/,
          // Shopping intent
          /\b(buy|purchase|price|cost|cheap|deal|discount|coupon|order|shop)\b/,
          // Recommendations
          /\b(best|top|recommend|suggest|compare|review|rating|rated)\b/,
          // Location queries
          /\b(near me|nearby|closest|where (?:can|to|is|are))\b/,
          // Specific lookups
          /\b(how much|what is the|who is the|when is|where is)\b/,
          // Products and services
          /\b(restaurant|hotel|flight|recipe|product|item|store|brand)\b/,
        ]
        const looksLikeSearch = searchTriggers.some(r => r.test(lower))
        const claudeRefused = /can'?t (?:browse|search|access)|don'?t have (?:access|real.time|the ability)|not able to|no (?:internet|web)|unable to (?:search|browse|access)|training data/i.test(response.message)
        
        if (looksLikeSearch || claudeRefused) {
          const searchQuery = message.replace(/^(can you |please |could you |help me |i want to |i need to |i'd like to )/i, '').trim()
          searchAction = { type: 'web_search' as const, payload: { query: searchQuery } }
        }
      }
      
      if (searchAction && searchAction.payload?.query) {
        if (!hasFeature(state.subscription.tier, 'web_search')) {
          addChat({ role: 'assistant', content: `I'd love to search the web for you! 🔍 Web search is available on the **Life Pilot** plan ($16.99/mo) and above. Tap the 👑 icon to upgrade and I'll find real-time products, news, prices, and more for you.` })
          setIsTyping(false)
          return
        }
        // Check daily search limit
        const searchCountKey = 'lp-search-count-' + new Date().toDateString()
        const searchCount = parseInt(localStorage.getItem(searchCountKey) || '0')
        const searchLimit = (await import('@/App')).TIER_LIMITS[state.subscription.tier].searchesPerDay
        if (searchCount >= searchLimit) {
          addChat({ role: 'assistant', content: `You've used your ${searchLimit} web searches for today. Your searches reset tomorrow! 🔍\n\nI can still help from my knowledge — what would you like to know?` })
          setIsTyping(false)
          return
        }
        localStorage.setItem(searchCountKey, String(searchCount + 1))
        // Show searching indicator
        addChat({ role: 'assistant', content: `🔍 Searching for "${searchAction.payload.query}"...` })
        
        try {
          console.log('[LifePilot] Searching for:', searchAction.payload.query)
          const searchRes = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: searchAction.payload.query, num: 5 }),
          })
          
          if (!searchRes.ok) {
            const errData = await searchRes.json().catch(() => ({}))
            console.error('[LifePilot] Search API error:', searchRes.status, errData)
            // Show the actual Google error to help debug
            const errMsg = errData.error || `Search failed (${searchRes.status})`
            addChat({ role: 'assistant', content: `Search couldn't complete: ${errMsg}. Let me help from what I know instead.` })
            response = await generateAIResponse(message, state, state.chatHistory, sharedLists)
            const otherActions2 = response.actions.filter(a => a.type !== 'web_search')
            if (otherActions2.length > 0) executeActions(otherActions2)
            addChat({ role: 'assistant', content: response.message })
            setIsTyping(false)
            return
          }
          
          const searchData = await searchRes.json()
          console.log('[LifePilot] Search results:', searchData.results?.length || 0)
          
          if (searchData.results && searchData.results.length > 0) {
            const resultsText = searchData.results.map((r: any, i: number) => {
              let entry = `${i + 1}. ${r.title}\n   Link: ${r.link}\n   ${r.snippet}`
              if (r.price) entry += `\n   Price: $${r.price}`
              return entry
            }).join('\n\n')
            
            const searchContext = `The user asked: "${message}"\n\nI searched Google and found these REAL results:\n\n${resultsText}\n\nPresent these results helpfully. Use the REAL links from above. Include prices when shown. Offer to add items to their shared list or board. Format links as markdown [Title](url).`
            
            response = await generateAIResponse(searchContext, state, [
              ...state.chatHistory.slice(-6),
              { role: 'user' as const, content: message },
            ], sharedLists)
          } else if (searchData.error) {
            console.error('[LifePilot] Search returned error:', searchData.error)
            response = await generateAIResponse(message + '\n[Web search returned an error. Respond from your knowledge and mention the user can try again.]', state, state.chatHistory, sharedLists)
          } else {
            response = await generateAIResponse(message + '\n[Web search found no results. Respond helpfully from your knowledge.]', state, state.chatHistory, sharedLists)
          }
        } catch (searchErr: any) {
          console.error('[LifePilot] Search exception:', searchErr?.message)
          response = await generateAIResponse(message + '\n[Web search is temporarily unavailable. Respond from your knowledge.]', state, state.chatHistory, sharedLists)
        }
        
        // Remove the "Searching..." message
        // We'll just add the real response — the searching message stays as context
      }
      
      // Execute non-search actions
      const otherActions = response.actions.filter(a => a.type !== 'web_search')
      if (otherActions.length > 0) {
        executeActions(otherActions)
      }
      addChat({ role: 'assistant', content: response.message })
    } catch {
      addChat({ role: 'assistant', content: `Small hiccup — try again in a moment!` })
    } finally {
      setIsTyping(false)
    }
  }

  // Document upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // Reset so same file can be re-uploaded

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error('Upload a photo, screenshot, or PDF')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large — max 20MB')
      return
    }

    addChat({ role: 'user', content: `📎 Uploaded: ${file.name}` })
    setIsTyping(true)

    const result = await analyzeDocument(file)
    if (result) {
      // Store extracted items for later use — don't auto-add to board
      if (result.extractedItems.length > 0) {
        pendingDocItemsRef.current = result.extractedItems
      }

      // Build analysis message
      let msg = `📄 **Here's what I found:**\n\n${result.summary}`

      if (result.keyFacts.length > 0) {
        msg += '\n\n**Key details:**\n' + result.keyFacts.map(f => `• ${f}`).join('\n')
      }

      if (result.extractedItems.length > 0) {
        msg += `\n\nI found **${result.extractedItems.length} actionable item${result.extractedItems.length > 1 ? 's' : ''}**:\n`
        msg += result.extractedItems.map((item: any, i: number) => `${i + 1}. ${item.text}`).join('\n')
        msg += '\n\n**What would you like me to do?**'
        msg += '\n• "Add them all to my board" — I\'ll create tasks for each item'
        msg += '\n• "Add just #1 and #3" — I\'ll add only the ones you pick'
        msg += '\n• "Summarize it" — I\'ll just keep the summary, no tasks'
        msg += '\n• "Create a grocery list from this" — I\'ll add items to your Grocery List'
        msg += '\n• Or tell me anything else you\'d like to do with this!'
      }

      addChat({ role: 'assistant', content: msg })
    } else {
      addChat({ role: 'assistant', content: `I couldn't read that file. Try a clearer photo or screenshot.` })
    }
    setIsTyping(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const isEmpty = state.chatHistory.length === 0

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-8 h-8 text-amber-800" />
            </div>
            <h2 className="text-xl font-bold text-stone-800 mb-2" style={{ fontFamily: "'Georgia', serif" }}>
              What can I handle for you, {state.profile.name}?
            </h2>
            <p className="text-stone-600 text-sm mb-1 max-w-xs">
              I don't just give advice — I take action. Tell me what you need and I'll do it.
            </p>
            <p className="text-stone-600 text-xs mb-8 max-w-xs">
              🎙️ Tap the mic to talk hands-free
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {QUICK_ACTIONS.map(a => (
                <button key={a.id} onClick={() => handleSend(a.prompt)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-white border border-stone-100 hover:border-amber-200 hover:bg-amber-50/50 transition-all text-left group">
                  <span className="text-lg">{a.emoji}</span>
                  <span className="text-sm text-stone-600 group-hover:text-stone-800">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {state.chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-stone-800 text-white rounded-br-md'
                    : 'bg-white border border-stone-100 text-stone-700 rounded-bl-md shadow-sm'
                }`}>
                  <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap">
                    {msg.role === 'assistant' ? <FormattedMessage content={msg.content} /> : msg.content}
                  </div>
                  <div className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-stone-600' : 'text-stone-600'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Action log - shows what Life Pilot AI just did */}
            {actionLog.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-amber-50 border border-amber-200 shadow-sm">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Actions taken</p>
                  {actionLog.map((log, i) => (
                    <div key={i} className="text-[13px] text-amber-800 leading-relaxed flex items-start gap-2">
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-stone-600">Taking action...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!isEmpty && (
        <div className="px-3 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-t border-stone-50">
          {QUICK_ACTIONS.map(a => (
            <button key={a.id} onClick={() => handleSend(a.prompt)} disabled={isTyping}
              className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-stone-100 hover:border-amber-200 hover:bg-amber-50 transition-colors text-xs text-stone-500 hover:text-stone-700 whitespace-nowrap disabled:opacity-40">
              <span>{a.emoji}</span><span>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {isListening && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <p className="text-sm text-red-600 font-medium flex-1">Listening...</p>
          <button onClick={toggleVoice} className="text-xs text-red-500 font-medium">Cancel</button>
        </div>
      )}

      <div className="p-3 bg-[#FAF9F6]">
        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />

        {analyzing && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-amber-50 rounded-xl text-xs text-amber-700">
            <Loader2 className="w-3 h-3 animate-spin" /> Analyzing your document...
          </div>
        )}

        <div className="flex items-end gap-2 bg-white rounded-2xl border border-stone-200 p-1.5 focus-within:border-amber-300 transition-colors shadow-sm">
          <button onClick={toggleVoice} disabled={isTyping || analyzing}
            className={`h-9 w-9 rounded-xl flex items-center justify-center flex-none transition-all ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-stone-100 text-stone-600 hover:text-stone-600'
            } disabled:opacity-20`}>
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={() => {
              if (!hasFeature(state.subscription.tier, 'document_scanning')) {
                toast.error('Document scanning is available on the Life Pilot plan and above. Tap 👑 to upgrade.')
                return
              }
              fileInputRef.current?.click()
            }} disabled={isTyping || analyzing}
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-none hover:bg-stone-100 text-stone-600 hover:text-stone-600 transition-all disabled:opacity-20 relative">
            <Paperclip className="w-4 h-4" />
            {!hasFeature(state.subscription.tier, 'document_scanning') && <Lock className="w-2.5 h-2.5 absolute -top-0.5 -right-0.5 text-amber-500" />}
          </button>
          <Textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={isListening ? "Speak now..." : analyzing ? "Analyzing..." : "Tell me what to do..."}
            className="flex-1 border-0 focus-visible:ring-0 resize-none text-[15px] min-h-[40px] max-h-[120px] p-2 bg-transparent placeholder:text-stone-600"
            rows={1} disabled={isTyping || analyzing} />
          <Button onClick={() => handleSend()} disabled={!input.trim() || isTyping} size="sm"
            className="rounded-xl bg-stone-800 hover:bg-stone-700 text-white h-9 w-9 p-0 flex-none disabled:opacity-20">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function FormattedMessage({ content }: { content: string }) {
  const formatLine = (line: string): string => {
    return line
      // Markdown links: [text](url) → clickable links
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-600 underline underline-offset-2 hover:text-amber-800 font-medium">$1 ↗</a>')
      // Raw URLs
      .replace(/(?<!["=])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-amber-600 underline underline-offset-2 hover:text-amber-800">$1</a>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')
  }

  return (
    <>
      {content.split('\n').map((line, i) => {
        const fmt = formatLine(line)
        if (line.startsWith('• ') || line.startsWith('- '))
          return <div key={i} className="flex gap-2 ml-1 my-0.5"><span className="text-amber-500 flex-none">•</span><span dangerouslySetInnerHTML={{ __html: formatLine(line.replace(/^[•-]\s/, '')) }} /></div>
        if (/^\d+\.\s/.test(line)) {
          const n = line.match(/^(\d+)\./)?.[1]
          return <div key={i} className="flex gap-2 ml-1 my-0.5"><span className="text-amber-600 font-semibold flex-none text-xs bg-amber-50 w-5 h-5 rounded-full flex items-center justify-center mt-0.5">{n}</span><span dangerouslySetInnerHTML={{ __html: formatLine(line.replace(/^\d+\.\s/, '')) }} /></div>
        }
        if (!line.trim()) return <div key={i} className="h-2" />
        return <div key={i} dangerouslySetInnerHTML={{ __html: fmt }} />
      })}
    </>
  )
}
