import { useState } from 'react'
import type { AppState, LifeItem } from '@/App'
import { CATEGORY_CONFIG, getOverdueStatus, getNudgeMessage, getSnoozeMessage } from '@/lib/ai-engine'
import { Check, Sparkles, TrendingUp, ChevronRight, Clock, AlertCircle, Pause, X, Trash2 } from 'lucide-react'

interface Props {
  state: AppState
  updateItem: (id: string, updates: Partial<LifeItem>) => void
  removeItem: (id: string) => void
}

const CATEGORY_ORDER: LifeItem['category'][] = ['meal', 'grocery', 'health', 'finance', 'home', 'family', 'errand', 'general']

const CATEGORY_GRADIENTS: Record<LifeItem['category'], { bg: string; icon: string; card: string; progress: string }> = {
  meal:    { bg: 'from-amber-400 to-orange-500',   icon: 'bg-amber-500',   card: 'bg-amber-50 border-amber-100',     progress: 'bg-amber-400' },
  grocery: { bg: 'from-lime-400 to-green-500',     icon: 'bg-lime-500',    card: 'bg-lime-50 border-lime-100',       progress: 'bg-lime-400' },
  health:  { bg: 'from-emerald-400 to-teal-500',   icon: 'bg-emerald-500', card: 'bg-emerald-50 border-emerald-100', progress: 'bg-emerald-400' },
  finance: { bg: 'from-blue-400 to-indigo-500',     icon: 'bg-blue-500',    card: 'bg-blue-50 border-blue-100',       progress: 'bg-blue-400' },
  home:    { bg: 'from-violet-400 to-purple-500',   icon: 'bg-violet-500',  card: 'bg-violet-50 border-violet-100',   progress: 'bg-violet-400' },
  family:  { bg: 'from-pink-400 to-rose-500',       icon: 'bg-pink-500',    card: 'bg-pink-50 border-pink-100',       progress: 'bg-pink-400' },
  errand:  { bg: 'from-orange-400 to-red-400',      icon: 'bg-orange-500',  card: 'bg-orange-50 border-orange-100',   progress: 'bg-orange-400' },
  general: { bg: 'from-stone-400 to-stone-500',     icon: 'bg-stone-500',   card: 'bg-stone-50 border-stone-100',     progress: 'bg-stone-400' },
}

