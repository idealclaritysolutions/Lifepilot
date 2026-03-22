import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'
import { OnboardingFlow } from '@/components/OnboardingFlow'
import { MainApp } from '@/components/MainApp'
import { AccountView } from '@/components/AccountView'
import { IOSInstallPrompt } from '@/components/IOSInstallPrompt'
import { useNotifications } from '@/hooks/use-notifications'
import { useLocation, type UserLocation } from '@/hooks/use-location'
import { useDailyNudges } from '@/hooks/use-daily-nudges'
import { usePushSubscribe } from '@/hooks/use-push-subscribe'
import { useMorningBrief } from '@/hooks/use-morning-brief'
import { useTaskDecay } from '@/hooks/use-task-decay'
import { saveUserData, loadUserData } from '@/lib/supabase'

export interface LifeItem {
  id: string
  text: string
  category: 'meal' | 'health' | 'finance' | 'home' | 'family' | 'errand' | 'general' | 'grocery'
  status: 'pending' | 'done' | 'snoozed'
  createdAt: string
  dueDate?: string
  dueTime?: string
  snoozedUntil?: string
  snoozeCount: number
  lastNudged?: string
  completedAt?: string
  eisenhower?: 'do' | 'schedule' | 'delegate' | 'eliminate'
  goalId?: string  // links this task to a goal
  linkedHabitId?: string  // links this task to a daily habit
}

