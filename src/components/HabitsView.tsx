import { useState } from 'react'
import type { AppState, Habit } from '@/App'
import { uid } from '@/lib/ai-engine'
import { Plus, Flame, Check, ChevronDown, ChevronUp, Trophy, Calendar, Target, Clock } from 'lucide-react'

interface Props {
  state: AppState
  addHabit: (habit: Habit) => void
  toggleHabitDay: (habitId: string, dateStr: string) => void
  removeHabit: (id: string) => void
  updateHabit?: (id: string, updates: Partial<Habit>) => void
}

const HABIT_EMOJIS = ['🧘', '💪', '📖', '💧', '🏃', '🎯', '✍️', '😴', '🥗', '🧠', '🎨', '💊', '🚶', '🎵', '🌱', '📝']
const CATEGORIES: { id: Habit['category']; label: string; emoji: string }[] = [
  { id: 'morning', label: 'Morning', emoji: '🌅' },
  { id: 'health', label: 'Health', emoji: '❤️' },
  { id: 'fitness', label: 'Fitness', emoji: '💪' },
  { id: 'mindfulness', label: 'Mindfulness', emoji: '🧘' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'evening', label: 'Evening', emoji: '🌙' },
  { id: 'other', label: 'Other', emoji: '✨' },
]
const FREQ_OPTIONS: { id: Habit['frequency']; label: string }[] = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Once a week' },
  { id: 'custom', label: 'Custom days' },
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getStreak(completions: string[]): number {
  if (completions.length === 0) return 0
  const sorted = [...completions].sort().reverse()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (!sorted.includes(today) && !sorted.includes(yesterday)) return 0
  let streak = 0
  let checkDate = sorted.includes(today) ? new Date() : new Date(Date.now() - 86400000)
  while (true) {
    const ds = checkDate.toISOString().split('T')[0]
    if (sorted.includes(ds)) { streak++; checkDate = new Date(checkDate.getTime() - 86400000) }
    else break
  }
  return streak
}

function getLast7Days(): string[] {
  const days = []
  for (let i = 6; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().split('T')[0])
  return days
}

// Returns the current calendar week (Sun-Sat) with labels
function getCurrentWeekDays(): { date: string; dayLabel: string; dateLabel: string; isToday: boolean }[] {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const dayOfWeek = today.getDay() // 0=Sun, 6=Sat
  const days: { date: string; dayLabel: string; dateLabel: string; isToday: boolean }[] = []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - dayOfWeek + i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      date: dateStr,
      dayLabel: dayNames[i],
      dateLabel: String(d.getDate()),
      isToday: dateStr === todayStr,
    })
  }
  return days
}

function getLast30Days(): string[] {
  const days = []
  for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86400000).toISOString().split('T')[0])
  return days
}

function getWeeklyRate(completions: string[], days: number = 7): number {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
  const recent = completions.filter(d => d >= cutoff)
  return Math.round((recent.length / days) * 100)
}

