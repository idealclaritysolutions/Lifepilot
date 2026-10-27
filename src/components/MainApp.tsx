import { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from '@/lib/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatView } from '@/components/ChatView'
import { LifeBoard } from '@/components/LifeBoard'
import { NudgesView } from '@/components/NudgesView'
import { PeopleView } from '@/components/PeopleView'
import { HabitsView } from '@/components/HabitsView'
import { CoachCorner } from '@/components/CoachCorner'
import { Settings } from '@/components/Settings'
import { SetupPrompt } from '@/components/SetupPrompt'
import { AccountView } from '@/components/AccountView'

// Heavy overlay / non-first-screen views are code-split out of the main chunk.
// ChatView, LifeBoard and the tab shell stay static (first-screen path).
// Named exports need adapting to a default export for React.lazy.
const SubscriptionView = lazy(() =>
  import('@/components/SubscriptionView').then((m) => ({ default: m.SubscriptionView }))
)
const SharedListView = lazy(() =>
  import('@/components/SharedListView').then((m) => ({ default: m.SharedListView }))
)
const JournalView = lazy(() =>
  import('@/components/JournalView').then((m) => ({ default: m.JournalView }))
)
// FocusTimerView is a default export.
const FocusTimerView = lazy(() => import('@/components/FocusTimerView'))
const AdminView = lazy(() =>
  import('@/components/AdminView').then((m) => ({ default: m.AdminView }))
)

function ViewLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 w-full min-h-[200px] py-16 bg-[#FAF9F6]">
      <div className="w-8 h-8 rounded-full border-2 border-stone-200 border-t-amber-500 animate-spin" />
      <p className="text-sm text-stone-500">Loading…</p>
    </div>
  )
}
import type { AppState, LifeItem, JournalEntry, UserProfile, Person, Habit, Purchase, Subscription, TIER_LIMITS } from '@/App'
import type { UserLocation } from '@/hooks/use-location'
import { MessageCircle, LayoutGrid, Bell, BookOpen, Users, Flame, Settings as SettingsIcon, Crown, UserCircle, Timer, X, Target, Shield } from 'lucide-react'
import { isAdminEmail } from '@/lib/admin'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  addItem: (item: LifeItem) => void
  updateItem: (id: string, updates: Partial<LifeItem>) => void
  removeItem: (id: string) => void
  addChat: (msg: { role: 'user' | 'assistant'; content: string }) => void
  addJournalEntry: (entry: JournalEntry) => void
  deleteJournalEntry: (id: string) => void
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  setUserLocation: (loc: UserLocation | null) => void
  addPerson: (person: Person) => void
  updatePerson: (id: string, updates: Partial<Person>) => void
  removePerson: (id: string) => void
  addHabit: (habit: Habit) => void
  toggleHabitDay: (habitId: string, dateStr: string) => void
  removeHabit: (id: string) => void
  updateHabit: (id: string, updates: Partial<import('@/App').Habit>) => void
  addGoal: (goal: import('@/App').Goal) => void
  updateGoal: (id: string, updates: Partial<import('@/App').Goal>) => void
  removeGoal: (id: string) => void
  addPurchase: (purchase: Purchase) => void
  applyPromoCode: (code: string) => boolean
  setSubscription: (sub: Subscription) => void
  incrementMessageCount: () => void
  notifications: any
  locationHook: any
  onReset: () => void
}