export interface UserProfile {
  name: string
  household: string[]
  priorities: string[]
  onboarded: boolean
  notificationsEnabled?: boolean
  locationEnabled?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface JournalEntry {
  id: string
  title?: string  // User-entered or AI-generated title
  content: string
  mood?: 'great' | 'good' | 'okay' | 'tough' | 'rough'
  createdAt: string
  aiReflection?: string
  themes?: string[]
  summary?: string[]  // AI-generated bullet point summary
}

// ─── SUBSCRIPTION SYSTEM ──────────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro' | 'premium' | 'enterprise'

export interface Subscription {
  tier: SubscriptionTier
  activatedAt: string
  expiresAt?: string  // undefined = never expires (lifetime/promo)
  promoCode?: string
  trialEndsAt?: string  // ISO date when 7-day trial ends
  isTrial?: boolean
}

export const TIER_LIMITS: Record<SubscriptionTier, {
  messagesPerDay: number; journalPerMonth: number; maxPeople: number;
  searchesPerDay: number; maxLists: number; maxHabits: number;
}> = {
  free: { messagesPerDay: 10, journalPerMonth: 5, maxPeople: 3, searchesPerDay: 0, maxLists: 0, maxHabits: 0 },
  pro: { messagesPerDay: 40, journalPerMonth: 20, maxPeople: 15, searchesPerDay: 5, maxLists: 0, maxHabits: 0 },
  premium: { messagesPerDay: 100, journalPerMonth: 999, maxPeople: 50, searchesPerDay: 20, maxLists: 10, maxHabits: 15 },
  enterprise: { messagesPerDay: 300, journalPerMonth: 999, maxPeople: 999, searchesPerDay: 75, maxLists: 999, maxHabits: 50 },
}

// Feature access by tier
export function hasFeature(tier: SubscriptionTier, feature: string): boolean {
  const FREE_FEATURES = ['board', 'push_notifications', 'basic_chat', 'basic_journal']
  const PRO_FEATURES = [...FREE_FEATURES, 'voice_journal', 'theme_detection', 'weekly_recaps', 'document_scanning', 'location_search', 'calendar', 'daily_nudges', 'web_search', 'unlimited_people']
  const PREMIUM_FEATURES = [...PRO_FEATURES, 'shared_lists', 'habit_tracking', 'monthly_report', 'journal_export', 'custom_themes', 'purchase_intelligence']
  const ENTERPRISE_FEATURES = [...PREMIUM_FEATURES, 'ai_weekly_strategy', 'ai_daily_coaching', 'ai_goal_tracker', 'priority_support']

  const tierFeatures: Record<SubscriptionTier, string[]> = {
    free: FREE_FEATURES,
    pro: PRO_FEATURES,
    premium: PREMIUM_FEATURES,
    enterprise: ENTERPRISE_FEATURES,
  }
  return tierFeatures[tier]?.includes(feature) || false
}

// Plan name mapping for user-facing text
export const PLAN_NAMES: Record<SubscriptionTier, string> = {
  free: 'Clarity Starter',
  pro: 'Life Pilot',
  premium: 'Inner Circle',
  enterprise: 'Guided',
}

// Promo codes: FOUNDING100 = premium forever, BETA2026 = premium 90 days, etc.
export const PROMO_CODES: Record<string, { tier: SubscriptionTier; durationDays: number | null; label: string }> = {
  'FOUNDING100': { tier: 'premium', durationDays: null, label: 'Founding Member — Inner Circle forever' },
  'LIFEPILOT2026': { tier: 'premium', durationDays: null, label: 'Founding Member — Inner Circle forever' },
  'BETA2026': { tier: 'premium', durationDays: 90, label: 'Beta Tester — Inner Circle for 90 days' },
  'FRIEND50': { tier: 'premium', durationDays: 60, label: 'Friend of Life Pilot AI — Inner Circle for 60 days' },
  'LAUNCH30': { tier: 'premium', durationDays: 30, label: 'Launch Special — Inner Circle for 30 days' },
  'GOOGLEREVIEW': { tier: 'enterprise', durationDays: null, label: 'Google Play Reviewer — Full access' },
  'REVIEWER2026': { tier: 'enterprise', durationDays: null, label: 'App Reviewer — Full access' },
}

// ─── HABITS SYSTEM ────────────────────────────────────────────────

export interface Habit {
  id: string
  name: string
  emoji: string
  frequency: 'daily' | 'weekdays' | 'weekly' | 'custom'
  customDays?: number[]  // 0=Sun, 1=Mon, ... 6=Sat for custom frequency
  completions: string[]  // ISO date strings of completion days
  createdAt: string
  notes?: string
  streakBest: number
  category?: 'morning' | 'health' | 'learning' | 'evening' | 'fitness' | 'mindfulness' | 'other'
  reminderTime?: string  // HH:MM format
  targetValue?: number   // For measurable habits (e.g., 8 glasses, 30 minutes)
  targetUnit?: string    // e.g., "glasses", "minutes", "pages"
  completionValues?: Record<string, number>  // date -> actual value
}

// ─── GOALS SYSTEM ─────────────────────────────────────────────────

export interface GoalMilestone {
  id: string
  text: string
  targetDate?: string
  completed: boolean
  completedAt?: string
}

export interface Goal {
  id: string
  title: string
  description?: string
  targetDate?: string
  createdAt: string
  milestones: GoalMilestone[]
  linkedHabitIds: string[]  // habit IDs that support this goal
  linkedTaskIds: string[]   // task (LifeItem) IDs linked to this goal
  status: 'active' | 'completed' | 'paused'
  completedAt?: string
  category: LifeItem['category']  // uses same categories as board items
}

// ─── PURCHASE TRACKING ───────────────────────────────────────────

export interface Purchase {
  id: string
  item: string
  store?: string
  price?: number
  category?: string
  date: string
  reorderDays?: number  // estimated days until they need to buy again
}

// ─── PEOPLE & LIFE EVENTS SYSTEM ───────────────────────────────────

export interface LifeEvent {
  id: string
  label: string  // "Birthday", "Wedding Anniversary", "School Reunion", etc.
  type: 'birthday' | 'anniversary' | 'wedding' | 'graduation' | 'reunion' | 'memorial' | 'custom'
  date: string   // MM-DD format for recurring, or YYYY-MM-DD for one-time
  year?: number  // Original year (to calculate "turning 30" or "5th anniversary")
  recurring: boolean
  notes?: string
}

export interface Person {
  id: string
  name: string
  relationship: string  // "Mom", "Best friend", "Coworker", "Partner", etc.
  closeness: 'inner-circle' | 'close' | 'casual'
  events: LifeEvent[]
  notes: string  // "Loves sushi, just had a baby, allergic to cats"
  giftHistory: { date: string; description: string }[]
  createdAt: string
}

export interface FeatureToggles {
  tasks: boolean
  journal: boolean
  habits: boolean
  sharedLists: boolean
  people: boolean
  focusTimer: boolean
}

export const DEFAULT_TOGGLES: FeatureToggles = {
  tasks: true,
  journal: true,
  habits: true,
  sharedLists: true,
  people: true,
  focusTimer: true,
}

export interface AppState {
  profile: UserProfile
  items: LifeItem[]
  chatHistory: ChatMessage[]
  journal: JournalEntry[]
  people: Person[]
  habits: Habit[]
  goals: Goal[]
  purchases: Purchase[]
  subscription: Subscription
  usageToday: { messages: number; date: string }
  location?: UserLocation | null
  featureToggles: FeatureToggles
  notificationFrequency: '1x' | '3x' | '5x'
  quietHoursStart: number // 0-23
  quietHoursEnd: number // 0-23
  focusSessions: { date: string; minutes: number; count: number }[]
}

const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: 'free',
  activatedAt: new Date().toISOString(),
}

