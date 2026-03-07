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
          {state.habits.map(habit => (
            <div key={habit.id} className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{habit.emoji}</span>
                <p className="text-sm font-semibold text-stone-800">{habit.name}</p>
                <span className="text-xs text-stone-500 ml-auto">{getWeeklyRate(habit.completions, 30)}% / 30d</span>
              </div>
              <div className="grid grid-cols-10 gap-1">
                {last30.map(day => {
                  const done = habit.completions.includes(day)
                  return (
                    <div key={day} title={day}
                      className={`aspect-square rounded-sm transition-all ${
                        done ? 'bg-emerald-400' : 'bg-stone-100'
                      }`} />
                  )
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-stone-500">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>
          ))}
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

                      {/* 7-day mini grid */}
                      <div className="flex gap-1.5">
                        {last7.map(day => {
                          const done = habit.completions.includes(day)
                          const isToday = day === today
                          const label = new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })
                          return (
                            <button key={day} onClick={() => toggleHabitDay(habit.id, day)}
                              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-all ${
                                done ? 'bg-emerald-100 text-emerald-800' : isToday ? 'bg-amber-50 text-stone-700' : 'bg-stone-50 text-stone-600'
                              }`}>
                              <span>{label}</span>
                              <span className="text-sm">{done ? '✓' : '·'}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Expand for options */}
                      <button onClick={() => { setExpandedHabit(isExpanded ? null : habit.id); setEditNote(habit.notes || '') }}
                        className="flex items-center gap-1 mt-2 text-xs text-stone-500 hover:text-stone-700 font-medium">
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Collapse' : 'Notes & options'}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 pt-2 border-t border-stone-50">
                          <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                            placeholder="Why this habit matters to you..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm text-stone-700 placeholder:text-stone-400 resize-none" />
                          <div className="flex gap-2 flex-wrap">
                            {updateHabit && (
                              <button onClick={() => { updateHabit(habit.id, { notes: editNote }); setExpandedHabit(null) }}
                                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium">Save note</button>
                            )}
                            <button onClick={() => removeHabit(habit.id)} className="px-4 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 font-medium">Remove</button>
                          </div>
                        </div>
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