export function LifeBoard({ state, updateItem, removeItem }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<LifeItem['category'] | null>(null)
  const [filter, setFilter] = useState<'pending' | 'done'>('pending')
  const [nudgeItem, setNudgeItem] = useState<string | null>(null)
  const [snoozeMsg, setSnoozeMsg] = useState<string | null>(null)

  const totalPending = state.items.filter(i => i.status === 'pending').length
  const totalDone = state.items.filter(i => i.status === 'done').length
  const totalItems = state.items.length
  const completionRate = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0
  const overdueItems = state.items.filter(i => i.status === 'pending' && getOverdueStatus(i).isOverdue)

  const categoryCounts = CATEGORY_ORDER.map(cat => {
    const all = state.items.filter(i => i.category === cat)
    const pending = all.filter(i => i.status === 'pending')
    const done = all.filter(i => i.status === 'done')
    const overdue = pending.filter(i => getOverdueStatus(i).isOverdue)
    return { category: cat, total: all.length, pending: pending.length, done: done.length, overdue: overdue.length }
  }).filter(c => c.total > 0)

  const handleSnooze = (item: LifeItem) => {
    const msg = getSnoozeMessage(item.snoozeCount)
    setSnoozeMsg(msg)
    updateItem(item.id, {
      snoozeCount: item.snoozeCount + 1,
      snoozedUntil: new Date(Date.now() + 24 * 3600000).toISOString(),
      lastNudged: new Date().toISOString(),
    })
    setTimeout(() => setSnoozeMsg(null), 5000)
  }

  const handleUnsnooze = (item: LifeItem) => {
    updateItem(item.id, {
      snoozeCount: Math.max(0, item.snoozeCount - 1),
      snoozedUntil: undefined,
      status: 'pending',
    })
  }

  const handleComplete = (item: LifeItem) => {
    updateItem(item.id, { status: 'done', completedAt: new Date().toISOString() })
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (selectedCategory) {
    const config = CATEGORY_CONFIG[selectedCategory]
    const gradient = CATEGORY_GRADIENTS[selectedCategory]
    const allCatItems = state.items.filter(i => i.category === selectedCategory)
    const pendingItems = allCatItems.filter(i => i.status === 'pending')
    const doneItems = allCatItems.filter(i => i.status === 'done')
    const displayItems = filter === 'pending' ? pendingItems : doneItems

    return (
      <div className="px-4 py-4">
        <button onClick={() => { setSelectedCategory(null); setNudgeItem(null); setSnoozeMsg(null) }}
          className="flex items-center gap-2 mb-4 text-stone-600 hover:text-stone-600 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Snooze message toast */}
        {snoozeMsg && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 animate-in fade-in slide-in-from-top-2">
            <p className="text-sm text-amber-800 leading-relaxed">{snoozeMsg}</p>
          </div>
        )}

        <div className={`bg-gradient-to-br ${gradient.bg} rounded-2xl p-5 mb-5 text-white shadow-lg`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: "'Georgia', serif" }}>{config.label}</h2>
              <p className="text-white/70 text-sm">{allCatItems.length} item{allCatItems.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <div className="flex-1 bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{pendingItems.length}</p>
              <p className="text-xs text-white/70">to do</p>
            </div>
            <div className="flex-1 bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{doneItems.length}</p>
              <p className="text-xs text-white/70">done</p>
            </div>
            <div className="flex-1 bg-white/15 backdrop-blur-sm rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{allCatItems.length > 0 ? Math.round((doneItems.length / allCatItems.length) * 100) : 0}%</p>
              <p className="text-xs text-white/70">complete</p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-4">
          {(['pending', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                filter === f ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-600'
              }`}>
              {f === 'pending' ? `To Do (${pendingItems.length})` : `Done (${doneItems.length})`}
            </button>
          ))}
        </div>

        {displayItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">{filter === 'done' ? '🏁' : '🎉'}</p>
            <p className="text-sm text-stone-600">
              {filter === 'done' ? 'Nothing completed yet — you\'ve got this!' : 'All clear here!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayItems.map(item => {
              const overdue = getOverdueStatus(item)
              const showNudge = nudgeItem === item.id
              return (
                <div key={item.id}>
                  <div className={`bg-white rounded-xl border p-4 shadow-sm transition-all ${
                    overdue.isOverdue && item.status === 'pending'
                      ? overdue.urgency === 'high' ? 'border-red-200 bg-red-50/30' :
                        overdue.urgency === 'medium' ? 'border-amber-200 bg-amber-50/30' :
                        'border-stone-100'
                      : 'border-stone-100'
                  }`}>
                    <div className="flex items-start gap-3">
                      <button onClick={() => item.status === 'done' ? updateItem(item.id, { status: 'pending', completedAt: undefined }) : handleComplete(item)}
                        className={`w-6 h-6 rounded-lg flex-none mt-0.5 flex items-center justify-center transition-all ${
                          item.status === 'done'
                            ? `${gradient.icon} shadow-sm`
                            : 'border-2 border-stone-200 hover:border-stone-400 hover:scale-110'
                        }`}>
                        {item.status === 'done' && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${item.status === 'done' ? 'text-stone-600 line-through' : 'text-stone-700'}`}>
                          {item.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs text-stone-600">{formatRelativeTime(item.createdAt)}</span>
                          {overdue.isOverdue && item.status === 'pending' && (
                            <span className={`text-xs font-medium flex items-center gap-1 ${
                              overdue.urgency === 'high' ? 'text-red-500' :
                              overdue.urgency === 'medium' ? 'text-amber-500' : 'text-stone-600'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {overdue.overdueLabel}
                            </span>
                          )}
                          {item.snoozeCount > 0 && item.status === 'pending' && (
                            <span className="text-xs text-violet-400 flex items-center gap-1">
                              <Pause className="w-3 h-3" />
                              Snoozed {item.snoozeCount}x
                              <button onClick={(e) => { e.stopPropagation(); handleUnsnooze(item) }}
                                className="ml-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-500 hover:bg-violet-100 text-xs font-medium">
                                Undo
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action buttons for pending items */}
                      {item.status === 'pending' && (
                        <div className="flex items-center gap-1 flex-none">
                          {overdue.isOverdue && (
                            <button onClick={() => setNudgeItem(showNudge ? null : item.id)}
                              className="w-7 h-7 rounded-lg hover:bg-amber-50 flex items-center justify-center transition-colors"
                              title="Why this matters">
                              <AlertCircle className="w-4 h-4 text-amber-400" />
                            </button>
                          )}
                          <button onClick={() => handleSnooze(item)}
                            className="w-7 h-7 rounded-lg hover:bg-violet-50 flex items-center justify-center transition-colors"
                            title="Snooze for tomorrow">
                            <Pause className="w-4 h-4 text-violet-400" />
                          </button>
                          <button onClick={() => removeItem(item.id)}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                            title="Remove">
                            <Trash2 className="w-3.5 h-3.5 text-stone-600 hover:text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Nudge message card */}
                  {showNudge && (
                    <div className="ml-9 mt-1 mb-1 bg-amber-50 border border-amber-100 rounded-xl p-3 animate-in fade-in slide-in-from-top-1">
                      <p className="text-xs text-amber-700 leading-relaxed">{getNudgeMessage(item)}</p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleComplete(item)}
                          className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors">
                          ✓ Do it now
                        </button>
                        <button onClick={() => handleSnooze(item)}
                          className="text-xs font-medium text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg hover:bg-violet-100 transition-colors">
                          Tomorrow
                        </button>
                        <button onClick={() => removeItem(item.id)}
                          className="text-xs font-medium text-stone-600 bg-stone-50 px-2.5 py-1 rounded-lg hover:bg-stone-100 transition-colors">
                          Not needed
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── MAIN BOARD VIEW ──────────────────────────────────────────
  return (
    <div className="px-4 py-4">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-stone-800 mb-1" style={{ fontFamily: "'Georgia', serif" }}>Life Board</h2>
        <p className="text-sm text-stone-600">Your entire life, at a glance</p>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 flex-none">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#f5f5f4" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="url(#pg)" strokeWidth="5"
                strokeLinecap="round" strokeDasharray={`${completionRate * 1.759} 175.9`} className="transition-all duration-700" />
              <defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#ea580c" />
              </linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-stone-800">{completionRate}%</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Progress</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-amber-50/80 rounded-lg px-2 py-2 text-center">
                <p className="text-lg font-bold text-amber-700">{totalPending}</p>
                <p className="text-xs text-amber-600/70 font-medium">open</p>
              </div>
              <div className="bg-emerald-50/80 rounded-lg px-2 py-2 text-center">
                <p className="text-lg font-bold text-emerald-700">{totalDone}</p>
                <p className="text-xs text-emerald-600/70 font-medium">done</p>
              </div>
              <div className="bg-red-50/80 rounded-lg px-2 py-2 text-center">
                <p className="text-lg font-bold text-red-500">{overdueItems.length}</p>
                <p className="text-xs text-red-500/70 font-medium">overdue</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueItems.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/50 p-4 mb-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-none mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-stone-800 mb-1">
                {overdueItems.length} item{overdueItems.length > 1 ? 's' : ''} waiting for you
              </p>
              <p className="text-xs text-stone-500 leading-relaxed">
                No pressure — just awareness. Tap into a category to snooze, complete, or remove what's no longer needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category grid */}
      {categoryCounts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-stone-800 font-semibold mb-1">Your board is empty</p>
          <p className="text-stone-600 text-sm max-w-xs mx-auto">
            Head to Chat and tell me what's on your mind. Only real tasks show up here — not every message.
          </p>
        </div>
      ) : (
        <>
          <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3 px-0.5">Categories</h3>
          <div className="grid grid-cols-2 gap-3">
            {categoryCounts.map(({ category, total, pending, done, overdue }) => {
              const config = CATEGORY_CONFIG[category]
              const gradient = CATEGORY_GRADIENTS[category]
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              return (
                <button key={category} onClick={() => { setSelectedCategory(category); setFilter('pending') }}
                  className={`${gradient.card} border rounded-2xl p-4 text-left hover:shadow-md transition-all active:scale-[0.97] group relative overflow-hidden`}>
                  <div className={`absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-gradient-to-br ${gradient.bg} opacity-10`} />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{config.emoji}</span>
                      <div className="flex items-center gap-1">
                        {overdue > 0 && (
                          <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 text-xs font-bold flex items-center justify-center">
                            {overdue}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-500 group-hover:text-stone-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                    <p className="font-semibold text-stone-800 text-sm mb-1">{config.label}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-stone-500">{pending} open</span>
                      {done > 0 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-stone-300" />
                          <span className="text-xs text-emerald-600">{done} done</span>
                        </>
                      )}
                    </div>
                    <div className="h-1.5 bg-white/80 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${gradient.progress} transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 4)}%` }} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Recent items */}
      {state.items.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-3 px-0.5">Recent</h3>
          <div className="space-y-2">
            {state.items.slice(0, 4).map(item => {
              const gradient = CATEGORY_GRADIENTS[item.category]
              const overdue = getOverdueStatus(item)
              return (
                <div key={item.id} className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 shadow-sm ${
                  overdue.isOverdue && item.status === 'pending' ? 'border-amber-200' : 'border-stone-100'
                }`}>
                  <button onClick={() => updateItem(item.id, { status: item.status === 'done' ? 'pending' : 'done', completedAt: item.status === 'done' ? undefined : new Date().toISOString() })}
                    className={`w-5 h-5 rounded-md flex-none flex items-center justify-center transition-all ${
                      item.status === 'done' ? `${gradient.icon} shadow-sm` : 'border-2 border-stone-200 hover:border-stone-400'
                    }`}>
                    {item.status === 'done' && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </button>
                  <p className={`text-sm flex-1 truncate ${item.status === 'done' ? 'text-stone-600 line-through' : 'text-stone-700'}`}>{item.text}</p>
                  <div className="flex items-center gap-1.5 flex-none">
                    {overdue.isOverdue && item.status === 'pending' && <Clock className="w-3 h-3 text-amber-400" />}
                    <span className="text-xs text-stone-600">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diffMs / 60000)
  const hr = Math.floor(diffMs / 3600000)
  const day = Math.floor(diffMs / 86400000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day < 7) return `${day}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