const DEFAULT_STATE: AppState = {
  profile: { name: '', household: [], priorities: [], onboarded: false },
  items: [],
  chatHistory: [],
  journal: [],
  people: [],
  habits: [],
  goals: [],
  purchases: [],
  subscription: DEFAULT_SUBSCRIPTION,
  usageToday: { messages: 0, date: new Date().toDateString() },
  location: null,
  featureToggles: DEFAULT_TOGGLES,
  notificationFrequency: '3x',
  quietHoursStart: 22,
  quietHoursEnd: 7,
  focusSessions: [],
}

const STORAGE_KEY = 'lifepilot-state'

// Deduplicate habits by ID — habits created via AI in the same batch may share IDs
function dedupeHabits(habits: any[]): any[] {
  const seen = new Set<string>()
  return (habits || []).map((h: any) => {
    if (seen.has(h.id)) {
      return { ...h, id: `habit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}` }
    }
    seen.add(h.id)
    return h
  })
}

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...DEFAULT_STATE,
        ...parsed,
        // Ensure nested objects have proper defaults for existing users
        featureToggles: { ...DEFAULT_TOGGLES, ...(parsed.featureToggles || {}) },
        subscription: { ...DEFAULT_STATE.subscription, ...(parsed.subscription || {}) },
        focusSessions: parsed.focusSessions || [],
        notificationFrequency: parsed.notificationFrequency || '3x',
        quietHoursStart: parsed.quietHoursStart ?? 22,
        quietHoursEnd: parsed.quietHoursEnd ?? 7,
        habits: dedupeHabits(parsed.habits),
      }
    }
  } catch (e) {
    console.warn('Failed to load state:', e)
  }
  return DEFAULT_STATE
}

