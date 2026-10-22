import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Shield, RefreshCw, ChevronDown, Target, CheckCircle, BookOpen, AlertTriangle, Activity, Users, Clock, ListChecks } from 'lucide-react'
import { fetchAdminAnalytics, fetchAdminCoaching } from '@/lib/admin-api'

interface Props {
  onClose: () => void
}

interface CoachingGoalTask {
  text: string
  status: string
  dueDate?: string
}

interface CoachingGoalHabit {
  name: string
  emoji?: string
  streak: number
}

interface CoachingGoal {
  id: string
  title: string
  category?: string
  targetDate?: string
  createdAt?: string
  progress: number
  totalSteps: number
  completedSteps: number
  tasks: CoachingGoalTask[]
  habits: CoachingGoalHabit[]
}

interface CoachingUser {
  userId: string
  name: string
  lastActive?: string
  subscription?: any
  stats: {
    activeGoals: number
    pendingTasks: number
    completedTasks: number
    totalHabits: number
    habitsCompletedToday: number
    journalEntries: number
    focusMinutesTotal: number
  }
  goals: CoachingGoal[]
}

function formatDateTime(value?: string): string {
  if (!value) return 'Unknown'
  const d = new Date(value)
  if (isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatTime(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function initials(name?: string): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
}

function sortedEntries(obj?: Record<string, number>): [string, number][] {
  if (!obj) return []
  return Object.entries(obj).sort((a, b) => b[1] - a[1])
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-8 h-8 rounded-full border-2 border-stone-200 border-t-amber-500 animate-spin" />
      <p className="text-sm text-stone-500">Loading…</p>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: any; onRetry: () => void }) {
  const status = error?.status
  if (status === 401 || status === 403) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm text-center">
        <Shield className="w-8 h-8 text-stone-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-stone-700">This area is restricted to the app owner.</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm text-center">
      <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
      <p className="text-sm text-stone-600 mb-4">{error?.message || 'Something went wrong loading this data.'}</p>
      <button onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors">
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm text-center">
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      <p className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

function CountList({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
      <h3 className="font-semibold text-stone-800 text-sm mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-stone-400">No data yet</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([name, count]) => (
            <div key={name} className="flex items-center justify-between gap-2">
              <span className="text-sm text-stone-600 truncate">{name}</span>
              <span className="text-xs font-semibold text-stone-700 bg-stone-50 px-2 py-0.5 rounded-lg flex-none">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AdminView({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'coaching'>('analytics')

  const [analytics, setAnalytics] = useState<any | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<any | null>(null)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)

  const [coaching, setCoaching] = useState<{ users: CoachingUser[]; count?: number } | null>(null)
  const [coachingLoading, setCoachingLoading] = useState(false)
  const [coachingError, setCoachingError] = useState<any | null>(null)
  const [coachingLoaded, setCoachingLoaded] = useState(false)

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const data = await fetchAdminAnalytics()
      setAnalytics(data)
      setAnalyticsLoaded(true)
    } catch (err) {
      setAnalyticsError(err)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  const loadCoaching = useCallback(async () => {
    setCoachingLoading(true)
    setCoachingError(null)
    try {
      const data = await fetchAdminCoaching()
      setCoaching(data)
      setCoachingLoaded(true)
    } catch (err) {
      setCoachingError(err)
    } finally {
      setCoachingLoading(false)
    }
  }, [])

  // Lazy-fetch each tab the first time it is opened.
  useEffect(() => {
    if (activeTab === 'analytics' && !analyticsLoaded && !analyticsLoading && !analyticsError) {
      loadAnalytics()
    }
    if (activeTab === 'coaching' && !coachingLoaded && !coachingLoading && !coachingError) {
      loadCoaching()
    }
  }, [activeTab, analyticsLoaded, analyticsLoading, analyticsError, coachingLoaded, coachingLoading, coachingError, loadAnalytics, loadCoaching])

  // dailyCounts keys are dates — sort chronologically and keep the last 14.
  const last14: [string, number][] = analytics?.dailyCounts
    ? Object.entries(analytics.dailyCounts as Record<string, number>).sort(([a], [b]) => a.localeCompare(b)).slice(-14)
    : []
  const maxDaily = last14.reduce((m, [, v]) => Math.max(m, v), 0)

  const coachingUsers: CoachingUser[] = coaching?.users || []
  const totalActiveGoals = coachingUsers.reduce((a, u) => a + (u.stats?.activeGoals || 0), 0)
  const totalTasks = coachingUsers.reduce((a, u) => a + (u.stats?.pendingTasks || 0) + (u.stats?.completedTasks || 0), 0)
  const totalFocusMinutes = coachingUsers.reduce((a, u) => a + (u.stats?.focusMinutesTotal || 0), 0)

  return (
    <div className="min-h-[100dvh] max-w-lg mx-auto bg-[#FAF9F6]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-stone-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-stone-800 flex items-center gap-2" style={{ fontFamily: "'Georgia', serif" }}>
            Admin <Shield className="w-4 h-4 text-amber-500" />
          </h1>
          <p className="text-xs text-stone-500">Owner only</p>
        </div>
      </header>

      <div className="flex border-b border-stone-100">
        {([
          { id: 'analytics' as const, label: 'Analytics' },
          { id: 'coaching' as const, label: 'Coaching' },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-all ${
              activeTab === tab.id ? 'text-amber-600 border-b-2 border-amber-500' : 'text-stone-400'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 pb-24 space-y-4">

        {/* ═══ ANALYTICS ═══ */}
        {activeTab === 'analytics' && (
          <>
            {analyticsLoading && <LoadingState />}
            {!analyticsLoading && analyticsError && <ErrorState error={analyticsError} onRetry={loadAnalytics} />}
            {!analyticsLoading && !analyticsError && analytics && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard value={(analytics.totalEvents ?? 0).toLocaleString()} label="Total events" />
                  <StatCard value={(analytics.todayEvents ?? 0).toLocaleString()} label="Today" />
                  <StatCard value={(analytics.weekEvents ?? 0).toLocaleString()} label="Last 7 days" />
                  <StatCard value={(analytics.uniqueUsers ?? 0).toLocaleString()} label="Unique users" />
                </div>

                {/* 14-day bar chart */}
                <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
                  <h3 className="font-semibold text-stone-800 text-sm mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" /> Daily Activity — Last 14 Days
                  </h3>
                  {last14.length === 0 ? (
                    <p className="text-xs text-stone-400">No activity data yet</p>
                  ) : (
                    <div className="flex items-end gap-1">
                      {last14.map(([date, count], i) => (
                        <div key={date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                          <span className="text-[9px] font-medium text-stone-500">{count}</span>
                          <div className="w-full h-24 flex items-end">
                            <div
                              className="w-full rounded-t-md bg-amber-400 hover:bg-amber-500 transition-colors"
                              style={{ height: `${maxDaily > 0 ? Math.max(4, Math.round((count / maxDaily) * 100)) : 4}%` }}
                              title={`${date}: ${count}`}
                            />
                          </div>
                          <span className="text-[8px] text-stone-400 truncate w-full text-center">
                            {i % 2 === 0 ? date.substring(5) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {analytics.serverTime && (
                    <p className="text-[10px] text-stone-400 mt-3 text-center">Server: {formatTime(analytics.serverTime)}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 items-start">
                  <CountList title="Devices" entries={sortedEntries(analytics.devices)} />
                  <CountList title="Browsers" entries={sortedEntries(analytics.browsers)} />
                </div>

                <CountList title="Tab Usage" entries={sortedEntries(analytics.tabUsage)} />

                {/* Recent errors */}
                <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
                  <h3 className="font-semibold text-stone-800 text-sm mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" /> Recent Errors
                  </h3>
                  {(!analytics.recentErrors || analytics.recentErrors.length === 0) ? (
                    <p className="text-xs text-stone-400">No errors recorded</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics.recentErrors.slice(0, 10).map((e: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-xl bg-stone-50">
                          <p className="text-xs text-stone-500 leading-relaxed">{e.message || e.error || e.type || 'Error'}</p>
                          <p className="text-[10px] text-stone-400 mt-1">{formatTime(e.timestamp || e.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent events */}
                <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
                  <h3 className="font-semibold text-stone-800 text-sm mb-3">Recent Events</h3>
                  {(!analytics.recentEvents || analytics.recentEvents.length === 0) ? (
                    <p className="text-xs text-stone-400">No events recorded</p>
                  ) : (
                    <div className="space-y-1.5">
                      {analytics.recentEvents.slice(0, 15).map((e: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-xs text-stone-600 truncate">
                            {e.type || 'event'}{e.tab ? <span className="text-stone-400"> · {e.tab}</span> : e.action ? <span className="text-stone-400"> · {e.action}</span> : null}
                          </span>
                          <span className="text-[10px] text-stone-400 flex-none">{formatTime(e.timestamp || e.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ COACHING ═══ */}
        {activeTab === 'coaching' && (
          <>
            {coachingLoading && <LoadingState />}
            {!coachingLoading && coachingError && <ErrorState error={coachingError} onRetry={loadCoaching} />}
            {!coachingLoading && !coachingError && coaching && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard value={coaching.count ?? coachingUsers.length} label="Clients" />
                  <StatCard value={totalActiveGoals} label="Active Goals" />
                  <StatCard value={totalTasks} label="Total Tasks" />
                  <StatCard value={`${Math.round(totalFocusMinutes / 60)}h`} label="Focus Hours" />
                </div>

                {coachingUsers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm text-center">
                    <Users className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                    <p className="text-sm text-stone-600">No Guided plan clients yet.</p>
                    <p className="text-xs text-stone-400 mt-1">When someone subscribes to the Guided plan, they'll appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {coachingUsers.map(u => {
                      const expanded = expandedUserId === u.userId
                      return (
                        <div key={u.userId} className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                          <button
                            onClick={() => setExpandedUserId(expanded ? null : u.userId)}
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-stone-50 transition-colors">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-200 to-rose-300 flex items-center justify-center font-bold text-sm text-rose-700 flex-none">
                              {initials(u.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-stone-800 truncate">{u.name || 'Guided client'}</p>
                              <p className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Last active: {formatDateTime(u.lastActive)}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 text-[11px] text-stone-600 bg-stone-50 px-2 py-0.5 rounded-lg">
                                  <Target className="w-3 h-3 text-amber-500" /> {u.stats?.activeGoals ?? 0} goals
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-stone-600 bg-stone-50 px-2 py-0.5 rounded-lg">
                                  <CheckCircle className="w-3 h-3 text-emerald-500" /> {u.stats?.completedTasks ?? 0} done
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] text-stone-600 bg-stone-50 px-2 py-0.5 rounded-lg">
                                  <BookOpen className="w-3 h-3 text-indigo-400" /> {u.stats?.journalEntries ?? 0} entries
                                </span>
                              </div>
                            </div>
                            <ChevronDown className={`w-5 h-5 text-stone-300 flex-none transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </button>

                          {expanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-stone-100">
                              {(!u.goals || u.goals.length === 0) ? (
                                <p className="text-xs text-stone-400 py-3">No active goals set yet</p>
                              ) : (
                                u.goals.map(g => {
                                  const pct = g.progress ?? 0
                                  const daysLeft = g.targetDate ? Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000) : null
                                  return (
                                    <div key={g.id} className="bg-stone-50 rounded-xl p-4 mt-3 border border-stone-100">
                                      <p className="text-sm font-semibold text-stone-800">{g.title}</p>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 mb-2">
                                        <span className="text-[11px] text-stone-400">{g.category || 'general'}</span>
                                        <span className="text-[11px] text-stone-400">{g.completedSteps}/{g.totalSteps} steps</span>
                                        {g.targetDate && (
                                          <span className="text-[11px] text-stone-400">
                                            Target {new Date(g.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            {daysLeft !== null && (
                                              daysLeft < 0
                                                ? <span className="text-red-500 font-medium"> · {Math.abs(daysLeft)}d overdue</span>
                                                : <span> · {daysLeft}d left</span>
                                            )}
                                          </span>
                                        )}
                                        <span className="text-[11px] font-medium text-stone-500">{pct}%</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${pct >= 50 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                        />
                                      </div>

                                      {g.tasks && g.tasks.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5 flex items-center gap-1">
                                            <ListChecks className="w-3 h-3" /> Tasks ({g.tasks.filter(t => t.status === 'done').length}/{g.tasks.length})
                                          </p>
                                          <div className="space-y-0.5">
                                            {g.tasks.map((t, ti) => (
                                              <div key={ti} className="flex items-center gap-2 py-1">
                                                <span className={`w-4 h-4 rounded-full border-2 flex-none ${t.status === 'done' ? 'bg-emerald-400 border-emerald-400' : 'border-stone-300'}`} />
                                                <span className={`text-xs flex-1 ${t.status === 'done' ? 'line-through text-stone-400' : 'text-stone-600'}`}>{t.text}</span>
                                                {t.dueDate && (
                                                  <span className="text-[10px] text-stone-400 flex-none">
                                                    {new Date(t.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {g.habits && g.habits.length > 0 && (
                                        <div className="mt-3">
                                          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">Habits</p>
                                          <div className="space-y-1">
                                            {g.habits.map((h, hi) => (
                                              <div key={hi} className="flex items-center gap-2">
                                                <span className="text-sm">{h.emoji || '•'}</span>
                                                <span className="text-xs text-stone-600 flex-1">{h.name}</span>
                                                {h.streak > 0 && (
                                                  <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">🔥 {h.streak}d</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