export function MainApp(props: Props) {
  const { state, setState, addItem, updateItem, removeItem, addChat, addJournalEntry, deleteJournalEntry, updateJournalEntry, updateProfile, setUserLocation, addPerson, updatePerson, removePerson, addHabit, toggleHabitDay, removeHabit, updateHabit, addGoal, updateGoal, removeGoal, addPurchase, applyPromoCode, setSubscription, incrementMessageCount, notifications, locationHook, onReset } = props
  
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const action = params.get('action')
      if (action === 'journal-voice' || action === 'journal') return 'journal'
    } catch {}
    // Restore last active tab from sessionStorage
    try {
      const saved = sessionStorage.getItem('lp-active-tab')
      if (saved && ['chat', 'board', 'people', 'journal', 'habits'].includes(saved)) return saved
    } catch {}
    return 'chat'
  })
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    try { sessionStorage.setItem('lp-active-tab', tab) } catch {}
  }
  const [showSettings, setShowSettings] = useState(() => sessionStorage.getItem('lp-overlay') === 'settings')
  const [showSubscription, setShowSubscription] = useState(() => sessionStorage.getItem('lp-overlay') === 'subscription')
  const [showAccount, setShowAccount] = useState(() => sessionStorage.getItem('lp-overlay') === 'account')
  const [showSharedList, setShowSharedList] = useState(() => sessionStorage.getItem('lp-overlay') === 'sharedlist')
  const [showAdmin, setShowAdmin] = useState(() => sessionStorage.getItem('lp-overlay') === 'admin')
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [showCoachCorner, setShowCoachCorner] = useState(false)
  const [coachNudgeDismissed, setCoachNudgeDismissed] = useState(() => {
    try { return sessionStorage.getItem('lp-coach-nudge-dismissed') === '1' } catch { return false }
  })

  // Track overlay changes in sessionStorage
  useEffect(() => {
    if (showSettings) sessionStorage.setItem('lp-overlay', 'settings')
    else if (showSubscription) sessionStorage.setItem('lp-overlay', 'subscription')
    else if (showAccount) sessionStorage.setItem('lp-overlay', 'account')
    else if (showSharedList) sessionStorage.setItem('lp-overlay', 'sharedlist')
    else if (showAdmin) sessionStorage.setItem('lp-overlay', 'admin')
    else sessionStorage.removeItem('lp-overlay')
  }, [showSettings, showSubscription, showAccount, showSharedList, showAdmin])
  const { isSignedIn, user, userEmail } = useAuth()

  const overdueCount = state.items.filter(i => {
    if (i.status !== 'pending') return false
    return (Date.now() - new Date(i.createdAt).getTime()) / 3600000 >= 24
  }).length

  const now = new Date()
  const todayMidnightForCount = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const upcomingCount = state.people.reduce((count, person) => {
    return count + person.events.filter(event => {
      const mmdd = event.date.length === 5 ? event.date : event.date.substring(5)
      const [mm, dd] = mmdd.split('-').map(Number)
      const thisYear = now.getFullYear()
      let eventDate = new Date(thisYear, mm - 1, dd)
      if (eventDate < todayMidnightForCount) eventDate = new Date(thisYear + 1, mm - 1, dd)
      const daysUntil = Math.round((eventDate.getTime() - todayMidnightForCount.getTime()) / 86400000)
      return daysUntil >= 0 && daysUntil <= 7
    }).length
  }, 0)

  const TIER_NAMES: Record<string, string> = { free: '', pro: 'LIFE PILOT', premium: 'INNER CIRCLE', enterprise: 'GUIDED' }
  const tierLabel = TIER_NAMES[state.subscription.tier] || ''

  if (showSubscription) {
    return (
      <Suspense fallback={<ViewLoading />}>
        <SubscriptionView state={state} applyPromoCode={applyPromoCode} onClose={() => setShowSubscription(false)} />
      </Suspense>
    )
  }

  if (showSettings) {
    return <Settings state={state} notifications={notifications} locationHook={locationHook} updateProfile={updateProfile} setUserLocation={setUserLocation} updateState={(updates) => {
      setState(prev => {
        const next = { ...prev }
        for (const [k, v] of Object.entries(updates)) {
          if (k === 'featureToggles' && v && typeof v === 'object') {
            next.featureToggles = { ...(prev.featureToggles || { tasks: true, journal: true, habits: true, sharedLists: true, people: true, focusTimer: true }), ...v }
          } else if (k === 'subscription' && v && typeof v === 'object') {
            next.subscription = { ...prev.subscription, ...v } as any
          } else {
            (next as any)[k] = v
          }
        }
        return next
      })
    }} onClose={() => setShowSettings(false)} onReset={onReset} />
  }

  if (showCoachCorner) {
    return <CoachCorner state={state} onClose={() => setShowCoachCorner(false)} onOpenChat={(prompt) => {
      setShowCoachCorner(false)
      setActiveTab('chat')
      // Store prompt for ChatView to pick up
      if (prompt) sessionStorage.setItem('lp-chat-prefill', prompt)
    }} />
  }

  if (showAccount) {
    return <AccountView onClose={() => setShowAccount(false)} />
  }

  if (showAdmin) {
    return (
      <Suspense fallback={<ViewLoading />}>
        <AdminView onClose={() => setShowAdmin(false)} />
      </Suspense>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col max-w-lg mx-auto">
      {/* Post-onboarding setup prompt — shows once if notifications/location not enabled */}
      {(!state.profile.notificationsEnabled || !state.profile.locationEnabled) && (
        <SetupPrompt
          onGoToSettings={() => setShowSettings(true)}
          onSkip={() => {}}
        />
      )}
      <header className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-[#FAF9F6]">
        <div className="flex items-center gap-2.5">
          <img src="/icon-192.png" alt="Life Pilot AI logo" className="w-9 h-9 rounded-xl" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-stone-800 leading-tight" style={{ fontFamily: "'Georgia', serif" }}>Life Pilot AI</h1>
              {tierLabel && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">{tierLabel}</span>
              )}
            </div>
            <p className="text-xs text-stone-600 leading-tight">Hey {state.profile.name} 👋</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {state.subscription.isTrial && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">TRIAL</span>
          )}
          {state.subscription.tier === 'enterprise' && (
            <button onClick={() => setShowCoachCorner(true)} title="Coaching Hub"
              className="w-9 h-9 rounded-xl hover:bg-rose-50 flex items-center justify-center transition-colors">
              <Target className="w-5 h-5 text-rose-500" />
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center transition-colors">
              {showHeaderMenu ? (
                <X className="w-5 h-5 text-stone-600" />
              ) : isSignedIn && user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{state.profile.name?.charAt(0) || '?'}</span>
                </div>
              )}
            </button>
            {showHeaderMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                <div className="absolute right-0 top-11 w-56 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50 overflow-hidden">
                  <button onClick={() => { setShowAccount(true); setShowHeaderMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 text-left transition-colors">
                    <UserCircle className="w-5 h-5 text-stone-500" />
                    <span className="text-sm text-stone-700 font-medium">Account</span>
                  </button>
                  {isSignedIn && isAdminEmail(userEmail) && (
                    <button onClick={() => { setShowAdmin(true); setShowHeaderMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 text-left transition-colors">
                      <Shield className="w-5 h-5 text-amber-500" />
                      <span className="text-sm text-stone-700 font-medium">Admin</span>
                    </button>
                  )}
                  <button onClick={() => { setShowSubscription(true); setShowHeaderMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 text-left transition-colors">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <span className="text-sm text-stone-700 font-medium">Upgrade Plan</span>
                  </button>
                  {state.subscription.tier === 'enterprise' && (
                    <button onClick={() => { setShowCoachCorner(true); setShowHeaderMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-rose-50 text-left transition-colors">
                      <Target className="w-5 h-5 text-rose-500" />
                      <span className="text-sm text-rose-700 font-medium">Coaching Hub</span>
                    </button>
                  )}
                  <div className="h-px bg-stone-100 mx-3 my-1" />
                  <button onClick={() => { setShowSettings(true); setShowHeaderMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 text-left transition-colors">
                    <SettingsIcon className="w-5 h-5 text-stone-400" />
                    <span className="text-sm text-stone-700 font-medium">Settings</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {state.subscription.tier === 'enterprise' && !coachNudgeDismissed && (
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border-b border-rose-100">
          <Target className="w-4 h-4 text-rose-500 flex-none" />
          <p className="flex-1 text-xs text-rose-700 leading-snug">Guided plan: your Coaching Hub has your monthly review booking and progress →</p>
          <button onClick={() => setShowCoachCorner(true)}
            className="text-xs font-semibold text-rose-600 bg-white border border-rose-200 px-2.5 py-1 rounded-lg hover:bg-rose-100 transition-colors flex-none">
            Open
          </button>
          <button onClick={() => { setCoachNudgeDismissed(true); try { sessionStorage.setItem('lp-coach-nudge-dismissed', '1') } catch {} }}
            className="w-6 h-6 rounded-lg hover:bg-rose-100 flex items-center justify-center transition-colors flex-none" aria-label="Dismiss">
            <X className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <TabsContent value="chat" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
          <ChatView state={state} addItem={addItem} updateItem={updateItem} removeItem={removeItem} addChat={addChat} addPerson={addPerson} updatePerson={updatePerson} removePerson={removePerson} addPurchase={addPurchase} incrementMessageCount={incrementMessageCount} locationHook={locationHook} userId={user?.id} addHabit={addHabit} updateHabit={updateHabit} removeHabit={removeHabit} addJournalEntry={addJournalEntry} deleteJournalEntry={deleteJournalEntry} addGoal={addGoal} updateGoal={updateGoal} removeGoal={removeGoal} />
        </TabsContent>
        <TabsContent value="board" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <LifeBoard state={state} addItem={addItem} updateItem={updateItem} removeItem={removeItem} addGoal={addGoal} updateGoal={updateGoal} removeGoal={removeGoal} toggleHabitDay={toggleHabitDay} addHabit={addHabit} updateHabit={updateHabit} removeHabit={removeHabit} />
        </TabsContent>
        <TabsContent value="people" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <PeopleView state={state} addPerson={addPerson} updatePerson={updatePerson} removePerson={removePerson} />
        </TabsContent>
        <TabsContent value="journal" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <Suspense fallback={<ViewLoading />}>
            <JournalView state={state} addJournalEntry={addJournalEntry} deleteJournalEntry={deleteJournalEntry} updateJournalEntry={updateJournalEntry} />
          </Suspense>
        </TabsContent>
        <TabsContent value="lists" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <Suspense fallback={<ViewLoading />}>
            <SharedListView onClose={() => {}} state={state} isTab={true} />
          </Suspense>
        </TabsContent>
        <TabsContent value="focus" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <Suspense fallback={<ViewLoading />}>
            <FocusTimerView focusSessions={state.focusSessions || []} onSessionComplete={(minutes) => {
            const today = new Date().toISOString().split('T')[0]
            const sessions = [...(state.focusSessions || [])]
            const idx = sessions.findIndex(s => s.date === today)
            if (idx >= 0) {
              sessions[idx] = { ...sessions[idx], minutes: sessions[idx].minutes + minutes, count: sessions[idx].count + 1 }
            } else {
              sessions.push({ date: today, minutes, count: 1 })
            }
            setState(prev => ({ ...prev, focusSessions: sessions.slice(-60) }))
          }} onAICoach={(message) => {
            addChat({ role: 'assistant', content: message })
          }} />
          </Suspense>
        </TabsContent>

        <TabsList className={`flex-none grid h-16 bg-white border-t border-stone-100 rounded-none shadow-[0_-2px_10px_rgba(0,0,0,0.04)]`}
          style={{ gridTemplateColumns: `repeat(${[true, state.featureToggles?.tasks !== false, state.featureToggles?.people !== false, state.featureToggles?.journal !== false, state.featureToggles?.habits !== false, state.featureToggles?.focusTimer !== false].filter(Boolean).length}, 1fr)` }}>
          <TabsTrigger value="chat"
            className="flex flex-col items-center gap-0.5 data-[state=active]:text-amber-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none">
            <MessageCircle className="w-5 h-5" /><span className="text-xs font-medium">Chat</span>
          </TabsTrigger>
          {state.featureToggles?.tasks !== false && (
            <TabsTrigger value="board"
              className="flex flex-col items-center gap-0.5 data-[state=active]:text-amber-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none relative">
              <LayoutGrid className="w-5 h-5" /><span className="text-xs font-medium">Board</span>
              {overdueCount > 0 && <span className="absolute top-0.5 right-1/4 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{overdueCount}</span>}
            </TabsTrigger>
          )}
          {state.featureToggles?.people !== false && (
            <TabsTrigger value="people"
              className="flex flex-col items-center gap-0.5 data-[state=active]:text-rose-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none relative">
              <Users className="w-5 h-5" /><span className="text-xs font-medium">People</span>
              {upcomingCount > 0 && <span className="absolute top-0.5 right-1/4 min-w-[16px] h-[16px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{upcomingCount}</span>}
            </TabsTrigger>
          )}
          {state.featureToggles?.journal !== false && (
            <TabsTrigger value="journal"
              className="flex flex-col items-center gap-0.5 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none">
              <BookOpen className="w-5 h-5" /><span className="text-xs font-medium">Journal</span>
            </TabsTrigger>
          )}
          {state.featureToggles?.sharedLists !== false && (
            <TabsTrigger value="lists"
              className="flex flex-col items-center gap-0.5 data-[state=active]:text-pink-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none">
              <Users className="w-5 h-5" /><span className="text-xs font-medium">Lists</span>
            </TabsTrigger>
          )}
          {state.featureToggles?.focusTimer !== false && (
            <TabsTrigger value="focus"
              className="flex flex-col items-center gap-0.5 data-[state=active]:text-red-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none">
              <Timer className="w-5 h-5" /><span className="text-xs font-medium">Focus</span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
    </div>
  )
}