export function HabitsView({ state, addHabit, toggleHabitDay, removeHabit, updateHabit }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('🎯')
  const [newNote, setNewNote] = useState('')
  const [newCategory, setNewCategory] = useState<Habit['category']>('other')
  const [newFrequency, setNewFrequency] = useState<Habit['frequency']>('daily')
  const [newCustomDays, setNewCustomDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [newTarget, setNewTarget] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [newReminder, setNewReminder] = useState('')
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')
  const [viewMode, setViewMode] = useState<'today' | 'heatmap' | 'stats'>('today')

  const today = new Date().toISOString().split('T')[0]
  const last7 = getLast7Days()
  const last30 = getLast30Days()

  const handleAdd = () => {
    if (!newName.trim()) return
    addHabit({
      id: uid(), name: newName.trim(), emoji: newEmoji,
      frequency: newFrequency,
      customDays: newFrequency === 'custom' ? newCustomDays : undefined,
      completions: [], createdAt: new Date().toISOString(), streakBest: 0,
      notes: newNote.trim() || undefined,
      category: newCategory,
      reminderTime: newReminder || undefined,
      targetValue: newTarget ? Number(newTarget) : undefined,
      targetUnit: newUnit || undefined,
    })
    setNewName(''); setNewNote(''); setNewTarget(''); setNewUnit(''); setNewReminder('')
    setShowAdd(false)
  }

  const isPremium = state.subscription.tier === 'premium' || state.subscription.tier === 'enterprise'

  if (!isPremium) {
    return (
      <div className="p-4 text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <Flame className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-lg font-semibold text-stone-800 mb-2" style={{ fontFamily: "'Georgia', serif" }}>Habit Tracking</h3>
        <p className="text-base text-stone-600 max-w-xs mx-auto mb-4">Build streaks, track consistency, and see your habits connect to your journal themes.</p>
        <p className="text-sm text-amber-600 font-semibold">Available on Inner Circle & Guided plans</p>
      </div>
    )
  }

  // Stats
  const totalHabits = state.habits.length
  const doneToday = state.habits.filter(h => h.completions.includes(today)).length
  const longestStreak = Math.max(0, ...state.habits.map(h => Math.max(getStreak(h.completions), h.streakBest)))
  const weeklyConsistency = totalHabits > 0 ? Math.round(state.habits.reduce((sum, h) => sum + getWeeklyRate(h.completions), 0) / totalHabits) : 0

  // Group by category
  const grouped: Record<string, Habit[]> = {}
  state.habits.forEach(h => {
    const cat = h.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(h)
  })

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="mb-2">
        <h2 className="text-xl font-bold text-stone-800 mb-1" style={{ fontFamily: "'Georgia', serif" }}>Habits</h2>
        <p className="text-sm text-stone-600">Small actions, compounded daily</p>
      </div>

      {/* Stats overview */}
      {totalHabits > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-stone-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">{doneToday}/{totalHabits}</p>
            <p className="text-xs text-stone-600">Today</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-orange-500">{longestStreak}</p>
            <p className="text-xs text-stone-600">Best streak</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-100 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-500">{weeklyConsistency}%</p>
            <p className="text-xs text-stone-600">This week</p>
          </div>
        </div>
      )}

      {/* View toggle */}
      {totalHabits > 0 && (
        <div className="flex bg-stone-100 rounded-xl p-1 gap-1">
          {[
            { id: 'today' as const, label: 'Today', icon: Check },
            { id: 'heatmap' as const, label: '30 Days', icon: Calendar },
            { id: 'stats' as const, label: 'Insights', icon: Trophy },
          ].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                viewMode === v.id ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
              }`}>
              <v.icon className="w-3.5 h-3.5" /> {v.label}
            </button>
          ))}
        </div>
      )}

      {/* HEATMAP VIEW */}
      {viewMode === 'heatmap' && totalHabits > 0 && (
        <div className="space-y-4">
          {state.habits.map(habit => {
            const completionSet = new Set(habit.completions)
            const streak = getStreak(habit.completions)
            return (
              <div key={habit.id} className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{habit.emoji}</span>
                  <p className="text-sm font-semibold text-stone-800">{habit.name}</p>
                  {streak >= 2 && <span className="text-xs font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">🔥 {streak}d</span>}
                  <span className="text-xs text-stone-500 ml-auto">{getWeeklyRate(habit.completions, 30)}%</span>
                </div>

                {(() => {
                  const todayDate = new Date()
                  const todayStr = todayDate.toISOString().split('T')[0]
                  const endOfWeek = new Date(todayDate)
                  endOfWeek.setDate(todayDate.getDate() + (6 - todayDate.getDay()))
                  const startOfGrid = new Date(endOfWeek)
                  startOfGrid.setDate(endOfWeek.getDate() - 34)

                  const weeks: { date: Date; dateStr: string }[][] = []
                  const cursor = new Date(startOfGrid)
                  for (let w = 0; w < 5; w++) {
                    const week: { date: Date; dateStr: string }[] = []
                    for (let d = 0; d < 7; d++) {
                      week.push({ date: new Date(cursor), dateStr: cursor.toISOString().split('T')[0] })
                      cursor.setDate(cursor.getDate() + 1)
                    }
                    weeks.push(week)
                  }
                  const allDates = weeks.flat().map(d => d.dateStr)
                  const completedInWindow = allDates.filter(d => completionSet.has(d)).length

                  return (
                    <>
                      <div className="grid grid-cols-7 gap-1 mb-1 pl-9">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                          <div key={i} className="text-center text-[9px] font-semibold text-stone-400">{d}</div>
                        ))}
                      </div>
                      {weeks.map((week, wi) => {
                        const showMonth = wi === 0 || week[0].date.getDate() <= 7
                        return (
                          <div key={wi} className="flex items-center gap-1 mb-1">
                            <div className="w-8 text-[9px] text-stone-400 font-medium text-right pr-1 flex-none">
                              {showMonth ? week[0].date.toLocaleDateString('en-US', { month: 'short' }) : ''}
                            </div>
                            <div className="grid grid-cols-7 gap-1 flex-1">
                              {week.map(({ date, dateStr }) => {
                                const done = completionSet.has(dateStr)
                                const isToday = dateStr === todayStr
                                const isFuture = date > todayDate
                                return (
                                  <button key={dateStr} onClick={() => !isFuture && toggleHabitDay(habit.id, dateStr)} disabled={isFuture}
                                    className={`aspect-square rounded-md flex items-center justify-center text-[11px] font-medium transition-all ${
                                      isFuture ? 'bg-stone-50 text-stone-300'
                                      : done ? 'bg-emerald-400 text-white shadow-sm'
                                      : isToday ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                                      : 'bg-stone-50 text-stone-500 hover:bg-stone-100'
                                    }`}>
                                    {date.getDate()}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex justify-between mt-2 text-[10px] text-stone-400 pl-9">
                        <span>{weeks[0][0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weeks[4][6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <span className="font-medium text-emerald-600">{completedInWindow} of 35 days</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      {/* INSIGHTS VIEW */}
      {viewMode === 'stats' && totalHabits > 0 && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <h3 className="font-semibold text-stone-800 text-base mb-3" style={{ fontFamily: "'Georgia', serif" }}>Weekly Report</h3>
            {state.habits.map(habit => {
              const rate = getWeeklyRate(habit.completions)
              const streak = getStreak(habit.completions)
              return (
                <div key={habit.id} className="flex items-center gap-3 py-2 border-b border-stone-50 last:border-0">
                  <span className="text-lg">{habit.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-800">{habit.name}</p>
                    <div className="w-full h-2 bg-stone-100 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(rate, 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-stone-700">{rate}%</p>
                    {streak > 0 && <p className="text-xs text-orange-500">{streak}d streak</p>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Best and worst habits */}
          {state.habits.length >= 2 && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3">
                <p className="text-xs text-emerald-700 font-medium mb-1">💪 Strongest</p>
                {(() => {
                  const best = [...state.habits].sort((a, b) => getWeeklyRate(b.completions) - getWeeklyRate(a.completions))[0]
                  return <p className="text-sm font-semibold text-emerald-800">{best.emoji} {best.name}</p>
                })()}
              </div>
              <div className="bg-amber-50 rounded-xl border border-amber-100 p-3">
                <p className="text-xs text-amber-700 font-medium mb-1">🎯 Needs focus</p>
                {(() => {
                  const worst = [...state.habits].sort((a, b) => getWeeklyRate(a.completions) - getWeeklyRate(b.completions))[0]
                  return <p className="text-sm font-semibold text-amber-800">{worst.emoji} {worst.name}</p>
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TODAY VIEW — main habit cards */}
      {viewMode === 'today' && (
        <div className="space-y-3">
          {Object.entries(grouped).map(([catId, habits]) => {
            const catInfo = CATEGORIES.find(c => c.id === catId)
            return (
              <div key={catId}>
                {Object.keys(grouped).length > 1 && (
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span>{catInfo?.emoji || '✨'}</span> {catInfo?.label || 'Other'}
                  </p>
                )}
                {habits.map(habit => {
                  const streak = getStreak(habit.completions)
                  const isDoneToday = habit.completions.includes(today)
                  const isExpanded = expandedHabit === habit.id
                  const rate = getWeeklyRate(habit.completions)

                  return (
                    <div key={habit.id} className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm mb-2">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{habit.emoji}</span>
                        <div className="flex-1">
                          <p className="text-base font-semibold text-stone-800">{habit.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {streak > 0 && (
                              <span className="text-sm text-orange-600 flex items-center gap-1 font-medium">
                                <Flame className="w-3.5 h-3.5" /> {streak}d
                              </span>
                            )}
                            {habit.targetValue && habit.targetUnit && (
                              <span className="text-xs text-blue-600 flex items-center gap-1">
                                <Target className="w-3 h-3" /> {habit.targetValue} {habit.targetUnit}
                              </span>
                            )}
                            {habit.reminderTime && (
                              <span className="text-xs text-stone-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {habit.reminderTime}
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => toggleHabitDay(habit.id, today)}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                            isDoneToday ? 'bg-emerald-500 text-white shadow-md scale-105' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          }`}>
                          <Check className="w-6 h-6" />
                        </button>
                      </div>

                      {habit.notes && !isExpanded && (
                        <p className="text-sm text-stone-600 mb-2 italic">"{habit.notes}"</p>
                      )}

                      {/* Weekly tracker — Sun to Sat with dates */}
                      <div className="flex gap-1">
                        {getCurrentWeekDays().map(({ date, dayLabel, dateLabel, isToday }) => {
                          const done = habit.completions.includes(date)
                          return (
                            <button key={date} onClick={() => toggleHabitDay(habit.id, date)}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-all ${
                                done ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' 
                                : isToday ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' 
                                : 'bg-stone-50 text-stone-500'
                              }`}>
                              <span className="text-[10px] font-semibold uppercase">{dayLabel}</span>
                              <span className={`text-sm ${done ? 'text-emerald-600' : ''}`}>{done ? '✓' : dateLabel}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Expand for edit */}
                      <button onClick={() => { setExpandedHabit(isExpanded ? null : habit.id); setEditNote(habit.notes || '') }}
                        className="flex items-center gap-1 mt-2 text-xs text-stone-500 hover:text-stone-700 font-medium">
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Collapse' : 'Edit & options'}
                      </button>

                      {isExpanded && (
                        <HabitEditForm habit={habit} editNote={editNote} setEditNote={setEditNote}
                          updateHabit={updateHabit} removeHabit={removeHabit}
                          onClose={() => setExpandedHabit(null)} />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Add habit */}
      {showAdd ? (
        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-stone-800 text-base">New Habit</h3>

          {/* Emoji picker */}
          <div className="flex gap-2 flex-wrap">
            {HABIT_EMOJIS.map(e => (
              <button key={e} onClick={() => setNewEmoji(e)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${newEmoji === e ? 'bg-amber-100 border-2 border-amber-300' : 'bg-stone-50'}`}>
                {e}
              </button>
            ))}
          </div>

          {/* Name */}
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Habit name (e.g., Meditate 10 min)"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400" />

          {/* Category */}
          <div>
            <p className="text-xs font-medium text-stone-600 mb-2">Category</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setNewCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${newCategory === c.id ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-stone-50 text-stone-600'}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <p className="text-xs font-medium text-stone-600 mb-2">How often?</p>
            <div className="flex gap-2 flex-wrap">
              {FREQ_OPTIONS.map(f => (
                <button key={f.id} onClick={() => setNewFrequency(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${newFrequency === f.id ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-stone-50 text-stone-600'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {newFrequency === 'custom' && (
              <div className="flex gap-2 mt-2">
                {DAY_NAMES.map((d, i) => (
                  <button key={d} onClick={() => setNewCustomDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                    className={`w-10 h-10 rounded-lg text-xs font-medium ${newCustomDays.includes(i) ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-600'}`}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target (optional) */}
          <div>
            <p className="text-xs font-medium text-stone-600 mb-2">Track a number? (optional)</p>
            <div className="flex gap-2">
              <input value={newTarget} onChange={e => setNewTarget(e.target.value)} type="number" placeholder="e.g., 8"
                className="w-20 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-800 text-center" />
              <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="e.g., glasses, minutes, pages"
                className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-800" />
            </div>
          </div>

          {/* Reminder time */}
          <div>
            <p className="text-xs font-medium text-stone-600 mb-2">Reminder time (optional)</p>
            <input value={newReminder} onChange={e => setNewReminder(e.target.value)} type="time"
              className="px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-800" />
          </div>

          {/* Notes */}
          <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Why this habit matters to you..."
            rows={2} className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-700 placeholder:text-stone-400 resize-none" />

          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-stone-100 text-sm text-stone-600 font-medium">Cancel</button>
            <button onClick={handleAdd} disabled={!newName.trim()} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium disabled:opacity-40">Add Habit</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl border border-dashed border-stone-200 hover:border-amber-300 transition-all shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center"><Plus className="w-6 h-6 text-amber-500" /></div>
          <div className="text-left">
            <p className="text-base font-semibold text-stone-800">Add a habit</p>
            <p className="text-sm text-stone-500">Build consistency one day at a time</p>
          </div>
        </button>
      )}

      {state.habits.length === 0 && !showAdd && (
        <div className="text-center py-8">
          <p className="text-base text-stone-600 max-w-xs mx-auto">Track the daily actions that shape your life. Each check mark is proof that you're becoming who you want to be.</p>
        </div>
      )}
    </div>
  )
}

// ─── HABIT EDIT FORM ─────────────────────────────────────────────

function HabitEditForm({ habit, editNote, setEditNote, updateHabit, removeHabit, onClose }: {
  habit: Habit
  editNote: string
  setEditNote: (s: string) => void
  updateHabit?: (id: string, updates: Partial<Habit>) => void
  removeHabit: (id: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(habit.name)
  const [emoji, setEmoji] = useState(habit.emoji)
  const [category, setCategory] = useState(habit.category || 'other')
  const [frequency, setFrequency] = useState(habit.frequency)
  const [reminderTime, setReminderTime] = useState(habit.reminderTime || '')
  const [targetValue, setTargetValue] = useState(habit.targetValue?.toString() || '')
  const [targetUnit, setTargetUnit] = useState(habit.targetUnit || '')

  const handleSave = () => {
    if (!updateHabit || !name.trim()) return
    updateHabit(habit.id, {
      name: name.trim(),
      emoji,
      category,
      frequency,
      reminderTime: reminderTime || undefined,
      targetValue: targetValue ? Number(targetValue) : undefined,
      targetUnit: targetUnit.trim() || undefined,
      notes: editNote.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className="mt-2 space-y-3 pt-3 border-t border-stone-100">
      <div className="flex gap-2">
        <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
          className="w-12 text-center px-2 py-2 rounded-lg border border-stone-200 text-lg" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Habit name"
          className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm text-stone-800" />
      </div>

      <div>
        <p className="text-xs text-stone-500 mb-1">Category</p>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                category === cat.id ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-stone-50 text-stone-600'
              }`}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-stone-500 mb-1">Frequency</p>
        <div className="flex gap-1.5">
          {(['daily', 'weekdays', 'weekly'] as const).map(f => (
            <button key={f} onClick={() => setFrequency(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                frequency === f ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-stone-50 text-stone-600'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-xs text-stone-500 mb-1">Target (optional)</p>
          <div className="flex gap-1.5">
            <input value={targetValue} onChange={e => setTargetValue(e.target.value)} type="number" placeholder="e.g. 8"
              className="w-16 px-2 py-2 rounded-lg border border-stone-200 text-sm text-center" />
            <input value={targetUnit} onChange={e => setTargetUnit(e.target.value)} placeholder="e.g. glasses"
              className="flex-1 px-2 py-2 rounded-lg border border-stone-200 text-sm" />
          </div>
        </div>
        <div>
          <p className="text-xs text-stone-500 mb-1">Reminder</p>
          <input value={reminderTime} onChange={e => setReminderTime(e.target.value)} type="time"
            className="px-2 py-2 rounded-lg border border-stone-200 text-sm" />
        </div>
      </div>

      <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
        placeholder="Why this habit matters to you..."
        rows={2}
        className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-700 placeholder:text-stone-400 resize-none" />

      <div className="flex gap-2">
        <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-amber-500 text-white text-xs font-medium">
          Save changes
        </button>
        <button onClick={() => removeHabit(habit.id)} className="px-4 py-2.5 rounded-lg text-xs text-red-500 hover:bg-red-50 font-medium">
          Remove
        </button>
      </div>
    </div>
  )
}
