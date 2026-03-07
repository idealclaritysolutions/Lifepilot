import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChatView } from '@/components/ChatView'
import { LifeBoard } from '@/components/LifeBoard'
import { NudgesView } from '@/components/NudgesView'
import { JournalView } from '@/components/JournalView'
import { PeopleView } from '@/components/PeopleView'
import { HabitsView } from '@/components/HabitsView'
import { Settings } from '@/components/Settings'
import { SubscriptionView } from '@/components/SubscriptionView'
import { SetupPrompt } from '@/components/SetupPrompt'
import { AccountView } from '@/components/AccountView'
import { SharedListView } from '@/components/SharedListView'
import type { AppState, LifeItem, JournalEntry, UserProfile, Person, Habit, Purchase, Subscription, TIER_LIMITS } from '@/App'
import type { UserLocation } from '@/hooks/use-location'
import { MessageCircle, LayoutGrid, Bell, BookOpen, Users, Flame, Settings as SettingsIcon, Crown, UserCircle } from 'lucide-react'

interface Props {
  state: AppState
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
  addPurchase: (purchase: Purchase) => void
  applyPromoCode: (code: string) => boolean
  setSubscription: (sub: Subscription) => void
  incrementMessageCount: () => void
  notifications: any
  locationHook: any
  onReset: () => void
}

export function MainApp(props: Props) {
  const { state, addItem, updateItem, removeItem, addChat, addJournalEntry, deleteJournalEntry, updateJournalEntry, updateProfile, setUserLocation, addPerson, updatePerson, removePerson, addHabit, toggleHabitDay, removeHabit, updateHabit, addPurchase, applyPromoCode, setSubscription, incrementMessageCount, notifications, locationHook, onReset } = props
  
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
  const [showSettings, setShowSettings] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showSharedList, setShowSharedList] = useState(false)
  const { isSignedIn, user } = useAuth()

  const overdueCount = state.items.filter(i => {
    if (i.status !== 'pending') return false
    return (Date.now() - new Date(i.createdAt).getTime()) / 3600000 >= 24
  }).length

  const now = new Date()
  const upcomingCount = state.people.reduce((count, person) => {
    return count + person.events.filter(event => {
      const mmdd = event.date.length === 5 ? event.date : event.date.substring(5)
      const [mm, dd] = mmdd.split('-').map(Number)
      const thisYear = now.getFullYear()
      let eventDate = new Date(thisYear, mm - 1, dd)
      if (eventDate < now) eventDate = new Date(thisYear + 1, mm - 1, dd)
      const daysUntil = Math.floor((eventDate.getTime() - now.getTime()) / 86400000)
      return daysUntil >= 0 && daysUntil <= 7
    }).length
  }, 0)

  const TIER_NAMES: Record<string, string> = { free: '', pro: 'LIFE PILOT', premium: 'INNER CIRCLE', enterprise: 'GUIDED' }
  const tierLabel = TIER_NAMES[state.subscription.tier] || ''

  if (showSubscription) {
    return <SubscriptionView state={state} applyPromoCode={applyPromoCode} onClose={() => setShowSubscription(false)} />
  }

  if (showSettings) {
    return <Settings state={state} notifications={notifications} locationHook={locationHook} updateProfile={updateProfile} setUserLocation={setUserLocation} onClose={() => setShowSettings(false)} onReset={onReset} />
  }

  if (showAccount) {
    return <AccountView onClose={() => setShowAccount(false)} />
  }

  if (showSharedList) {
    return <SharedListView onClose={() => setShowSharedList(false)} state={state} />
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center shadow-sm">
            <span className="text-lg">✦</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-stone-800 leading-tight" style={{ fontFamily: "'Georgia', serif" }}>LifePilot</h1>
              {tierLabel && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">{tierLabel}</span>
              )}
            </div>
            <p className="text-xs text-stone-600 leading-tight">Hey {state.profile.name} 👋</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSharedList(true)}
            title="Family Sharing"
            className="w-9 h-9 rounded-xl hover:bg-pink-50 flex items-center justify-center transition-colors">
            <Users className="w-5 h-5 text-pink-400" />
          </button>
          <button onClick={() => setShowAccount(true)}
            className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center transition-colors">
            {isSignedIn && user?.imageUrl ? (
              <img src={user.imageUrl} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <UserCircle className="w-5 h-5 text-stone-600" />
            )}
          </button>
          <button onClick={() => setShowSubscription(true)}
            className="w-9 h-9 rounded-xl hover:bg-amber-50 flex items-center justify-center transition-colors">
            <Crown className="w-5 h-5 text-amber-400" />
          </button>
          <button onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center transition-colors">
            <SettingsIcon className="w-5 h-5 text-stone-600" />
          </button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <TabsContent value="chat" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
          <ChatView state={state} addItem={addItem} updateItem={updateItem} removeItem={removeItem} addChat={addChat} addPerson={addPerson} updatePerson={updatePerson} addPurchase={addPurchase} incrementMessageCount={incrementMessageCount} locationHook={locationHook} userId={user?.id} />
        </TabsContent>
        <TabsContent value="board" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <LifeBoard state={state} updateItem={updateItem} removeItem={removeItem} />
        </TabsContent>
        <TabsContent value="people" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <PeopleView state={state} addPerson={addPerson} updatePerson={updatePerson} removePerson={removePerson} />
        </TabsContent>
        <TabsContent value="journal" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <JournalView state={state} addJournalEntry={addJournalEntry} deleteJournalEntry={deleteJournalEntry} updateJournalEntry={updateJournalEntry} />
        </TabsContent>
        <TabsContent value="habits" className="flex-1 overflow-auto m-0 data-[state=inactive]:hidden">
          <HabitsView state={state} addHabit={addHabit} toggleHabitDay={toggleHabitDay} removeHabit={removeHabit} updateHabit={updateHabit} />
        </TabsContent>

        <TabsList className="flex-none grid grid-cols-5 h-16 bg-white border-t border-stone-100 rounded-none shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
          <TabsTrigger value="chat"
            className="flex flex-col items-center gap-0.5 data-[state=active]:text-amber-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none">
            <MessageCircle className="w-5 h-5" /><span className="text-xs font-medium">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="board"
            className="flex flex-col items-center gap-0.5 data-[state=active]:text-amber-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none relative">
            <LayoutGrid className="w-5 h-5" /><span className="text-xs font-medium">Board</span>
            {overdueCount > 0 && <span className="absolute top-0.5 right-1/4 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{overdueCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="people"
            className="flex flex-col items-center gap-0.5 data-[state=active]:text-rose-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none relative">
            <Users className="w-5 h-5" /><span className="text-xs font-medium">People</span>
            {upcomingCount > 0 && <span className="absolute top-0.5 right-1/4 min-w-[16px] h-[16px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{upcomingCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="journal"
            className="flex flex-col items-center gap-0.5 data-[state=active]:text-indigo-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none">
            <BookOpen className="w-5 h-5" /><span className="text-xs font-medium">Journal</span>
          </TabsTrigger>
          <TabsTrigger value="habits"
            className="flex flex-col items-center gap-0.5 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent text-stone-600 rounded-none border-0 shadow-none">
            <Flame className="w-5 h-5" /><span className="text-xs font-medium">Habits</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
