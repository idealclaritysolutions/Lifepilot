import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import type { AppState, UserProfile } from '@/App'
import type { UserLocation } from '@/hooks/use-location'
import { ArrowLeft, Trash2, User, Heart, Shield, Lock, Bell, MapPin, Calendar, Loader2, X, Plus, Zap, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { LegalPage } from '@/components/LegalPages'
import { AccountSection, useAuth } from '@/components/AuthGate'

const ENERGY_DRAINERS = [
  { id: 'meals', label: 'Meal Planning', emoji: '🍽️' },
  { id: 'health', label: 'Health & Wellness', emoji: '💪' },
  { id: 'finance', label: 'Bills & Money', emoji: '💰' },
  { id: 'home', label: 'Home & Maintenance', emoji: '🏠' },
  { id: 'family', label: 'Family & Kids', emoji: '👨‍👩‍👧‍👦' },
  { id: 'errands', label: 'Errands & Shopping', emoji: '🛒' },
  { id: 'selfcare', label: 'Self-Care & Habits', emoji: '🧡' },
  { id: 'work', label: 'Work Stress', emoji: '💼' },
  { id: 'social', label: 'Social Obligations', emoji: '🗓️' },
  { id: 'sleep', label: 'Sleep Issues', emoji: '😴' },
  { id: 'commute', label: 'Commuting', emoji: '🚗' },
  { id: 'admin', label: 'Paperwork & Admin', emoji: '📄' },
]

interface Props {
  state: AppState
  notifications: any
  locationHook: any
  updateProfile: (updates: Partial<UserProfile>) => void
  setUserLocation: (loc: UserLocation | null) => void
  updateState: (updates: Partial<AppState>) => void
  onClose: () => void
  onReset: () => void
}

export function Settings({ state, notifications, locationHook, updateProfile, setUserLocation, updateState, onClose, onReset }: Props) {
  const [enablingNotif, setEnablingNotif] = useState(false)
  const [enablingLoc, setEnablingLoc] = useState(false)
  const [legalPage, setLegalPage] = useState<'privacy' | 'terms' | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState(state.profile.name)
  const [editHousehold, setEditHousehold] = useState(state.profile.household.join(', '))
  const [selectedDrainers, setSelectedDrainers] = useState<string[]>(state.profile.priorities)
  const [customDrainer, setCustomDrainer] = useState('')
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const auth = useAuth()
  const user = auth

  // Check Google connection status
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/google-status?userId=${user.id}`).then(r => r.json()).then(d => {
        if (d.connected) setGoogleEmail(d.email)
      }).catch(() => {})
    }
    // Check URL params for connection callback
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_connected') === 'true') {
      toast.success('Google Calendar & Gmail connected!')
      window.history.replaceState({}, '', window.location.pathname)
      if (user?.id) {
        fetch(`/api/google-status?userId=${user.id}`).then(r => r.json()).then(d => {
          if (d.connected) setGoogleEmail(d.email)
        }).catch(() => {})
      }
    }
    if (params.get('google_error')) {
      toast.error('Google connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user?.id])

  if (legalPage) {
    return <LegalPage page={legalPage} onClose={() => setLegalPage(null)} />
  }

  const totalItems = state.items.length
  const doneItems = state.items.filter(i => i.status === 'done').length
  const chatCount = state.chatHistory.length
  const journalCount = state.journal.length

  const toggleDrainer = (id: string) => {
    setSelectedDrainers(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const addCustomDrainer = () => {
    const val = customDrainer.trim()
    if (val && !selectedDrainers.includes(val)) {
      setSelectedDrainers(prev => [...prev, val])
      setCustomDrainer('')
    }
  }

  const handleSaveProfile = () => {
    updateProfile({
      name: editName.trim() || state.profile.name,
      household: editHousehold.split(',').map(s => s.trim()).filter(Boolean),
      priorities: selectedDrainers,
    })
    setEditingProfile(false)
    toast.success('Profile updated!')
  }



  const handleNotifications = async () => {
    // Toggle OFF
    if (state.profile.notificationsEnabled) {
      updateProfile({ notificationsEnabled: false })
      toast.success('Notifications turned off.')
      return
    }
    // Toggle ON
    setEnablingNotif(true)
    const granted = await notifications.requestPermission()
    if (granted) {
      updateProfile({ notificationsEnabled: true })
      toast.success('Notifications enabled! I\'ll remind you when things are due.')
      notifications.sendNotification('Life Pilot AI ✦', `Hey ${state.profile.name}! Reminders are now active. I'll nudge you when tasks are due.`)
      
      // Subscribe to Web Push for server-sent notifications
      try {
        const reg = await navigator.serviceWorker?.ready
        if (reg) {
          const vapidPublicKey = 'BPQLndj1vTD1lJaoXHuPUIqkhEJxfqgRayBrKIoswHIWRf5RNJdTeH79tk7AKNWGgVUxDgSmiaQbI5ePpXCjZuc'
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: Uint8Array.from(atob(vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
          })
          await fetch('/api/push-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.id || 'anonymous', subscription: sub.toJSON() }),
          })
          console.log('[Push] Web Push subscribed successfully')
        }
      } catch (err) {
        console.warn('[Push] Web Push subscription failed:', err)
      }
    } else {
      toast.error('Notifications blocked. Check your browser settings.')
    }
    setEnablingNotif(false)
  }

  const handleLocation = async () => {
    // Toggle OFF
    if (state.profile.locationEnabled) {
      updateProfile({ locationEnabled: false })
      setUserLocation(null)
      toast.success('Location turned off.')
      return
    }
    // Toggle ON
    setEnablingLoc(true)
    const loc = await locationHook.requestLocation()
    if (loc) {
      setUserLocation(loc)
      updateProfile({ locationEnabled: true })
      const place = loc.city ? `${loc.city}, ${loc.state}` : 'your area'
      toast.success(`Location set to ${place}. I can now find places near you!`)
    } else {
      toast.error('Couldn\'t get location. Check your browser permissions.')
    }
    setEnablingLoc(false)
  }

  return (
    <div className="min-h-[100dvh] max-w-lg mx-auto">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-stone-600" />
        </button>
        <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Settings</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center">
                <User className="w-6 h-6 text-amber-800" />
              </div>
              <div>
                <p className="font-semibold text-stone-800">{state.profile.name}</p>
                <p className="text-xs text-stone-600">
                  {state.profile.household.length > 0 ? `Household: ${state.profile.household.join(', ')}` : 'Solo'}
                </p>
              </div>
            </div>
            <button onClick={() => setEditingProfile(!editingProfile)}
              className="text-xs text-amber-600 font-medium px-3 py-1.5 rounded-lg hover:bg-amber-50">
              {editingProfile ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editingProfile && (
            <div className="space-y-4 mb-4 pt-3 border-t border-stone-100">
              <div>
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Your name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Household members (comma separated)</label>
                <input value={editHousehold} onChange={e => setEditHousehold(e.target.value)}
                  placeholder="e.g., Sarah, James, Mom"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm mt-1" />
                <p className="text-xs text-stone-600 mt-1">These will also appear in your People tab</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2 block">
                  <Zap className="w-3 h-3 inline mr-1" />What drains your energy?
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {ENERGY_DRAINERS.map(d => {
                    const active = selectedDrainers.includes(d.id)
                    return (
                      <button key={d.id} onClick={() => toggleDrainer(d.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          active
                            ? 'bg-amber-100 text-amber-700 border-amber-300'
                            : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                        }`}>
                        {d.emoji} {d.label} {active && '✓'}
                      </button>
                    )
                  })}
                  {/* Show custom drainers that aren't in the preset list */}
                  {selectedDrainers.filter(d => !ENERGY_DRAINERS.find(e => e.id === d)).map(d => (
                    <button key={d} onClick={() => toggleDrainer(d)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-1">
                      {d} <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customDrainer} onChange={e => setCustomDrainer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomDrainer()}
                    placeholder="Add your own..."
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs" />
                  <button onClick={addCustomDrainer} disabled={!customDrainer.trim()}
                    className="px-3 py-2 rounded-xl bg-stone-100 text-stone-600 text-xs disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <button onClick={handleSaveProfile}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium">
                Save changes
              </button>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2.5 bg-stone-50 rounded-xl"><p className="text-lg font-bold text-stone-800">{totalItems}</p><p className="text-xs text-stone-500">logged</p></div>
            <div className="text-center p-2.5 bg-emerald-50 rounded-xl"><p className="text-lg font-bold text-emerald-700">{doneItems}</p><p className="text-xs text-stone-500">done</p></div>
            <div className="text-center p-2.5 bg-amber-50 rounded-xl"><p className="text-lg font-bold text-amber-700">{chatCount}</p><p className="text-xs text-stone-500">chats</p></div>
            <div className="text-center p-2.5 bg-indigo-50 rounded-xl"><p className="text-lg font-bold text-indigo-700">{journalCount}</p><p className="text-xs text-stone-500">entries</p></div>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <h3 className="font-semibold text-stone-800 text-sm mb-4">Integrations</h3>
          <div className="space-y-4">
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">Push Reminders</p>
                  <p className="text-xs text-stone-600">{state.profile.notificationsEnabled ? 'Active — you\'ll get reminders' : 'Get nudged when tasks are due'}</p>
                </div>
              </div>
              <button onClick={handleNotifications} disabled={enablingNotif}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  state.profile.notificationsEnabled ? 'bg-amber-500' : 'bg-stone-200'
                }`}>
                {enablingNotif ? (
                  <Loader2 className="w-3 h-3 animate-spin absolute top-2 left-4 text-white" />
                ) : (
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                    state.profile.notificationsEnabled ? 'left-[22px]' : 'left-1'
                  }`} />
                )}
              </button>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">Location</p>
                  <p className="text-xs text-stone-600">{
                    state.location?.city
                      ? `${state.location.city}, ${state.location.state}`
                      : 'Find stores & places near you'
                  }</p>
                </div>
              </div>
              <button onClick={handleLocation} disabled={enablingLoc}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  state.profile.locationEnabled ? 'bg-blue-500' : 'bg-stone-200'
                }`}>
                {enablingLoc ? (
                  <Loader2 className="w-3 h-3 animate-spin absolute top-2 left-4 text-white" />
                ) : (
                  <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                    state.profile.locationEnabled ? 'left-[22px]' : 'left-1'
                  }`} />
                )}
              </button>
            </div>

            {/* Google Integration — Coming Soon */}
            <div className="flex items-center justify-between opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">Google Calendar & Gmail</p>
                  <p className="text-xs text-stone-600">Coming soon</p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 text-stone-400">Soon</span>
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-stone-800 text-sm">Privacy & Security</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-stone-600 mt-0.5 flex-none" />
              <div>
                <p className="text-sm text-stone-700 font-medium">Your data is secure</p>
                <p className="text-xs text-stone-600">Data is stored locally on your device and synced to our encrypted cloud when you sign in. We never sell or share your data.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <h3 className="font-semibold text-stone-800 mb-1 text-sm">Customize Your Experience</h3>
          <p className="text-xs text-stone-400 mb-3">Show only the features you use. Chat is always on.</p>
          {([
            { key: 'tasks', label: 'Board (Tasks & Goals)', emoji: '📋' },
            { key: 'journal', label: 'Journal', emoji: '📓' },
            { key: 'sharedLists', label: 'Shared Lists', emoji: '📝' },
            { key: 'people', label: 'People & Birthdays', emoji: '👥' },
            { key: 'focusTimer', label: 'Focus Timer', emoji: '⏱️' },
          ] as const).map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
              <span className="text-sm text-stone-700">{emoji} {label}</span>
              <button onClick={() => {
                const newVal = !(state.featureToggles?.[key] ?? true)
                updateState({ featureToggles: { [key]: newVal } as any })
              }}
                className={`w-10 h-6 rounded-full transition-all relative ${
                  (state.featureToggles?.[key] ?? true) ? 'bg-amber-500' : 'bg-stone-200'
                }`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                  (state.featureToggles?.[key] ?? true) ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>

        {/* Notification Frequency */}
        {/* Notification Frequency — always show so users know it exists */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <h3 className="font-semibold text-stone-800 mb-1 text-sm">Nudge Frequency</h3>
            <p className="text-xs text-stone-400 mb-3">How often should Life Pilot AI check in with you?</p>
            <div className="flex gap-2">
              {([
                { value: '1x' as const, label: '1x/day', desc: 'Gentle' },
                { value: '3x' as const, label: '3x/day', desc: 'Balanced' },
                { value: '5x' as const, label: '5x/day', desc: 'Proactive' },
              ]).map(({ value, label, desc }) => (
                <button key={value} onClick={() => updateState({ notificationFrequency: value })}
                  className={`flex-1 py-3 rounded-xl text-center transition-all ${
                    (state.notificationFrequency || '3x') === value
                      ? 'bg-amber-500 text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-[10px] opacity-80">{desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-stone-500">Quiet hours:</span>
              <select value={state.quietHoursStart || 22} onChange={e => updateState({ quietHoursStart: parseInt(e.target.value) })}
                className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
              </select>
              <span className="text-xs text-stone-400">to</span>
              <select value={state.quietHoursEnd || 7} onChange={e => updateState({ quietHoursEnd: parseInt(e.target.value) })}
                className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2 py-1">
                {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>)}
              </select>
            </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <h3 className="font-semibold text-stone-800 mb-2 text-sm">About Life Pilot AI</h3>
          <p className="text-sm text-stone-500 leading-relaxed">Your AI co-pilot for everything life throws at you. Built by Ideal Clarity Solutions.</p>
          <div className="flex items-center gap-1.5 mt-3 text-xs text-stone-600">
            <span>Made with</span><Heart className="w-3 h-3 text-rose-400 fill-rose-400" /><span>for overwhelmed humans</span>
          </div>
          <p className="text-xs text-stone-600 mt-2 cursor-pointer select-none" onClick={() => {
            const count = parseInt(sessionStorage.getItem('lp-version-taps') || '0') + 1
            sessionStorage.setItem('lp-version-taps', String(count))
            if (count >= 5) {
              sessionStorage.setItem('lp-version-taps', '0')
              const code = prompt('Enter access code:')
              if (code) {
                const codeMap: Record<string, string> = {
                  'GOOGLEXYZREVIEW': 'enterprise', 'PILOTXYZADMIN': 'enterprise',
                  'FOUNDING100': 'premium', 'LIFEPILOT2026': 'premium',
                  'BETA2026': 'premium', 'FRIEND50': 'premium', 'LAUNCH30': 'premium',
                }
                const tier = codeMap[code.toUpperCase().trim()]
                if (tier) {
                  updateState({
                    subscription: { tier: tier as any, activatedAt: new Date().toISOString(), promoCode: code.toUpperCase().trim() },
                    featureToggles: { tasks: true, journal: true, habits: true, sharedLists: true, people: true, focusTimer: true } as any,
                  })
                  toast.success('Access unlocked — enjoy!')
                } else {
                  toast.error('Invalid code')
                }
              }
            }
          }}>Version 2.0 (v50)</p>
        </div>

        {/* Energy Drainers — visible even when not editing */}
        {!editingProfile && state.profile.priorities.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-stone-800 text-sm flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" /> Energy Drainers
              </h3>
              <button onClick={() => setEditingProfile(true)} className="text-xs text-amber-600 font-medium">Edit</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.profile.priorities.map(p => {
                const preset = ENERGY_DRAINERS.find(d => d.id === p)
                return (
                  <span key={p} className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    {preset ? `${preset.emoji} ${preset.label}` : p}
                  </span>
                )
              })}
            </div>
            <p className="text-xs text-stone-600 mt-2">The AI uses these to proactively help you manage what matters most</p>
          </div>
        )}

        {/* Account */}
        <AccountSection onSignOut={async () => {
          try { await auth.signOut() } catch {}
          toast.success('Signed out')
        }} />

        {/* Legal */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <h3 className="font-semibold text-stone-800 mb-3 text-sm">Legal</h3>
          <div className="space-y-2">
            <button onClick={() => setLegalPage('privacy')} className="w-full flex items-center justify-between py-2 text-sm text-stone-600 hover:text-stone-800">
              <span>Privacy Policy</span>
              <span className="text-stone-600">→</span>
            </button>
            <button onClick={() => setLegalPage('terms')} className="w-full flex items-center justify-between py-2 text-sm text-stone-600 hover:text-stone-800">
              <span>Terms of Service</span>
              <span className="text-stone-600">→</span>
            </button>
          </div>
        </div>

        {/* Contact & Feedback */}
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <h3 className="font-semibold text-stone-800 text-sm mb-3">Help & Feedback</h3>
          <div className="space-y-2">
            <a href="mailto:support@getlifepilot.app?subject=LifePilot Support Request"
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-stone-800">Contact Support</p>
                <p className="text-xs text-stone-500">Report a bug or get help</p>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </a>
            <a href="mailto:support@getlifepilot.app?subject=LifePilot Feature Request"
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-stone-800">Share Feedback</p>
                <p className="text-xs text-stone-500">Suggest features or improvements</p>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </a>
            <button onClick={() => {
              const msg = prompt('What feedback would you like to share? We read every message.')
              if (msg?.trim()) {
                // Open email with feedback pre-filled
                window.open(`mailto:support@getlifepilot.app?subject=LifePilot Quick Feedback&body=${encodeURIComponent(msg.trim())}`, '_self')
              }
            }}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors">
              <div>
                <p className="text-sm font-medium text-amber-800">Quick Feedback</p>
                <p className="text-xs text-amber-600">Tell us what you think — right here</p>
              </div>
              <span className="text-lg">💬</span>
            </button>
          </div>
        </div>

        {/* Reset */}
        <div className="bg-white rounded-2xl border border-red-100 p-5">
          <h3 className="font-semibold text-red-800 mb-2 text-sm">Reset Everything</h3>
          <p className="text-sm text-stone-500 mb-4">Clear all data. This can't be undone.</p>
          <Button onClick={onReset} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-2" /> Reset all data
          </Button>
        </div>
      </div>
    </div>
  )
}
