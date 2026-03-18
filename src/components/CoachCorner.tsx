import { useState } from 'react'
import type { AppState } from '@/App'
import { ArrowLeft, Calendar, Bot, User, ExternalLink, ChevronRight, CheckCircle, TrendingUp, Target } from 'lucide-react'

interface Props {
  state: AppState
  onClose: () => void
  onOpenChat?: (prefill?: string) => void
}

export function CoachCorner({ state, onClose, onOpenChat }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'goals' | 'checkins'>('overview')
  const name = state.profile.name?.split(' ')[0] || 'there'
  
  const todayStr = new Date().toISOString().split('T')[0]
  const thisWeekEntries = state.journal.filter(j => new Date(j.createdAt) >= new Date(Date.now() - 7 * 86400000))
  const habits = state.habits || []
  const habitsWithStreaks = habits.map(h => {
    let streak = 0
    for (let i = 0; i < 60; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      if (h.completions.includes(d.toISOString().split('T')[0])) streak++
      else if (i > 0) break
    }
    return { ...h, streak, doneToday: h.completions.includes(todayStr) }
  })
  const totalFocusThisWeek = (state.focusSessions || [])
    .filter(s => new Date(s.date) >= new Date(Date.now() - 7 * 86400000))
    .reduce((a, b) => a + b.minutes, 0)
  const completedThisWeek = state.items.filter(i => i.status === 'done' && i.completedAt && new Date(i.completedAt) >= new Date(Date.now() - 7 * 86400000)).length
  const activeGoals = (state.goals || []).filter(g => g.status === 'active')

  const askAI = (prompt: string) => {
    if (onOpenChat) onOpenChat(prompt)
    else onClose()
  }

  return (
    <div className="min-h-[100dvh] max-w-lg mx-auto bg-[#FAF9F6]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-stone-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Coaching Hub</h1>
          <p className="text-xs text-stone-500">Guided Plan</p>
        </div>
      </header>

      <div className="flex border-b border-stone-100">
        {([
          { id: 'overview' as const, label: 'Overview' },
          { id: 'goals' as const, label: 'Goals' },
          { id: 'checkins' as const, label: 'Check-ins' },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-all ${
              activeTab === tab.id ? 'text-rose-600 border-b-2 border-rose-500' : 'text-stone-400'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 pb-24 space-y-4">

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <>
            {/* What you get */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-5 border border-rose-100">
              <h2 className="text-base font-bold text-stone-800 mb-3" style={{ fontFamily: "'Georgia', serif" }}>
                Your Coaching Plan
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-none mt-0.5">
                    <User className="w-4 h-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">Monthly Goal Review Call</p>
                    <p className="text-xs text-stone-600 leading-relaxed">30 minutes with a real coach to review your goals, celebrate wins, and plan your next moves.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-none mt-0.5">
                    <Bot className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">AI Coach — Always On</p>
                    <p className="text-xs text-stone-600 leading-relaxed">Your AI coach handles everything between calls — weekly check-ins, journal insights, habit accountability, daily strategy, and real-time guidance in Chat.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule call */}
            <a href="https://calendly.com/idealclarity" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 w-full p-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg hover:from-rose-600 hover:to-pink-600 transition-all">
              <Calendar className="w-5 h-5 flex-none" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Book Your Monthly Goal Review</p>
                <p className="text-xs text-white/80">30 min with your personal coach</p>
              </div>
              <ExternalLink className="w-4 h-4 text-white/60" />
            </a>

            {/* Weekly snapshot */}
            <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
              <h3 className="font-semibold text-stone-800 text-sm mb-3">This Week</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{completedThisWeek}</p>
                  <p className="text-[10px] text-stone-500">tasks done</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{thisWeekEntries.length}</p>
                  <p className="text-[10px] text-stone-500">journal entries</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{totalFocusThisWeek}m</p>
                  <p className="text-[10px] text-stone-500">focus time</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{habitsWithStreaks.filter(h => h.doneToday).length}/{habits.length}</p>
                  <p className="text-[10px] text-stone-500">habits today</p>
                </div>
              </div>
            </div>

            {/* Quick AI actions */}
            <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
              <h3 className="font-semibold text-stone-800 text-sm mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-500" /> Talk to Your AI Coach
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'How am I doing this week?', prompt: 'Give me a coaching check-in. Review my tasks, habits, journal, and focus sessions this week. Be specific about what I did well and where I can improve.' },
                  { label: 'Help me plan my week', prompt: 'Help me plan my week. Look at my pending tasks, goals, habits, and calendar and suggest a strategy for the next 7 days.' },
                  { label: 'What should I focus on today?', prompt: 'What should I focus on today based on my current tasks, goals, habits, and priorities?' },
                ].map((action, i) => (
                  <button key={i} onClick={() => askAI(action.prompt)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-amber-50 text-left transition-all">
                    <span className="text-sm text-stone-700 flex-1">{action.label}</span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ GOALS ═══ */}
        {activeTab === 'goals' && (
          <>
            <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
              <h3 className="font-semibold text-stone-800 text-sm mb-2">How It Works</h3>
              <div className="space-y-3 mt-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-none text-xs font-bold text-amber-600">1</div>
                  <p className="text-sm text-stone-600">Tell your <strong>AI coach</strong> what you want to achieve — it creates goals, tasks, and habits for you</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-none text-xs font-bold text-amber-600">2</div>
                  <p className="text-sm text-stone-600">Check off tasks and habits daily on your <strong>Board</strong> — your AI coach tracks everything and keeps you accountable</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-none text-xs font-bold text-rose-600">3</div>
                  <p className="text-sm text-stone-600">Once a month, your <strong>human coach reviews your goals</strong> with you on a 30-minute call</p>
                </div>
              </div>
            </div>

            {/* AI goal prompts */}
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
              <h3 className="font-semibold text-stone-800 text-sm mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-500" /> Set Goals with Your AI Coach
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Help me set a goal for this month', prompt: 'Help me set a meaningful goal for this month. Ask me what matters most to me right now and help me create a specific, actionable plan with tasks and habits.' },
                  { label: 'Break down a big goal into steps', prompt: 'I have a big goal I want to achieve. Help me break it down into weekly tasks and daily habits I can track on my Board.' },
                  { label: 'Review my progress on my goals', prompt: 'Review my current goals, tasks, and habits. How am I doing? What should I adjust?' },
                ].map((action, i) => (
                  <button key={i} onClick={() => askAI(action.prompt)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white hover:bg-amber-100/50 text-left transition-all shadow-sm">
                    <span className="text-sm text-stone-700 flex-1">{action.label}</span>
                    <ChevronRight className="w-4 h-4 text-amber-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* Active goals */}
            {activeGoals.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
                <h3 className="font-semibold text-stone-800 text-sm mb-3">Your Active Goals</h3>
                <div className="space-y-2">
                  {activeGoals.map(g => {
                    const tasks = state.items.filter(i => i.goalId === g.id)
                    const done = tasks.filter(t => t.status === 'done').length
                    const total = tasks.length + g.milestones.length
                    const completed = done + g.milestones.filter(m => m.completed).length
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                    return (
                      <div key={g.id} className="p-3 rounded-xl bg-stone-50">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-sm font-medium text-stone-700 flex-1">{g.title}</span>
                          <span className="text-xs text-stone-400">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-200 rounded-full">
                          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-stone-400 mt-3 text-center">Your coach will review these goals during your next monthly call</p>
              </div>
            )}
          </>
        )}

        {/* ═══ CHECK-INS ═══ */}
        {activeTab === 'checkins' && (
          <>
            {/* AI Coach check-ins */}
            <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">Your AI Coach</p>
                  <p className="text-[10px] text-stone-400">Handles your weekly check-ins, journal analysis, and daily accountability</p>
                </div>
              </div>

              {/* Live AI assessment */}
              <div className="bg-amber-50/50 rounded-xl p-4 mb-3">
                <p className="text-sm text-stone-700 leading-relaxed">
                  {thisWeekEntries.length >= 3
                    ? `Strong journaling this week — ${thisWeekEntries.length} entries! Your AI coach reads every one and uses them to give you better advice. `
                    : thisWeekEntries.length > 0
                    ? `${thisWeekEntries.length} journal ${thisWeekEntries.length === 1 ? 'entry' : 'entries'} this week. Writing daily helps your AI coach understand you better. `
                    : `No journal entries this week yet. Your AI coach uses your journal to personalize check-ins — even 60 seconds a day makes a difference. `
                  }
                  {habitsWithStreaks.some(h => h.streak >= 7)
                    ? `${habitsWithStreaks.find(h => h.streak >= 7)?.emoji} ${habitsWithStreaks.find(h => h.streak >= 7)?.name} streak: ${habitsWithStreaks.find(h => h.streak >= 7)?.streak} days! `
                    : habits.length > 0 ? `Keep building those habit streaks — consistency is where the magic happens. ` : ''
                  }
                  {totalFocusThisWeek > 60
                    ? `${totalFocusThisWeek} minutes of focused work this week.`
                    : totalFocusThisWeek > 0 ? `${totalFocusThisWeek} minutes focused this week — try the Pomodoro timer for deeper work sessions.` : ''
                  }
                </p>
              </div>

              <p className="text-xs text-stone-500 mb-3">Your AI coach automatically handles:</p>
              <div className="space-y-2">
                {[
                  'Weekly check-ins based on your goals, habits, and journal',
                  'Morning daily briefing with your priorities and schedule',
                  'Monday strategy sessions reviewing your week ahead',
                  'Mood-aware nudges — gentler on your hard days',
                  'Real-time coaching anytime you ask in Chat',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-none" />
                    <p className="text-xs text-stone-600">{item}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => askAI('Give me my weekly coaching check-in. Review everything — my goals, tasks, habits, journal entries, and focus sessions. Be honest and specific about what I did well and what needs work.')}
                className="w-full mt-3 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium shadow-sm hover:bg-amber-600 transition-all">
                Get This Week's Check-in →
              </button>
            </div>

            {/* Monthly call */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">Monthly Goal Review</p>
                  <p className="text-[10px] text-stone-400">30-minute call with your personal coach</p>
                </div>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed mb-3">
                Once a month, sit down with a real coach who reviews your goals, helps you see what's working, and sets you up for the month ahead. Your AI coach handles everything else in between.
              </p>
              <a href="https://calendly.com/idealclarity" target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-rose-500 text-white text-sm font-medium shadow-sm hover:bg-rose-600 transition-all">
                <Calendar className="w-4 h-4" /> Book Your Call
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
