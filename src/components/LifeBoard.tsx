// LifeBoard — redesigned 2026-10-30 (build 5).
//
// The old board stacked three competing systems (My Day / Prioritize /
// My Goals tabs, gradient category boxes, per-row icon buttons, inline
// link/edit panels) and every feature shouted at once — that's what
// read as amateur. The rethink:
//
//   One scroll, one job: what do I do today?
//   - Header: date + a single quiet count. No greeting card, no tabs.
//   - Up next: today's timed items (calendar events + timed tasks).
//   - Today: overdue, due today, then undated — chatbot adds land
//     here immediately (undated, newest first), so an add is visible
//     the moment the chat says it is.
//   - Habits: one compact list. Goals: quiet progress rows.
//   - Coming up: next 7 days, grouped by day. Later: beyond that.
//   - Completed: one toggle at the bottom.
//
// One visual language throughout: white cards, 1px stone borders,
// soft shadow, a single amber accent. Category is a small dot, not a
// gradient box. Every row has one primary action (its checkbox);
// everything else lives behind one tap that expands a single detail
// strip. The Eisenhower matrix UI is gone from the board (the data
// and the chat action are untouched — chat can still prioritize);
// Today sorts "do first" items to the top of the day instead.

import { useState, useEffect } from 'react'
import type { AppState, LifeItem, Goal, Habit } from '@/App'
import { Check, Trash2, Plus, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { useAuth } from '@/components/AuthGate'
import { apiBase } from '@/lib/api-base'

interface Props {
  state: AppState
  addItem: (item: LifeItem) => void
  updateItem: (id: string, updates: Partial<LifeItem>) => void
  removeItem: (id: string) => void
  addGoal: (goal: Goal) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  removeGoal: (id: string) => void
  toggleHabitDay?: (habitId: string, dateStr: string) => void
  addHabit?: (habit: Habit) => void
  updateHabit?: (id: string, updates: Partial<Habit>) => void
  removeHabit?: (id: string) => void
}

const CAT_DOT: Record<LifeItem['category'], string> = {
  health: 'bg-emerald-500', finance: 'bg-blue-500', home: 'bg-violet-500',
  family: 'bg-pink-500', meal: 'bg-amber-500', grocery: 'bg-lime-500',
  errand: 'bg-orange-500', general: 'bg-stone-300',
}

const HABIT_EMOJIS = ['✨', '💪', '🧘', '📚', '🏃', '💧', '🥗', '😴', '🎯', '🧠', '🌿', '❤️']

function getStreak(completions: string[]): number {
  let s = 0
  for (let i = 0; i < 90; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (completions.includes(d.toISOString().split('T')[0])) s++; else if (i > 0) break }
  return s
}

// "Oct 31" / "Sat, Oct 31" from a YYYY-MM-DD date (noon anchor avoids TZ shift).
function fmtShort(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtDay(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000)
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Google Calendar events for this user. null = not connected (or none fetched).
function useGoogleCalendarEvents() {
  const authUser: any = useAuth()
  const userId = authUser?.id
  const [events, setEvents] = useState<any[] | null>(null)
  useEffect(() => {
    if (!userId) return
    fetch(`${apiBase()}/api/google-calendar?userId=${userId}`)
      .then(r => r.json())
      .then(d => { if (d.events) setEvents(d.events) })
      .catch(() => {})
  }, [userId])
  return events
}

// ─── One task row. Checkbox completes; tap the row for a single
// detail strip (edit text, date, goal, delete). No per-row icons. ───
function TaskRow({ item, goals, updateItem, removeItem }: {
  item: LifeItem
  goals: Goal[]
  updateItem: (id: string, updates: Partial<LifeItem>) => void
  removeItem: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const [editDate, setEditDate] = useState(item.dueDate || '')
  const [editGoalId, setEditGoalId] = useState(item.goalId || '')
  const todayStr = new Date().toISOString().split('T')[0]
  const isOverdue = !!item.dueDate && item.dueDate < todayStr
  const linkedGoal = item.goalId ? goals.find(g => g.id === item.goalId) : null
  const activeGoals = goals.filter(g => g.status === 'active')

  const saveText = () => {
    if (editText.trim() && editText.trim() !== item.text) updateItem(item.id, { text: editText.trim() })
    else setEditText(item.text)
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm px-3.5 py-3">
      <div className="flex items-center gap-3">
        <button onClick={() => updateItem(item.id, { status: 'done', completedAt: new Date().toISOString() })}
          className={`w-5 h-5 rounded-full flex-none border-2 ${isOverdue ? 'border-red-300' : 'border-stone-300'} hover:border-emerald-400 transition-colors`} aria-label="Mark done" />
        <button onClick={() => { setOpen(!open); setEditText(item.text); setEditDate(item.dueDate || ''); setEditGoalId(item.goalId || '') }}
          className="flex-1 min-w-0 text-left">
          <span className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full flex-none ${CAT_DOT[item.category] || CAT_DOT.general}`} />
            <span className="text-[14px] text-stone-800 leading-snug truncate">{item.text}</span>
          </span>
          <span className="flex items-center gap-2 mt-0.5 ml-3.5">
            {isOverdue && <span className="text-[11px] text-red-500 font-medium">Overdue</span>}
            {item.dueDate && !isOverdue && item.dueDate !== todayStr && <span className="text-[11px] text-stone-400">{fmtShort(item.dueDate)}</span>}
            {item.dueTime && <span className="text-[11px] text-stone-400">{item.dueTime}</span>}
            {linkedGoal && <span className="text-[11px] text-stone-400 truncate">🎯 {linkedGoal.title}</span>}
          </span>
        </button>
        {open ? <ChevronUp className="w-4 h-4 text-stone-300 flex-none" /> : <ChevronDown className="w-4 h-4 text-stone-300 flex-none" />}
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-2.5">
          <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
            className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
            onKeyDown={e => { if (e.key === 'Enter') { saveText(); setOpen(false) } if (e.key === 'Escape') setOpen(false) }}
            onBlur={saveText} />
          <div className="flex gap-2">
            <input type="date" value={editDate} onChange={e => { setEditDate(e.target.value); updateItem(item.id, { dueDate: e.target.value || undefined }) }}
              className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white" />
            {activeGoals.length > 0 && (
              <select value={editGoalId} onChange={e => { setEditGoalId(e.target.value); updateItem(item.id, { goalId: e.target.value || undefined } as any) }}
                className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white">
                <option value="">No goal</option>
                {activeGoals.map(g => <option key={g.id} value={g.id}>🎯 {g.title}</option>)}
              </select>
            )}
          </div>
          <div className="flex justify-end">
            <button onClick={() => removeItem(item.id)} className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-red-500 px-2 py-1">
              <Trash2 className="w-3 h-3" /> Delete task
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── One habit row. Tap the check to toggle today; tap the name for
// the calendar; pencil for a compact edit. ───
function HabitRow({ habit, goals, toggleHabitDay, updateHabit, removeHabit, todayStr, now }: {
  habit: Habit
  goals: Goal[]
  toggleHabitDay?: (habitId: string, dateStr: string) => void
  updateHabit?: (id: string, updates: Partial<Habit>) => void
  removeHabit?: (id: string) => void
  todayStr: string
  now: Date
}) {
  const [showCal, setShowCal] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(habit.name)
  const [emoji, setEmoji] = useState(habit.emoji)
  const [freq, setFreq] = useState<Habit['frequency']>(habit.frequency || 'daily')
  const doneToday = habit.completions.includes(todayStr)
  const streak = getStreak(habit.completions)
  const habitGoal = goals.find(g => g.linkedHabitIds?.includes(habit.id))

  const weeks: { date: Date; ds: string }[][] = []
  if (showCal) {
    const ew = new Date(now); ew.setDate(now.getDate() + (6 - now.getDay()))
    const sg = new Date(ew); sg.setDate(ew.getDate() - 34)
    const cr = new Date(sg)
    for (let w = 0; w < 5; w++) {
      const wk: { date: Date; ds: string }[] = []
      for (let d = 0; d < 7; d++) { wk.push({ date: new Date(cr), ds: cr.toISOString().split('T')[0] }); cr.setDate(cr.getDate() + 1) }
      weeks.push(wk)
    }
  }
  const cs = new Set(habit.completions)

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm px-3.5 py-3">
      <div className="flex items-center gap-3">
        <button onClick={() => toggleHabitDay?.(habit.id, todayStr)}
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-none transition-all ${doneToday ? 'bg-emerald-500 text-white' : 'border-2 border-stone-200 hover:border-emerald-400'}`}>
          {doneToday && <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setShowCal(!showCal)} className="flex-1 min-w-0 text-left flex items-center gap-2">
          <span className="text-base">{habit.emoji}</span>
          <span className={`text-[14px] truncate ${doneToday ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{habit.name}</span>
          {streak >= 2 && <span className="text-[11px] font-semibold text-orange-500 flex-none">🔥 {streak}d</span>}
          {habitGoal && <span className="text-[11px] text-stone-400 truncate flex-none">🎯 {habitGoal.title}</span>}
        </button>
        <button onClick={() => { setEditing(!editing); setName(habit.name); setEmoji(habit.emoji); setFreq(habit.frequency || 'daily') }}
          className="p-1 text-stone-300 hover:text-stone-500 flex-none" title="Edit habit">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-2.5">
          <div className="flex gap-2">
            <select value={emoji} onChange={e => setEmoji(e.target.value)}
              className="text-lg border border-stone-200 rounded-xl px-1.5 py-1.5 bg-white w-12 text-center">
              {HABIT_EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input value={name} onChange={e => setName(e.target.value)}
              className="flex-1 text-sm border border-stone-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
              onKeyDown={e => { if (e.key === 'Escape') setEditing(false) }} />
          </div>
          <div className="flex gap-2">
            <select value={freq} onChange={e => setFreq(e.target.value as any)}
              className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white">
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
            <button onClick={() => { if (name.trim()) updateHabit?.(habit.id, { name: name.trim(), emoji: emoji || '✨', frequency: freq }); setEditing(false) }}
              className="flex-1 py-2 rounded-xl bg-stone-800 text-white text-xs font-medium">Save</button>
            <button onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl bg-stone-100 text-stone-500 text-xs">Cancel</button>
          </div>
          <div className="flex justify-end">
            <button onClick={() => removeHabit?.(habit.id)} className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-red-500 px-2 py-1">
              <Trash2 className="w-3 h-3" /> Delete habit
            </button>
          </div>
        </div>
      )}

      {showCal && !editing && (
        <div className="mt-3 pt-3 border-t border-stone-100">
          <div className="grid grid-cols-7 gap-0.5 mb-1">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="text-center text-[9px] font-semibold text-stone-400">{d}</div>)}</div>
          {weeks.map((wk, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">{wk.map(({ date, ds }) => {
              const dn = cs.has(ds); const it = ds === todayStr; const fu = date > now
              return <button key={ds} onClick={() => !fu && toggleHabitDay?.(habit.id, ds)} disabled={fu}
                className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium ${fu ? 'bg-stone-100 text-stone-300' : dn ? 'bg-emerald-400 text-white' : it ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'bg-stone-50 text-stone-400'}`}>{date.getDate()}</button>
            })}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── One goal row. Tap to expand its tasks and habits. ───
function GoalCard({ goal, items, habits, toggleHabitDay, updateItem, updateGoal, removeGoal, todayStr }: {
  goal: Goal
  items: LifeItem[]
  habits: Habit[]
  toggleHabitDay?: (habitId: string, dateStr: string) => void
  updateItem: (id: string, updates: Partial<LifeItem>) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  removeGoal: (id: string) => void
  todayStr: string
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal.title)
  const [date, setDate] = useState(goal.targetDate || '')
  const goalTasks = items.filter(i => i.goalId === goal.id)
  const goalHabits = habits.filter(h => goal.linkedHabitIds?.includes(h.id))
  const tasksDone = goalTasks.filter(t => t.status === 'done').length
  const totalSteps = goalTasks.length + goal.milestones.length
  const completedSteps = tasksDone + goal.milestones.filter(m => m.completed).length
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  const daysLeft = goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-base flex-none">🎯</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-medium text-stone-800 truncate">{goal.title}</span>
            <span className="block text-[11px] text-stone-400 mt-0.5">
              {totalSteps > 0 ? `${completedSteps}/${totalSteps} steps` : 'No steps yet'}
              {daysLeft !== null && <> · {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}</>}
            </span>
          </span>
          <span className="text-[13px] font-semibold text-stone-600 flex-none">{pct}%</span>
          {open ? <ChevronUp className="w-4 h-4 text-stone-300 flex-none" /> : <ChevronDown className="w-4 h-4 text-stone-300 flex-none" />}
        </div>
        <div className="mt-2.5 h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-2">
          {goalTasks.map(t => (
            <div key={t.id} className="flex items-center gap-2.5">
              <button onClick={() => updateItem(t.id, t.status === 'done' ? { status: 'pending', completedAt: undefined } : { status: 'done', completedAt: new Date().toISOString() })}
                className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-none ${t.status === 'done' ? 'bg-emerald-500 text-white' : 'border-2 border-stone-300'}`}>
                {t.status === 'done' && <Check className="w-2.5 h-2.5" />}
              </button>
              <span className={`text-[13px] flex-1 ${t.status === 'done' ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{t.text}</span>
            </div>
          ))}
          {goalHabits.map(h => {
            const dn = h.completions.includes(todayStr)
            return (
              <div key={h.id} className="flex items-center gap-2.5">
                <button onClick={() => toggleHabitDay?.(h.id, todayStr)} className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-none ${dn ? 'bg-emerald-500 text-white' : 'border-2 border-stone-300'}`}>{dn && <Check className="w-2.5 h-2.5" />}</button>
                <span className="text-base">{h.emoji}</span>
                <span className={`text-[13px] flex-1 ${dn ? 'text-stone-400' : 'text-stone-700'}`}>{h.name}</span>
              </div>
            )
          })}
          {goalTasks.length === 0 && goalHabits.length === 0 && (
            <p className="text-xs text-stone-400 py-1">Ask the AI to break this goal into tasks and habits.</p>
          )}
          {editing ? (
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
                className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white" />
              <div className="flex gap-2">
                <button onClick={() => { if (title.trim()) updateGoal(goal.id, { title: title.trim(), targetDate: date || undefined }); setEditing(false) }}
                  className="flex-1 py-2 rounded-xl bg-stone-800 text-white text-xs font-medium">Save</button>
                <button onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl bg-stone-100 text-stone-500 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-2 border-t border-stone-100">
              <button onClick={() => { setEditing(true); setTitle(goal.title); setDate(goal.targetDate || '') }}
                className="flex-1 py-2 rounded-xl bg-stone-100 text-stone-500 text-xs font-medium">Edit</button>
              <button onClick={() => { updateGoal(goal.id, { status: 'completed', completedAt: new Date().toISOString() }); setOpen(false) }}
                className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium">Complete</button>
              <button onClick={() => { if (confirm('Delete this goal?')) { removeGoal(goal.id); setOpen(false) } }}
                className="px-3 py-2 rounded-xl bg-white text-red-500 text-xs font-medium border border-red-200">Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function LifeBoard({ state, addItem, updateItem, removeItem, addGoal, updateGoal, removeGoal, toggleHabitDay, addHabit, updateHabit, removeHabit }: Props) {
  const todayStr = new Date().toISOString().split('T')[0]
  const now = new Date()
  const pending = state.items.filter(i => i.status === 'pending')
  const done = state.items.filter(i => i.status === 'done')
  const goals = state.goals || []
  const habits = state.habits || []
  const events = useGoogleCalendarEvents()

  const [showAddTask, setShowAddTask] = useState(false)
  const [newText, setNewText] = useState('')
  const [newDate, setNewDate] = useState(todayStr)
  const [showAddHabit, setShowAddHabit] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitEmoji, setNewHabitEmoji] = useState('✨')
  const [newHabitFreq, setNewHabitFreq] = useState<Habit['frequency']>('daily')
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDate, setGoalDate] = useState('')
  const [showDone, setShowDone] = useState(false)

  // ── Today: overdue, then due today (do-first on top), then undated
  // (newest first so a just-added chatbot item is immediately visible).
  const overdue = pending.filter(i => i.dueDate && i.dueDate < todayStr).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
  const dueToday = pending.filter(i => i.dueDate === todayStr).sort((a, b) =>
    ((a.eisenhower === 'do' ? 0 : 1) - (b.eisenhower === 'do' ? 0 : 1)) || (a.createdAt < b.createdAt ? -1 : 1))
  const undated = pending.filter(i => !i.dueDate).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
  const todayTasks = [...overdue, ...dueToday, ...undated]

  // ── Calendar events, split today / next 7 days.
  const isoDay = (start: string) => new Date(start).toISOString().split('T')[0]
  const todayEvents = (events || []).filter(e => isoDay(e.start) === todayStr)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const futureEvents = (events || []).filter(e => { const d = isoDay(e.start); return d > todayStr && daysBetween(todayStr, d) <= 7 })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  // ── Up next: today's timed items — calendar events + timed tasks.
  const timedToday = dueToday.filter(i => i.dueTime)
  const upNext: { key: string; time: string; title: string }[] = [
    ...todayEvents.map(e => ({
      key: `ev-${e.id}`,
      time: e.allDay ? 'All day' : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      title: e.title,
    })),
    ...timedToday.map(i => ({ key: `t-${i.id}`, time: i.dueTime!, title: i.text })),
  ].sort((a, b) => (a.time < b.time ? -1 : 1))

  // ── Coming up: next 7 days, grouped by day (tasks + calendar events).
  const comingDays: { day: string; rows: { key: string; kind: 'task' | 'event'; item?: LifeItem; time?: string; title: string }[] }[] = []
  for (let n = 1; n <= 7; n++) {
    const day = addDays(todayStr, n)
    const rows: { key: string; kind: 'task' | 'event'; item?: LifeItem; time?: string; title: string }[] = []
    futureEvents.filter(e => isoDay(e.start) === day).forEach(e => rows.push({
      key: `ev-${e.id}`, kind: 'event',
      time: e.allDay ? 'All day' : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      title: e.title,
    }))
    pending.filter(i => i.dueDate === day).forEach(i => rows.push({ key: `t-${i.id}`, kind: 'task', item: i, title: i.text }))
    if (rows.length > 0) comingDays.push({ day, rows })
  }
  const later = pending.filter(i => i.dueDate && daysBetween(todayStr, i.dueDate) > 7)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const doneToday = done.filter(i => i.completedAt && i.completedAt.startsWith(todayStr)).length
  const dateLine = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const submitTask = () => {
    if (!newText.trim()) return
    addItem({ id: `item-${Date.now()}`, text: newText.trim(), category: 'general', status: 'pending', createdAt: new Date().toISOString(), snoozeCount: 0, dueDate: newDate || undefined } as any)
    setNewText(''); setNewDate(todayStr); setShowAddTask(false)
  }
  const submitHabit = () => {
    if (!newHabitName.trim()) return
    addHabit?.({
      id: `habit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newHabitName.trim(), emoji: newHabitEmoji || '✨', frequency: newHabitFreq,
      completions: [], createdAt: new Date().toISOString(), streakBest: 0,
    })
    setNewHabitName(''); setNewHabitEmoji('✨'); setNewHabitFreq('daily'); setShowAddHabit(false)
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      {/* Header — date + one quiet count. */}
      <div>
        <h1 className="text-[22px] font-bold text-stone-800 leading-tight" style={{ fontFamily: "'Georgia', serif" }}>{dateLine}</h1>
        <p className="text-[13px] text-stone-500 mt-0.5">
          {todayTasks.length === 0
            ? 'Nothing on the board — enjoy the clear day.'
            : `${todayTasks.length} to do${doneToday > 0 ? ` · ${doneToday} done` : ''}`}
        </p>
      </div>

      {/* Up next — today's timed items only. */}
      {upNext.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Up next</p>
          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm divide-y divide-stone-100">
            {upNext.map(u => (
              <div key={u.key} className="flex items-baseline gap-3 px-3.5 py-2.5">
                <span className="text-[12px] text-stone-400 w-[68px] flex-none">{u.time}</span>
                <span className="text-[14px] text-stone-800 truncate">{u.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Today */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Today</p>
          <button onClick={() => setShowAddTask(!showAddTask)}
            className="flex items-center gap-1 text-[12px] font-medium text-stone-500 hover:text-stone-800 px-2 py-1 rounded-lg hover:bg-stone-100">
            <Plus className="w-3.5 h-3.5" /> Add task
          </button>
        </div>

        {showAddTask && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-3.5 mb-3 space-y-2.5">
            <input value={newText} onChange={e => setNewText(e.target.value)} placeholder="What needs to be done?"
              className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') submitTask() }} />
            <div className="flex gap-2">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white" />
              <button onClick={submitTask} className="flex-1 py-2 rounded-xl bg-stone-800 text-white text-sm font-medium">Add</button>
              <button onClick={() => { setShowAddTask(false); setNewText('') }} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-500 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {todayTasks.length === 0 && !showAddTask ? (
          <p className="text-[13px] text-stone-400 py-2">Nothing due today. Add a task, or ask the AI to plan your day.</p>
        ) : (
          <div className="space-y-2">
            {todayTasks.map(item => (
              <TaskRow key={item.id} item={item} goals={goals} updateItem={updateItem} removeItem={removeItem} />
            ))}
          </div>
        )}
      </section>

      {/* Habits — one compact list. */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Habits</p>
          <button onClick={() => { setShowAddHabit(!showAddHabit); setNewHabitName(''); setNewHabitEmoji('✨') }}
            className="flex items-center gap-1 text-[12px] font-medium text-stone-500 hover:text-stone-800 px-2 py-1 rounded-lg hover:bg-stone-100">
            <Plus className="w-3.5 h-3.5" /> Add habit
          </button>
        </div>

        {showAddHabit && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-3.5 mb-3 space-y-2.5">
            <div className="flex gap-2">
              <select value={newHabitEmoji} onChange={e => setNewHabitEmoji(e.target.value)}
                className="text-lg border border-stone-200 rounded-xl px-1.5 py-1.5 bg-white w-12 text-center">
                {HABIT_EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <input value={newHabitName} onChange={e => setNewHabitName(e.target.value)} placeholder="Habit name…"
                className="flex-1 text-sm border border-stone-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') submitHabit() }} />
            </div>
            <div className="flex gap-2">
              <select value={newHabitFreq} onChange={e => setNewHabitFreq(e.target.value as any)}
                className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white">
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
              </select>
              <button onClick={submitHabit} className="flex-1 py-2 rounded-xl bg-stone-800 text-white text-xs font-medium">Add Habit</button>
              <button onClick={() => setShowAddHabit(false)} className="px-3 py-2 rounded-xl bg-stone-100 text-stone-400 text-xs">Cancel</button>
            </div>
          </div>
        )}

        {habits.length === 0 && !showAddHabit ? (
          <p className="text-[13px] text-stone-400 py-2">No habits yet — add one above, or ask the AI.</p>
        ) : (
          <div className="space-y-2">
            {habits.map(h => (
              <HabitRow key={h.id} habit={h} goals={goals} toggleHabitDay={toggleHabitDay} updateHabit={updateHabit} removeHabit={removeHabit} todayStr={todayStr} now={now} />
            ))}
          </div>
        )}
      </section>

      {/* Goals — quiet progress rows. */}
      {goals.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Goals</p>
            <button onClick={() => setShowAddGoal(!showAddGoal)}
              className="flex items-center gap-1 text-[12px] font-medium text-stone-500 hover:text-stone-800 px-2 py-1 rounded-lg hover:bg-stone-100">
              <Plus className="w-3.5 h-3.5" /> Add goal
            </button>
          </div>
          <div className="space-y-2">
            {activeGoals.map(g => (
              <GoalCard key={g.id} goal={g} items={state.items} habits={habits} toggleHabitDay={toggleHabitDay} updateItem={updateItem} updateGoal={updateGoal} removeGoal={removeGoal} todayStr={todayStr} />
            ))}
            {completedGoals.map(g => (
              <div key={g.id} className="flex items-center gap-2.5 px-3.5 py-3 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                <Check className="w-4 h-4 text-emerald-500 flex-none" />
                <span className="text-[14px] text-emerald-700 line-through flex-1 truncate">{g.title}</span>
                <button onClick={() => removeGoal(g.id)} className="text-emerald-300 hover:text-red-400 flex-none"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add goal form (shown from the Goals header; also offered when no goals exist). */}
      {(showAddGoal || goals.length === 0) && (
        <section>
          {goals.length === 0 && <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Goals</p>}
          {showAddGoal ? (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-3.5 space-y-2.5">
              <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="What do you want to achieve?"
                className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { if (goalTitle.trim()) { addGoal({ id: `goal-${Date.now()}`, title: goalTitle.trim(), targetDate: goalDate || undefined, category: 'general', createdAt: new Date().toISOString(), milestones: [], linkedHabitIds: [], linkedTaskIds: [], status: 'active' }); setGoalTitle(''); setGoalDate(''); setShowAddGoal(false) } } }} />
              <div className="flex gap-2">
                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)}
                  className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2 bg-white" />
                <button onClick={() => {
                  if (!goalTitle.trim()) return
                  addGoal({ id: `goal-${Date.now()}`, title: goalTitle.trim(), targetDate: goalDate || undefined, category: 'general', createdAt: new Date().toISOString(), milestones: [], linkedHabitIds: [], linkedTaskIds: [], status: 'active' })
                  setGoalTitle(''); setGoalDate(''); setShowAddGoal(false)
                }} className="flex-1 py-2 rounded-xl bg-stone-800 text-white text-sm font-medium">Create</button>
                <button onClick={() => { setShowAddGoal(false); setGoalTitle('') }} className="px-4 py-2 rounded-xl bg-stone-100 text-stone-500 text-sm">Cancel</button>
              </div>
              <p className="text-[11px] text-stone-400 text-center">Or tell the AI: "Help me plan a goal to learn Spanish in 3 months"</p>
            </div>
          ) : (
            <button onClick={() => setShowAddGoal(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-amber-300 hover:text-amber-600 transition-all">
              <span className="text-sm font-medium">Set a New Goal</span>
            </button>
          )}
        </section>
      )}

      {/* Coming up — next 7 days, grouped by day. */}
      {comingDays.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Coming up</p>
          <div className="space-y-4">
            {comingDays.map(({ day, rows }) => (
              <div key={day}>
                <p className="text-[12px] font-medium text-stone-500 mb-1.5">
                  {day === addDays(todayStr, 1) ? 'Tomorrow' : fmtDay(day)}
                </p>
                <div className="space-y-2">
                  {rows.map(r => r.kind === 'event' ? (
                    <div key={r.key} className="bg-white rounded-2xl border border-stone-200/80 shadow-sm px-3.5 py-3 flex items-baseline gap-3">
                      <span className="text-[12px] text-stone-400 w-[68px] flex-none">{r.time}</span>
                      <span className="text-[14px] text-stone-800 truncate">{r.title}</span>
                    </div>
                  ) : (
                    <TaskRow key={r.key} item={r.item!} goals={goals} updateItem={updateItem} removeItem={removeItem} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Later — beyond 7 days, so nothing ever disappears. */}
      {later.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Later</p>
          <div className="space-y-2">
            {later.map(item => (
              <TaskRow key={item.id} item={item} goals={goals} updateItem={updateItem} removeItem={removeItem} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      <div className="flex justify-center pt-1">
        <button onClick={() => setShowDone(!showDone)} className={`text-xs font-medium px-4 py-2 rounded-xl transition-all ${showDone ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
          {showDone ? 'Hide completed' : `${done.length} completed`}
        </button>
      </div>
      {showDone && (
        <div className="space-y-1.5">
          {done.slice(0, 20).map(item => (
            <div key={item.id} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white rounded-2xl border border-stone-100">
              <button onClick={() => updateItem(item.id, { status: 'pending', completedAt: undefined })} className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-none"><Check className="w-3 h-3" /></button>
              <span className="text-[13px] text-stone-400 line-through flex-1 truncate">{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && habits.length === 0 && goals.length === 0 && !showAddTask && (
        <div className="text-center py-10">
          <p className="text-sm font-medium text-stone-600 mb-1">Your day is clear</p>
          <p className="text-xs text-stone-400">Add a task or habit to get started, or ask the AI to plan your day.</p>
        </div>
      )}
    </div>
  )
}
