import { useState } from 'react'
import type { AppState, LifeItem, Goal, Habit } from '@/App'
import { Check, Trash2, Target, Plus, ChevronDown, ChevronUp, AlertCircle, Clock, Sparkles, X } from 'lucide-react'

interface Props {
  state: AppState
  addItem: (item: LifeItem) => void
  updateItem: (id: string, updates: Partial<LifeItem>) => void
  removeItem: (id: string) => void
  addGoal: (goal: Goal) => void
  updateGoal: (id: string, updates: Partial<Goal>) => void
  removeGoal: (id: string) => void
  toggleHabitDay?: (habitId: string, dateStr: string) => void
}

const CATS: { key: LifeItem['category']; emoji: string; label: string; bg: string; border: string; text: string; gradient: string }[] = [
  { key: 'health', emoji: '💪', label: 'Health', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', gradient: 'from-emerald-400 to-teal-500' },
  { key: 'finance', emoji: '💰', label: 'Finance', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', gradient: 'from-blue-400 to-indigo-500' },
  { key: 'home', emoji: '🏠', label: 'Home', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', gradient: 'from-violet-400 to-purple-500' },
  { key: 'family', emoji: '👨‍👩‍👧', label: 'Family', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', gradient: 'from-pink-400 to-rose-500' },
  { key: 'meal', emoji: '🍳', label: 'Meal', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', gradient: 'from-amber-400 to-orange-500' },
  { key: 'grocery', emoji: '🛒', label: 'Grocery', bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', gradient: 'from-lime-400 to-green-500' },
  { key: 'errand', emoji: '📦', label: 'Errand', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', gradient: 'from-orange-400 to-red-400' },
  { key: 'general', emoji: '📋', label: 'General', bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-600', gradient: 'from-stone-400 to-stone-500' },
]

const EQ = [
  { key: 'do' as const, label: 'Do First', sub: 'Urgent & Important', emoji: '🔥', bg: 'bg-red-50', border: 'border-red-200', headerBg: 'bg-gradient-to-r from-red-500 to-rose-500' },
  { key: 'schedule' as const, label: 'Schedule', sub: 'Important, Not Urgent', emoji: '📅', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-gradient-to-r from-blue-500 to-indigo-500' },
  { key: 'delegate' as const, label: 'Delegate', sub: 'Urgent, Not Important', emoji: '🤝', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500' },
  { key: 'eliminate' as const, label: 'Drop It', sub: 'Neither', emoji: '🗑️', bg: 'bg-stone-50', border: 'border-stone-200', headerBg: 'bg-gradient-to-r from-stone-400 to-stone-500' },
]

function getStreak(completions: string[]): number {
  let s = 0
  for (let i = 0; i < 90; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (completions.includes(d.toISOString().split('T')[0])) s++; else if (i > 0) break }
  return s
}

export function LifeBoard({ state, addItem, updateItem, removeItem, addGoal, updateGoal, removeGoal, toggleHabitDay }: Props) {
  const [view, setView] = useState<'day' | 'priorities' | 'goals'>('day')
  const [showDone, setShowDone] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null)
  const [movingTask, setMovingTask] = useState<string | null>(null) // task being assigned in matrix
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editGoalText, setEditGoalText] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [newText, setNewText] = useState('')
  const [newCat, setNewCat] = useState<LifeItem['category']>('general')
  const [newDate, setNewDate] = useState('')
  const [newGoalId, setNewGoalId] = useState('')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDate, setGoalDate] = useState('')
  const [goalCat, setGoalCat] = useState<LifeItem['category']>('general')
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null)
  const [linkingGoalId, setLinkingGoalId] = useState<string>('')
  const [taskToAssign, setTaskToAssign] = useState<string>('')

  const todayStr = new Date().toISOString().split('T')[0]
  const now = new Date()
  const pending = state.items.filter(i => i.status === 'pending')
  const done = state.items.filter(i => i.status === 'done')
  const goals = state.goals || []
  const habits = state.habits || []
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = state.profile.name?.split(' ')[0] || ''

  const submitTask = () => {
    if (!newText.trim()) return
    addItem({ id: `item-${Date.now()}`, text: newText.trim(), category: newCat, status: 'pending', createdAt: new Date().toISOString(), snoozeCount: 0, dueDate: newDate || undefined, goalId: newGoalId || undefined } as any)
    setNewText(''); setNewDate(''); setNewGoalId(''); setShowAddTask(false)
  }

  // ═══════════════════════════
  // RENDER
  // ═══════════════════════════
  return (
    <div className="p-4 pb-24">
      {/* Greeting */}
      <p className="text-[13px] text-stone-500 mb-2">{greeting}{firstName ? `, ${firstName}` : ''} ✦</p>

      {/* 3-way toggle */}
      <div className="flex bg-stone-100 rounded-2xl p-1 mb-4">
        {[
          { id: 'day' as const, label: 'My Day' },
          { id: 'priorities' as const, label: 'Prioritize' },
          { id: 'goals' as const, label: 'My Goals' },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${view === t.id ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ MY DAY ═══ */}
      {view === 'day' && (
        <>
          {/* Add task button */}
          <button onClick={() => setShowAddTask(!showAddTask)}
            className="w-full flex items-center justify-center gap-1.5 p-3 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 mb-4">
            <Plus className="w-4 h-4" /> Add a task
          </button>

          {showAddTask && (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm mb-4 space-y-2.5">
              <input value={newText} onChange={e => setNewText(e.target.value)} placeholder="What needs to be done?"
                className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') submitTask() }} />
              <div className="flex gap-2">
                <select value={newCat} onChange={e => setNewCat(e.target.value as any)} className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2">
                  {CATS.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2" />
              </div>
              {goals.filter(g => g.status === 'active').length > 0 && (
                <select value={newGoalId} onChange={e => setNewGoalId(e.target.value)} className="w-full text-xs border border-stone-200 rounded-xl px-2.5 py-2">
                  <option value="">Standalone task</option>
                  {goals.filter(g => g.status === 'active').map(g => <option key={g.id} value={g.id}>🎯 {g.title}</option>)}
                </select>
              )}
              <div className="flex gap-2">
                <button onClick={submitTask} className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium">Add</button>
                <button onClick={() => { setShowAddTask(false); setNewText('') }} className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-500 text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Habits */}
          {habits.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-2xl border border-amber-100/60 p-4 mb-4">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-2">Daily Habits</p>
              {habits.map(h => {
                const doneToday = h.completions.includes(todayStr)
                const streak = getStreak(h.completions)
                const isOpen = expandedHabit === h.id
                return (
                  <div key={h.id} className="mb-1">
                    <div className="flex items-center gap-3 py-2">
                      <button onClick={() => toggleHabitDay?.(h.id, todayStr)}
                        className={`w-[22px] h-[22px] rounded-lg flex items-center justify-center flex-none transition-all ${doneToday ? 'bg-emerald-500 text-white' : 'border-2 border-stone-200 hover:border-emerald-400'}`}>
                        {doneToday && <Check className="w-3 h-3" />}
                      </button>
                      <span className="text-sm">{h.emoji}</span>
                      <button onClick={() => setExpandedHabit(isOpen ? null : h.id)} className={`text-[13px] flex-1 text-left ${doneToday ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{h.name}</button>
                      {streak >= 2 && <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md">🔥 {streak}d</span>}
                    </div>
                    {isOpen && (() => {
                      const cs = new Set(h.completions)
                      const ew = new Date(now); ew.setDate(now.getDate() + (6 - now.getDay()))
                      const sg = new Date(ew); sg.setDate(ew.getDate() - 34)
                      const weeks: any[][] = []; const cr = new Date(sg)
                      for (let w = 0; w < 5; w++) { const wk: any[] = []; for (let d = 0; d < 7; d++) { wk.push({ date: new Date(cr), ds: cr.toISOString().split('T')[0] }); cr.setDate(cr.getDate() + 1) } weeks.push(wk) }
                      return (
                        <div className="bg-stone-50 rounded-xl p-3 mb-2 ml-9">
                          <div className="grid grid-cols-7 gap-0.5 mb-1">{['S','M','T','W','T','F','S'].map((d,i) => <div key={i} className="text-center text-[8px] font-semibold text-stone-400">{d}</div>)}</div>
                          {weeks.map((wk,wi) => <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">{wk.map(({date,ds}: any) => {
                            const dn = cs.has(ds); const it = ds === todayStr; const fu = date > now
                            return <button key={ds} onClick={() => !fu && toggleHabitDay?.(h.id, ds)} disabled={fu}
                              className={`aspect-square rounded flex items-center justify-center text-[9px] font-medium ${fu?'bg-stone-100 text-stone-300':dn?'bg-emerald-400 text-white':it?'bg-amber-100 text-amber-700 ring-1 ring-amber-300':'bg-white text-stone-400'}`}>{date.getDate()}</button>
                          })}</div>)}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}

          {/* Category boxes */}
          {!showDone && (() => {
            const grouped = CATS.map(cat => ({ ...cat, items: pending.filter(i => i.category === cat.key) })).filter(g => g.items.length > 0)
            const ungrouped = pending.filter(i => !CATS.some(c => c.key === i.category))
            return grouped.length > 0 ? (
              <div className="space-y-3">
                {grouped.map(g => (
                  <div key={g.key} className={`rounded-2xl border ${g.border} overflow-hidden`}>
                    <div className={`bg-gradient-to-r ${g.gradient} px-4 py-2.5 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm">{g.emoji}</span>
                        <span className="text-white text-sm font-semibold">{g.label}</span>
                      </div>
                      <span className="text-white/80 text-xs font-medium">{g.items.length}</span>
                    </div>
                    <div className={`${g.bg} p-2`}>
                      {g.items.map(item => {
                        const isOverdue = item.dueDate && item.dueDate < todayStr
                        const linkedGoal = item.goalId ? goals.find(gl => gl.id === item.goalId) : null
                        return (
                          <div key={item.id} className="bg-white/80 rounded-xl px-3 py-2.5 mb-1.5 last:mb-0">
                            <div className="flex items-center gap-2.5">
                              <button onClick={() => updateItem(item.id, { status: 'done', completedAt: new Date().toISOString() })}
                                className={`w-5 h-5 rounded-full flex items-center justify-center flex-none border-2 ${isOverdue ? 'border-red-400' : 'border-stone-300'} hover:border-emerald-400`} />
                              <div className="flex-1 min-w-0">
                                {editingItemId === item.id ? (
                                  <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                                    className="w-full text-[13px] text-stone-800 bg-white border border-amber-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                    onKeyDown={e => { if (e.key === 'Enter') { updateItem(item.id, { text: editText }); setEditingItemId(null) } if (e.key === 'Escape') setEditingItemId(null) }}
                                    onBlur={() => { updateItem(item.id, { text: editText }); setEditingItemId(null) }} />
                                ) : (
                                  <p className="text-[13px] text-stone-800 leading-snug cursor-pointer" onClick={() => { setEditingItemId(item.id); setEditText(item.text) }}>{item.text}</p>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {isOverdue && <span className="text-[10px] text-red-500 font-semibold">Overdue</span>}
                                  {item.dueDate && !isOverdue && <span className="text-[10px] text-stone-400">{new Date(item.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                  {linkedGoal && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">🎯 {linkedGoal.title.slice(0, 14)}</span>}
                                </div>
                              </div>
                              {goals.filter(g => g.status === 'active').length > 0 && (
                                <button onClick={() => { setLinkingTaskId(linkingTaskId === item.id ? null : item.id); setLinkingGoalId(item.goalId || '') }}
                                  title="Assign to goal"
                                  className={`p-1 flex-none ${item.goalId ? 'text-amber-400 hover:text-amber-600' : 'text-stone-300 hover:text-amber-400'}`}>
                                  <Target className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => removeItem(item.id)} className="p-1 text-stone-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            {linkingTaskId === item.id && (
                              <div className="mt-2 flex gap-1.5">
                                <select value={linkingGoalId} onChange={e => setLinkingGoalId(e.target.value)}
                                  className="flex-1 text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white">
                                  <option value="">No goal (standalone)</option>
                                  {goals.filter(g => g.status === 'active').map(g => <option key={g.id} value={g.id}>🎯 {g.title}</option>)}
                                </select>
                                <button onClick={() => { updateItem(item.id, { goalId: linkingGoalId || undefined } as any); setLinkingTaskId(null) }}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium">Save</button>
                                <button onClick={() => setLinkingTaskId(null)} className="px-2 py-1.5 rounded-lg bg-stone-100 text-stone-400 text-xs">✕</button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null
          })()}

          {/* Done toggle */}
          <div className="flex justify-center mt-4">
            <button onClick={() => setShowDone(!showDone)} className={`text-xs font-medium px-4 py-2 rounded-xl transition-all ${showDone ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
              {showDone ? 'Hide completed' : `${done.length} completed`}
            </button>
          </div>
          {showDone && <div className="mt-3 space-y-1.5">{done.slice(0, 20).map(item => (
            <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 bg-white rounded-xl border border-stone-100">
              <button onClick={() => updateItem(item.id, { status: 'pending', completedAt: undefined })} className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-none"><Check className="w-3 h-3" /></button>
              <span className="text-[13px] text-stone-400 line-through flex-1">{item.text}</span>
            </div>
          ))}</div>}

          {pending.length === 0 && habits.length === 0 && !showAddTask && (
            <div className="text-center py-12"><Sparkles className="w-8 h-8 text-amber-300 mx-auto mb-3" /><p className="text-sm font-medium text-stone-600 mb-1">Your day is clear</p><p className="text-xs text-stone-400">Add a task above or ask the AI</p></div>
          )}
        </>
      )}

      {/* ═══ PRIORITIZE (Eisenhower Matrix) ═══ */}
      {view === 'priorities' && (
        <>
          <p className="text-xs text-stone-500 mb-3">Tap a task to move it between quadrants. Unassigned tasks appear at the bottom.</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {EQ.map(q => {
              const items = pending.filter(i => i.eisenhower === q.key)
              return (
                <div key={q.key} className={`${q.bg} ${q.border} border rounded-2xl overflow-hidden`}>
                  <div className={`${q.headerBg} px-3 py-2`}>
                    <p className="text-white text-xs font-bold">{q.emoji} {q.label}</p>
                    <p className="text-white/70 text-[9px]">{q.sub}</p>
                  </div>
                  <div className="p-2 min-h-[80px]">
                    {items.map(item => (
                      <div key={item.id} className="relative mb-1.5">
                        <button onClick={() => setMovingTask(movingTask === item.id ? null : item.id)}
                          className={`w-full text-left flex items-center gap-2 bg-white rounded-lg px-2.5 py-2 shadow-sm transition-all ${movingTask === item.id ? 'ring-2 ring-amber-400' : ''}`}>
                          <button onClick={(e) => { e.stopPropagation(); updateItem(item.id, { status: 'done', completedAt: new Date().toISOString() }) }}
                            className="w-4 h-4 rounded-full border-2 border-stone-300 flex-none hover:border-emerald-400" />
                          <span className="text-xs text-stone-700 flex-1 leading-snug">{item.text}</span>
                        </button>
                        {/* Move buttons — appear when task is selected */}
                        {movingTask === item.id && (
                          <div className="flex gap-1 mt-1">
                            {EQ.filter(oq => oq.key !== q.key).map(oq => (
                              <button key={oq.key} onClick={() => { updateItem(item.id, { eisenhower: oq.key }); setMovingTask(null) }}
                                className={`flex-1 py-1.5 rounded-md text-[10px] font-medium ${oq.bg} ${oq.border} border text-stone-600 hover:opacity-80`}>
                                {oq.emoji} {oq.label}
                              </button>
                            ))}
                            <button onClick={() => { updateItem(item.id, { eisenhower: undefined }); setMovingTask(null) }}
                              className="px-2 py-1.5 rounded-md text-[10px] bg-stone-100 border border-stone-200 text-stone-400">
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-[10px] text-stone-400 italic text-center py-3">Empty</p>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Unsorted tasks */}
          {(() => {
            const unsorted = pending.filter(i => !i.eisenhower)
            return unsorted.length > 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Unsorted ({unsorted.length})</p>
                <p className="text-[10px] text-stone-400 mb-3">Tap a task, then choose a quadrant</p>
                {unsorted.map(item => (
                  <div key={item.id} className="mb-2">
                    <button onClick={() => setMovingTask(movingTask === item.id ? null : item.id)}
                      className={`w-full text-left flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2.5 transition-all ${movingTask === item.id ? 'ring-2 ring-amber-400' : ''}`}>
                      <span className="text-xs text-stone-700 flex-1">{item.text}</span>
                      <span className="text-[10px] text-stone-400">{CATS.find(c => c.key === item.category)?.emoji}</span>
                    </button>
                    {movingTask === item.id && (
                      <div className="flex gap-1 mt-1">
                        {EQ.map(q => (
                          <button key={q.key} onClick={() => { updateItem(item.id, { eisenhower: q.key }); setMovingTask(null) }}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-medium ${q.bg} ${q.border} border text-stone-600`}>
                            {q.emoji} {q.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4"><p className="text-xs text-stone-400">All tasks are sorted! 🎉</p></div>
            )
          })()}
        </>
      )}

      {/* ═══ MY GOALS ═══ */}
      {view === 'goals' && (
        <>
          {!showAddGoal ? (
            <button onClick={() => setShowAddGoal(true)}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 hover:border-amber-300 hover:text-amber-600 transition-all mb-4">
              <Target className="w-4 h-4" /><span className="text-sm font-medium">Set a New Goal</span>
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm mb-4 space-y-2.5">
              <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="What do you want to achieve?"
                className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300" autoFocus />
              <div className="flex gap-2">
                <input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2" />
                <select value={goalCat} onChange={e => setGoalCat(e.target.value as any)} className="flex-1 text-xs border border-stone-200 rounded-xl px-2.5 py-2">
                  {CATS.map(c => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => {
                  if (!goalTitle.trim()) return
                  addGoal({ id: `goal-${Date.now()}`, title: goalTitle.trim(), targetDate: goalDate || undefined, category: goalCat, createdAt: new Date().toISOString(), milestones: [], linkedHabitIds: [], linkedTaskIds: [], status: 'active' })
                  setGoalTitle(''); setGoalDate(''); setShowAddGoal(false)
                }} className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium">Create</button>
                <button onClick={() => { setShowAddGoal(false); setGoalTitle('') }} className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-500 text-sm">Cancel</button>
              </div>
              <p className="text-[10px] text-stone-400 text-center">Or tell the AI: "Help me plan a goal to learn Spanish in 3 months"</p>
            </div>
          )}

          {goals.filter(g => g.status === 'active').map(goal => {
            const isOpen = expandedGoal === goal.id
            const cat = CATS.find(c => c.key === goal.category)
            const goalTasks = state.items.filter(i => i.goalId === goal.id)
            const goalHabits = habits.filter(h => goal.linkedHabitIds?.includes(h.id))
            const tasksDone = goalTasks.filter(t => t.status === 'done').length
            const totalSteps = goalTasks.length + goal.milestones.length
            const completedSteps = tasksDone + goal.milestones.filter(m => m.completed).length
            const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
            const daysLeft = goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000) : null

            return (
              <div key={goal.id} className={`rounded-2xl border ${cat?.border || 'border-stone-200'} overflow-hidden shadow-sm mb-3`}>
                <button onClick={() => setExpandedGoal(isOpen ? null : goal.id)} className="w-full text-left">
                  <div className={`bg-gradient-to-r ${cat?.gradient || 'from-stone-400 to-stone-500'} px-4 py-3 flex items-center gap-3`}>
                    <span className="text-white text-lg">{cat?.emoji || '🎯'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold leading-tight">{goal.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {daysLeft !== null && <span className={`text-[10px] font-medium ${daysLeft < 0 ? 'text-red-200' : 'text-white/70'}`}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                        </span>}
                        {totalSteps > 0 && <span className="text-white/60 text-[10px]">{completedSteps}/{totalSteps} steps</span>}
                      </div>
                    </div>
                    <span className="text-white/90 text-sm font-bold">{pct}%</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
                  </div>
                  {/* Progress bar below header */}
                  <div className="w-full h-1.5 bg-black/10">
                    <div className={`h-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-400' : 'bg-white/60'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </button>

                {isOpen && (
                  <div className={`${cat?.bg || 'bg-stone-50'} px-4 pb-4 pt-3 space-y-3`}>
                    {goalTasks.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Tasks ({tasksDone}/{goalTasks.length})</p>
                        {goalTasks.map(t => (
                          <div key={t.id} className="flex items-center gap-2.5 bg-white/80 rounded-xl px-3 py-2 mb-1.5">
                            <button onClick={() => updateItem(t.id, t.status === 'done' ? { status: 'pending', completedAt: undefined } : { status: 'done', completedAt: new Date().toISOString() })}
                              className={`w-4 h-4 rounded-full flex items-center justify-center flex-none ${t.status === 'done' ? 'bg-emerald-500 text-white' : 'border-2 border-stone-300'}`}>
                              {t.status === 'done' && <Check className="w-2.5 h-2.5" />}
                            </button>
                            {editingItemId === t.id ? (
                              <input value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                                className="flex-1 text-xs bg-white border border-amber-300 rounded-lg px-2 py-1 focus:outline-none"
                                onKeyDown={e => { if (e.key === 'Enter') { updateItem(t.id, { text: editText }); setEditingItemId(null) } if (e.key === 'Escape') setEditingItemId(null) }}
                                onBlur={() => { updateItem(t.id, { text: editText }); setEditingItemId(null) }} />
                            ) : (
                              <span className={`text-xs flex-1 cursor-pointer ${t.status === 'done' ? 'text-stone-400 line-through' : 'text-stone-700'}`}
                                onClick={() => { setEditingItemId(t.id); setEditText(t.text) }}>{t.text}</span>
                            )}
                            <button onClick={() => updateItem(t.id, { goalId: undefined } as any)} title="Remove from goal" className="p-0.5 text-stone-200 hover:text-amber-400"><X className="w-2.5 h-2.5" /></button>
                            <button onClick={() => removeItem(t.id)} className="p-0.5 text-stone-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {goalHabits.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Habits</p>
                        {goalHabits.map(h => {
                          const dn = h.completions.includes(todayStr); const sk = getStreak(h.completions)
                          return (
                            <div key={h.id} className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2 mb-1.5">
                              <button onClick={() => toggleHabitDay?.(h.id, todayStr)} className={`w-4 h-4 rounded flex items-center justify-center flex-none ${dn ? 'bg-emerald-500 text-white' : 'border-2 border-stone-300'}`}>{dn && <Check className="w-2.5 h-2.5" />}</button>
                              <span className="text-xs">{h.emoji}</span>
                              <span className={`text-xs flex-1 ${dn ? 'text-stone-400' : 'text-stone-700'}`}>{h.name}</span>
                              {sk >= 2 && <span className="text-[10px] font-bold text-orange-500">🔥{sk}d</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {goalTasks.length === 0 && goalHabits.length === 0 && (
                      <p className="text-xs text-stone-400 italic text-center py-2">Ask the AI to break this goal into tasks and habits</p>
                    )}
                    {/* Assign an existing task to this goal */}
                    {pending.filter(i => !i.goalId).length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1.5">Link existing task</p>
                        <div className="flex gap-1.5">
                          <select value={taskToAssign} onChange={e => setTaskToAssign(e.target.value)}
                            className="flex-1 text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white">
                            <option value="">Select a task…</option>
                            {pending.filter(i => !i.goalId).map(t => <option key={t.id} value={t.id}>{t.text.slice(0, 45)}</option>)}
                          </select>
                          <button onClick={() => { if (taskToAssign) { updateItem(taskToAssign, { goalId: goal.id } as any); setTaskToAssign('') } }}
                            disabled={!taskToAssign}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium disabled:opacity-40">Add</button>
                        </div>
                      </div>
                    )}
                    {/* Edit goal title */}
                    <div className="pt-2 border-t border-black/5">
                      {editingGoalId === goal.id ? (
                        <div className="flex gap-2 mb-2">
                          <input value={editGoalText} onChange={e => setEditGoalText(e.target.value)} autoFocus
                            className="flex-1 text-xs border border-amber-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            onKeyDown={e => { if (e.key === 'Enter') { updateGoal(goal.id, { title: editGoalText }); setEditingGoalId(null) } if (e.key === 'Escape') setEditingGoalId(null) }} />
                          <button onClick={() => { updateGoal(goal.id, { title: editGoalText }); setEditingGoalId(null) }} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-medium">Save</button>
                          <button onClick={() => setEditingGoalId(null)} className="px-2 py-2 rounded-lg bg-stone-100 text-stone-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingGoalId(goal.id); setEditGoalText(goal.title) }}
                          className="text-xs text-stone-500 hover:text-amber-600 mb-2">✏️ Edit goal title</button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { updateGoal(goal.id, { status: 'completed', completedAt: new Date().toISOString() }); setExpandedGoal(null) }}
                        className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium">Complete</button>
                      <button onClick={() => { if (confirm('Delete this goal?')) { removeGoal(goal.id); setExpandedGoal(null) } }}
                        className="px-3 py-2 rounded-xl bg-white text-red-500 text-xs font-medium border border-red-200">Delete</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {goals.filter(g => g.status === 'completed').length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-2">Achieved</p>
              {goals.filter(g => g.status === 'completed').map(g => (
                <div key={g.id} className="flex items-center gap-2.5 py-2.5 px-3 bg-emerald-50 rounded-xl border border-emerald-100 mb-2">
                  <Check className="w-4 h-4 text-emerald-500" /><span className="text-sm text-emerald-700 line-through flex-1">{g.title}</span>
                  <button onClick={() => removeGoal(g.id)} className="text-emerald-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}

          {goals.length === 0 && !showAddGoal && (
            <div className="text-center py-12"><Target className="w-8 h-8 text-stone-300 mx-auto mb-3" /><p className="text-sm font-medium text-stone-600 mb-1">What do you want to achieve?</p><p className="text-xs text-stone-400 max-w-[260px] mx-auto">Set a goal above, or tell the AI something like "I want to learn guitar in 3 months"</p></div>
          )}
        </>
      )}
    </div>
  )
}