function App() {
  const [state, setState] = useState<AppState>(loadState)
  const notifications = useNotifications()
  const locationHook = useLocation()
  const { isLoaded: authLoaded, isSignedIn, user: authUser, userName, isRecovery } = useAuth()

  // Check if trial has expired — downgrade to free
  useEffect(() => {
    const sub = state.subscription
    if (sub.isTrial && sub.trialEndsAt) {
      const now = new Date()
      const trialEnd = new Date(sub.trialEndsAt)
      if (now > trialEnd) {
        console.log('[LifePilot] Trial expired, downgrading to free')
        setState(prev => ({
          ...prev,
          subscription: { tier: 'free', activatedAt: prev.subscription.activatedAt },
        }))
      }
    }
    
    // Auto-activate reviewer access via URL param (for Google Play reviewers)
    const params = new URLSearchParams(window.location.search)
    const accessCode = params.get('access')
    if (accessCode) {
      const promo = PROMO_CODES[accessCode.toUpperCase().trim()]
      if (promo) {
        setState(prev => ({
          ...prev,
          subscription: {
            tier: promo.tier,
            activatedAt: new Date().toISOString(),
            promoCode: accessCode.toUpperCase().trim(),
          },
          // Auto-onboard the reviewer so they skip the onboarding flow
          profile: {
            ...prev.profile,
            name: prev.profile.name || 'Reviewer',
            onboarded: true,
            notificationsEnabled: false,
          },
          // Enable all features
          featureToggles: {
            tasks: true, journal: true, habits: true,
            sharedLists: true, people: true, focusTimer: true,
          },
          // Add sample data so the reviewer can see features in action
          items: prev.items.length > 0 ? prev.items : [
            { id: 'demo-1', text: 'Review Q1 marketing strategy', category: 'general' as const, status: 'pending' as const, createdAt: new Date().toISOString(), snoozeCount: 0, eisenhower: 'do' as const },
            { id: 'demo-2', text: 'Schedule dentist appointment', category: 'health' as const, status: 'pending' as const, createdAt: new Date().toISOString(), snoozeCount: 0, dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], eisenhower: 'schedule' as const },
            { id: 'demo-3', text: 'Buy groceries for the week', category: 'grocery' as const, status: 'pending' as const, createdAt: new Date().toISOString(), snoozeCount: 0 },
          ],
          habits: prev.habits.length > 0 ? prev.habits : [
            { id: 'demo-h1', name: 'Meditate', emoji: '🧘', category: 'mindfulness', frequency: 'daily' as const, completions: [], target: 1, streakBest: 0, notes: '', createdAt: new Date().toISOString() },
            { id: 'demo-h2', name: 'Exercise', emoji: '💪', category: 'fitness', frequency: 'daily' as const, completions: [], target: 1, streakBest: 0, notes: '', createdAt: new Date().toISOString() },
          ],
          chatHistory: prev.chatHistory.length > 0 ? prev.chatHistory : [
            { role: 'assistant' as const, content: `Welcome to Life Pilot AI! 🌟 You have full access to every feature. Try asking me anything — "add a task", "start a journal entry", "check my habits", or "what should I focus on today?"`, timestamp: new Date().toISOString() },
          ],
        }))
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  // Cloud sync: load cloud data on sign-in, clear local data on account switch
  const hasLoadedCloudRef = useRef(false)
  useEffect(() => {
    if (!authLoaded) return
    if (!isSignedIn || !authUser) { hasLoadedCloudRef.current = false; return }
    if (hasLoadedCloudRef.current) return
    hasLoadedCloudRef.current = true

    const currentUserId = authUser.id
    const previousUserId = localStorage.getItem('lp-last-user-id')
    const isDifferentUser = previousUserId && previousUserId !== currentUserId

    const syncCloud = async () => {
      console.log('[LifePilot] Syncing cloud data for:', currentUserId)
      
      // CRITICAL: If a different user signed in, clear local state first
      if (isDifferentUser) {
        console.log('[LifePilot] Different user detected — clearing local state to prevent data bleed')
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem('lp-trial-banner-dismissed')
        localStorage.removeItem('lp-morning-brief-' + new Date().toDateString())
        localStorage.removeItem('lp-task-decay-' + new Date().toDateString())
        setState(DEFAULT_STATE)
      }
      localStorage.setItem('lp-last-user-id', currentUserId)

      const cloudData = await loadUserData(currentUserId)
      
      if (cloudData && cloudData.profile?.onboarded) {
        if (!isDifferentUser) {
          // Same user — check if local has newer changes to merge
          const localData = loadState()
          const cloudTime = new Date(cloudData.lastSyncedAt || 0).getTime()
          const localTime = new Date(localData.lastSyncedAt || 0).getTime()
          
          if (localTime > cloudTime && localData.profile?.onboarded) {
            console.log('[LifePilot] Local data is newer, merging with cloud')
            const mergedItems = [...(cloudData.items || [])];
            (localData.items || []).forEach((li: any) => { if (!mergedItems.some((ci: any) => ci.id === li.id)) mergedItems.push(li) })
            const mergedJournal = [...(cloudData.journal || [])];
            (localData.journal || []).forEach((lj: any) => { if (!mergedJournal.some((cj: any) => cj.id === lj.id)) mergedJournal.push(lj) })
            const mergedPeople = [...(cloudData.people || [])];
            (localData.people || []).forEach((lp: any) => { if (!mergedPeople.some((cp: any) => cp.id === lp.id)) mergedPeople.push(lp) })
            const mergedHabits = [...(cloudData.habits || [])];
            (localData.habits || []).forEach((lh: any) => { if (!mergedHabits.some((ch: any) => ch.id === lh.id)) mergedHabits.push(lh) })
            
            const merged = {
              ...cloudData,
              items: mergedItems,
              journal: mergedJournal.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
              people: mergedPeople,
              habits: dedupeHabits(mergedHabits),
              chatHistory: [...(cloudData.chatHistory || []), ...(localData.chatHistory || [])].slice(-100),
            }
            setState(prev => ({ ...DEFAULT_STATE, ...merged }))
            await saveUserData(currentUserId, { ...merged, lastSyncedAt: new Date().toISOString() })
          } else {
            console.log('[LifePilot] Cloud data is current, loading to device')
            setState(prev => ({ ...DEFAULT_STATE, ...cloudData, habits: dedupeHabits(cloudData.habits) }))
          }
        } else {
          // Different user — load ONLY their cloud data, no merge
          console.log('[LifePilot] Loading cloud data for new user (clean load)')
          setState(prev => ({ ...DEFAULT_STATE, ...cloudData, habits: dedupeHabits(cloudData.habits) }))
        }
      } else {
        // No cloud data for this user
        if (isDifferentUser) {
          // Brand new user on this device — fresh start
          console.log('[LifePilot] New user, fresh start')
          const name = userName || 'Friend'
          setState({ ...DEFAULT_STATE, profile: { ...DEFAULT_STATE.profile, name, onboarded: true } })
        } else {
          const localData = loadState()
          if (localData.profile?.onboarded) {
            console.log('[LifePilot] No cloud data, uploading local data')
            await saveUserData(currentUserId, { ...localData, chatHistory: (localData.chatHistory || []).slice(-100) })
          } else {
            const name = userName || 'Friend'
            setState(prev => ({ ...prev, profile: { ...prev.profile, name, onboarded: true } }))
          }
        }
      }
    }
    syncCloud()
  }, [authLoaded, isSignedIn, authUser?.id])
  useDailyNudges(state)
  usePushSubscribe(!!state.profile.notificationsEnabled)

  // Re-sync from cloud when app becomes visible (handles multi-device)
  useEffect(() => {
    if (!isSignedIn || !authUser?.id) return
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const cloudData = await loadUserData(authUser.id)
        if (cloudData && cloudData.profile?.onboarded) {
          // Compare timestamps — only update if cloud is newer
          // Read from localStorage (not state) because state.lastSyncedAt is never updated after init
          const cloudTime = new Date(cloudData.lastSyncedAt || 0).getTime()
          const localStored = localStorage.getItem(STORAGE_KEY)
          const localTime = localStored ? new Date(JSON.parse(localStored).lastSyncedAt || 0).getTime() : 0
          if (cloudTime > localTime) {
            console.log('[LifePilot] Cloud data is newer, syncing to device')
            setState(prev => ({ ...DEFAULT_STATE, ...cloudData, habits: dedupeHabits(cloudData.habits) }))
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isSignedIn, authUser?.id])

  const syncTimerRef = useRef<any>(null)

  // Save to localStorage on every state change + cloud sync for signed-in users
  useEffect(() => {
    try {
      const toSave = {
        ...state,
        chatHistory: state.chatHistory.slice(-100),
        lastSyncedAt: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))

      // Cloud sync: debounce to avoid hammering Supabase on rapid changes
      if (isSignedIn && authUser?.id && state.profile.onboarded) {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(async () => {
          console.log('[LifePilot] Syncing to cloud for user:', authUser.id)
          const ok = await saveUserData(authUser.id, toSave)
          console.log('[LifePilot] Cloud sync result:', ok)
        }, 2000) // Save after 2 seconds of inactivity
      }
    } catch (e) {
      console.warn('Failed to save state:', e)
    }
  }, [state, isSignedIn, authUser?.id])

  // Listen for COMPLETE_ITEM events from the service worker (notification actions)
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id
      if (id) updateItem(id, { status: 'done', completedAt: new Date().toISOString() })
    }
    window.addEventListener('lifepilot-complete', handler)
    return () => window.removeEventListener('lifepilot-complete', handler)
  }, [])

  // Schedule reminders for items with due dates
  useEffect(() => {
    state.items.forEach(item => {
      if (item.status === 'pending' && item.dueDate && state.profile.notificationsEnabled) {
        notifications.scheduleReminder(item)
      }
    })
  }, [state.items, state.profile.notificationsEnabled])

  const handleOnboardingComplete = useCallback((profile: UserProfile) => {
    const isDemoMode = (profile as any)._demoMode === true
    
    setState(prev => {
      // Demo mode: skip trial logic, give enterprise access immediately
      if (isDemoMode) {
        return {
          ...prev,
          profile: { ...profile, onboarded: true },
          subscription: { tier: 'enterprise' as const, activatedAt: new Date().toISOString() },
          chatHistory: [{ role: 'assistant' as const, content: `Welcome to the demo! 🎉 You have full access to every feature. Explore the tabs below — Chat, Board, Journal, Habits, Focus Timer. Ask me anything!\n\nTry saying:\n• "Add a task to call the dentist Friday"\n• "I want to start meditating daily"\n• "What's on my calendar?"\n• "Help me prioritize my tasks"`, timestamp: new Date().toISOString() }],
        }
      }

      // Auto-add household members to People tab
      const newPeople = profile.household
        .filter(name => !prev.people.some(p => p.name.toLowerCase() === name.toLowerCase()))
        .map(name => ({
          id: 'person-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          name,
          relationship: 'Household',
          closeness: 'inner-circle' as const,
          notes: 'Added from your household during setup',
          events: [],
          giftHistory: [],
        }))
      // Build personalized welcome message based on their energy drainers
      const drainers = profile.priorities || []
      let welcomeMsg = `Hey ${profile.name}! 🌟 Welcome to Life Pilot AI — I'm so glad you're here.\n\n`
      
      if (drainers.length > 0) {
        welcomeMsg += `I noticed that ${drainers.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${drainers.length === 1 ? 'drains' : 'drain'} your energy the most. I get it — `
        if (drainers.some(d => /meal|food|cook|dinner/i.test(d))) welcomeMsg += `meal planning alone can eat up hours every week. `
        if (drainers.some(d => /forgot|remember|task|organiz/i.test(d))) welcomeMsg += `keeping track of everything when life moves fast is exhausting. `
        if (drainers.some(d => /health|fitness|exercise|doctor/i.test(d))) welcomeMsg += `staying on top of health goals while juggling everything else is a real challenge. `
        if (drainers.some(d => /money|financ|budget|bill/i.test(d))) welcomeMsg += `financial decisions deserve clarity, not stress. `
        welcomeMsg += `\n\nThat's exactly why I'm here. Think of me as your personal life operating system — I'll handle the mental load so you can focus on what actually matters to you.\n\n`
      } else {
        welcomeMsg += `Think of me as your personal life operating system — I handle the mental load so you can focus on what actually matters.\n\n`
      }
      
      welcomeMsg += `🎁 **You've got 7 days of full premium access** — shared lists, habit tracking, 100 AI messages/day, voice journal, the works. No credit card needed. Explore everything!\n\nWould you like to see the full suite of features I offer? I can walk you through everything I can do for you! 💫`

      // 7-day premium trial for new users — only if this device hasn't had a trial before
      const trialUsedKey = 'lp-trial-used'
      const trialAlreadyUsed = localStorage.getItem(trialUsedKey)
      let trialSubscription: Subscription
      
      if (trialAlreadyUsed) {
        // This device already had a trial — start on free tier
        trialSubscription = { tier: 'free', activatedAt: new Date().toISOString() }
      } else {
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + 7)
        trialSubscription = {
          tier: 'premium',
          activatedAt: new Date().toISOString(),
          trialEndsAt: trialEnd.toISOString(),
          isTrial: true,
        }
        localStorage.setItem(trialUsedKey, new Date().toISOString())
      }

      return {
        ...prev,
        profile: { ...profile, onboarded: true },
        people: [...prev.people, ...newPeople],
        subscription: trialSubscription,
        chatHistory: [{ role: 'assistant' as const, content: welcomeMsg, timestamp: new Date().toISOString() }],
      }
    })
  }, [])

  const addItem = useCallback((item: LifeItem) => {
    setState(prev => ({ ...prev, items: [item, ...prev.items] }))
  }, [])

  const updateItem = useCallback((id: string, updates: Partial<LifeItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(i => i.id === id ? { ...i, ...updates } : i),
    }))
  }, [])

  const removeItem = useCallback((id: string) => {
    notifications.cancelReminder(id)
    setState(prev => ({ ...prev, items: prev.items.filter(i => i.id !== id) }))
  }, [])

  const addChat = useCallback((msg: { role: 'user' | 'assistant'; content: string }) => {
    setState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, { ...msg, timestamp: new Date().toISOString() }],
    }))
  }, [])

  // Hooks that depend on addChat/updateItem
  useMorningBrief(state, addChat)
  useTaskDecay(state, addChat, updateItem)

  const addJournalEntry = useCallback((entry: JournalEntry) => {
    setState(prev => ({ ...prev, journal: [entry, ...prev.journal] }))
  }, [])

  const deleteJournalEntry = useCallback((id: string) => {
    setState(prev => ({ ...prev, journal: prev.journal.filter(e => e.id !== id) }))
  }, [])

  const updateJournalEntry = useCallback((id: string, updates: Partial<JournalEntry>) => {
    setState(prev => ({
      ...prev,
      journal: prev.journal.map(e => e.id === id ? { ...e, ...updates } : e),
    }))
  }, [])

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setState(prev => ({ ...prev, profile: { ...prev.profile, ...updates } }))
  }, [])

  const setUserLocation = useCallback((loc: UserLocation | null) => {
    setState(prev => ({ ...prev, location: loc }))
  }, [])

  // ─── People management ───────────────────────────────────────────
  const addPerson = useCallback((person: Person) => {
    setState(prev => ({ ...prev, people: [person, ...prev.people] }))
  }, [])

  const updatePerson = useCallback((id: string, updates: Partial<Person>) => {
    setState(prev => ({
      ...prev,
      people: prev.people.map(p => p.id === id ? { ...p, ...updates } : p),
    }))
  }, [])

  const removePerson = useCallback((id: string) => {
    setState(prev => ({ ...prev, people: prev.people.filter(p => p.id !== id) }))
  }, [])

  // ─── Habits management ────────────────────────────────────────────
  const addHabit = useCallback((habit: Habit) => {
    setState(prev => ({ ...prev, habits: [habit, ...prev.habits] }))
  }, [])

  const toggleHabitDay = useCallback((habitId: string, dateStr: string) => {
    setState(prev => ({
      ...prev,
      habits: prev.habits.map(h => {
        if (h.id !== habitId) return h
        const has = h.completions.includes(dateStr)
        const completions = has ? h.completions.filter(d => d !== dateStr) : [...h.completions, dateStr]
        // Calculate best streak
        const sorted = [...completions].sort()
        let streak = 0, best = 0, current = 0
        for (let i = 0; i < sorted.length; i++) {
          if (i === 0) { current = 1 } else {
            const prev = new Date(sorted[i - 1])
            const curr = new Date(sorted[i])
            const diff = (curr.getTime() - prev.getTime()) / 86400000
            current = diff <= 1 ? current + 1 : 1
          }
          best = Math.max(best, current)
        }
        return { ...h, completions, streakBest: best }
      }),
    }))
  }, [])

  const removeHabit = useCallback((id: string) => {
    setState(prev => ({ ...prev, habits: prev.habits.filter(h => h.id !== id) }))
  }, [])

  const updateHabit = useCallback((id: string, updates: Partial<Habit>) => {
    setState(prev => ({ ...prev, habits: prev.habits.map(h => h.id === id ? { ...h, ...updates } : h) }))
  }, [])

  // ─── Goals ──────────────────────────────────────────────────────
  const addGoal = useCallback((goal: Goal) => {
    setState(prev => ({ ...prev, goals: [goal, ...prev.goals] }))
  }, [])
  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    setState(prev => ({ ...prev, goals: prev.goals.map(g => g.id === id ? { ...g, ...updates } : g) }))
  }, [])
  const removeGoal = useCallback((id: string) => {
    setState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }))
  }, [])

  // ─── Purchases ────────────────────────────────────────────────────
  const addPurchase = useCallback((purchase: Purchase) => {
    setState(prev => ({ ...prev, purchases: [purchase, ...prev.purchases] }))
  }, [])

  // ─── Subscription ─────────────────────────────────────────────────
  const applyPromoCode = useCallback((code: string): boolean => {
    const promo = PROMO_CODES[code.toUpperCase().trim()]
    if (!promo) return false
    const now = new Date()
    setState(prev => ({
      ...prev,
      subscription: {
        tier: promo.tier,
        activatedAt: now.toISOString(),
        expiresAt: promo.durationDays ? new Date(now.getTime() + promo.durationDays * 86400000).toISOString() : undefined,
        promoCode: code.toUpperCase().trim(),
      },
    }))
    return true
  }, [])

  const setSubscription = useCallback((sub: Subscription) => {
    setState(prev => ({ ...prev, subscription: sub }))
  }, [])

  // Track daily message usage
  const incrementMessageCount = useCallback(() => {
    setState(prev => {
      const today = new Date().toDateString()
      const usage = prev.usageToday.date === today ? prev.usageToday : { messages: 0, date: today }
      return { ...prev, usageToday: { messages: usage.messages + 1, date: today } }
    })
  }, [])

  // ─── Proactive event reminders ───────────────────────────────────
  useEffect(() => {
    if (!state.profile.notificationsEnabled) return
    const now = new Date()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const today = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Check each person's events for upcoming dates
    state.people.forEach(person => {
      person.events.forEach(event => {
        const eventMMDD = event.date.length === 5 ? event.date : event.date.substring(5) // extract MM-DD
        const [em, ed] = eventMMDD.split('-').map(Number)
        
        // Calculate days until event using midnight-to-midnight comparison
        const thisYear = now.getFullYear()
        let eventThisYear = new Date(thisYear, em - 1, ed)
        if (eventThisYear < todayMidnight) eventThisYear = new Date(thisYear + 1, em - 1, ed)
        const daysUntil = Math.round((eventThisYear.getTime() - todayMidnight.getTime()) / 86400000)

        // Inner circle: 14-day, 7-day, 1-day, and day-of
        // Close: 7-day, 3-day, 1-day, day-of
        // Casual: 1-day, day-of
        const remindDays = person.closeness === 'inner-circle' ? [14, 7, 1, 0]
          : person.closeness === 'close' ? [7, 3, 1, 0]
          : [1, 0]

        if (remindDays.includes(daysUntil)) {
          // DEDUP: Only fire this notification once per person per event per reminder day
          const dedupKey = `lp-bday-notif-${person.id}-${event.id}-${daysUntil}d-${todayMidnight.toDateString()}`
          if (localStorage.getItem(dedupKey)) return // Already sent today for this reminder
          localStorage.setItem(dedupKey, '1')

          const yearInfo = event.year ? ` (${event.type === 'birthday' ? `turning ${thisYear - event.year}` : `${thisYear - event.year} years`})` : ''
          const urgency = daysUntil === 0 ? '🎉 TODAY' : daysUntil === 1 ? '⏰ TOMORROW' : `📅 In ${daysUntil} days`

          notifications.sendNotification(
            `${urgency}: ${person.name}'s ${event.label}`,
            `${person.name}'s ${event.label}${yearInfo} is ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}!${person.notes ? ` (${person.notes.substring(0, 50)})` : ''}`,
            { personId: person.id, eventId: event.id }
          )
        }
      })
    })
  }, [state.people, state.profile.notificationsEnabled])

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY)
    setState(DEFAULT_STATE)
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAF9F6]">
      <Toaster position="top-center" richColors />
      <OfflineIndicator />
      <TrialBanner subscription={state.subscription} />
      <IOSInstallPrompt />
      {/* While Clerk is loading, show a brief splash instead of flashing onboarding */}
      {/* Password recovery flow */}
      {isRecovery ? (
        <AccountView onClose={() => {}} />
      ) : !authLoaded && !state.profile.onboarded ? (
        <div className="min-h-[100dvh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-2xl">✦</span>
            </div>
            <p className="text-sm text-stone-400">Loading...</p>
          </div>
        </div>
      ) : !state.profile.onboarded ? (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      ) : (
        <MainApp
          state={state}
          setState={setState}
          addItem={addItem}
          updateItem={updateItem}
          removeItem={removeItem}
          addChat={addChat}
          addJournalEntry={addJournalEntry}
          deleteJournalEntry={deleteJournalEntry}
          updateJournalEntry={updateJournalEntry}
          updateProfile={updateProfile}
          setUserLocation={setUserLocation}
          addPerson={addPerson}
          updatePerson={updatePerson}
          removePerson={removePerson}
          addHabit={addHabit}
          toggleHabitDay={toggleHabitDay}
          removeHabit={removeHabit}
          updateHabit={updateHabit}
          addGoal={addGoal}
          updateGoal={updateGoal}
          removeGoal={removeGoal}
          addPurchase={addPurchase}
          applyPromoCode={applyPromoCode}
          setSubscription={setSubscription}
          incrementMessageCount={incrementMessageCount}
          notifications={notifications}
          locationHook={locationHook}
          onReset={handleReset}
        />
      )}
    </div>
  )
}

function TrialBanner({ subscription }: { subscription: Subscription }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('lp-trial-banner-dismissed') === '1')
  
  if (!subscription.isTrial || !subscription.trialEndsAt || dismissed) return null
  const now = new Date()
  const end = new Date(subscription.trialEndsAt)
  if (now > end) return null
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🎁</span>
        </div>
        <h3 className="text-lg font-bold text-stone-800 mb-2" style={{ fontFamily: "'Georgia', serif" }}>Welcome gift — {daysLeft} days of premium</h3>
        <p className="text-sm text-stone-600 leading-relaxed mb-4">
          Every feature is unlocked for you — shared lists, habits, 100 AI messages/day, voice journal, focus timer, the works. No credit card needed. Just explore and enjoy.
        </p>
        <button onClick={() => { setDismissed(true); localStorage.setItem('lp-trial-banner-dismissed', '1') }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-md hover:from-amber-600 hover:to-orange-600 transition-all">
          Let's go! ✨
        </button>
      </div>
    </div>
  )
}

function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-stone-800 text-white text-center text-xs py-1.5 font-medium">
      You're offline — changes will sync when you reconnect
    </div>
  )
}

export default App
