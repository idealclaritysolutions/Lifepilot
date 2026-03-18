import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { UserProfile } from '@/App'
import {
  Sparkles, Heart, Home, DollarSign, Users, ShoppingBag,
  Utensils, Dumbbell, ArrowRight, Check
} from 'lucide-react'

const PRIORITIES = [
  { id: 'meals', label: 'Meal Planning', icon: Utensils, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'health', label: 'Health & Wellness', icon: Dumbbell, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'finance', label: 'Bills & Money', icon: DollarSign, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'home', label: 'Home & Maintenance', icon: Home, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'family', label: 'Family & Kids', icon: Users, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { id: 'errands', label: 'Errands & Shopping', icon: ShoppingBag, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'selfcare', label: 'Self-Care & Habits', icon: Heart, color: 'bg-rose-100 text-rose-700 border-rose-200' },
]

interface Props {
  onComplete: (profile: UserProfile) => void
}

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [household, setHousehold] = useState<string[]>([])
  const [householdInput, setHouseholdInput] = useState('')
  const [priorities, setPriorities] = useState<string[]>([])

  const togglePriority = (id: string) => {
    setPriorities(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const addHouseholdMember = () => {
    if (householdInput.trim()) {
      setHousehold(prev => [...prev, householdInput.trim()])
      setHouseholdInput('')
    }
  }

  const handleComplete = () => {
    onComplete({ name, household, priorities, onboarded: true })
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-500 ${
                i === step ? 'w-8 bg-stone-800' : i < step ? 'w-2 bg-stone-400' : 'w-2 bg-stone-200'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 mb-6">
              <Sparkles className="w-10 h-10 text-amber-800" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900 mb-3" style={{ fontFamily: "'Georgia', serif" }}>
              Meet Life Pilot AI
            </h1>
            <p className="text-lg text-stone-500 mb-2 leading-relaxed">
              Your AI co-pilot for everything life throws at you.
            </p>
            <p className="text-stone-400 mb-10 max-w-sm mx-auto">
              Think of me as that impossibly organized friend who always knows what to do, what's due, and what's for dinner.
            </p>
            <Button
              onClick={() => setStep(1)}
              className="bg-stone-900 hover:bg-stone-800 text-white px-8 py-6 text-lg rounded-2xl"
            >
              Let's get started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <div className="mt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-stone-500">
                Already have an account?{' '}
                <button onClick={() => setStep(-1)} className="text-amber-600 font-semibold hover:text-amber-700">
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Step -1: Sign in for returning users */}
        {step === -1 && <OnboardingSignIn onBack={() => setStep(0)} />}

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "'Georgia', serif" }}>
              First, what should I call you?
            </h2>
            <p className="text-stone-400 mb-8">Just your first name is perfect.</p>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="text-lg py-6 px-4 rounded-xl border-stone-200 bg-white focus:border-amber-400 focus:ring-amber-400"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
            />
            <Button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full mt-4 bg-stone-900 hover:bg-stone-800 text-white py-6 text-lg rounded-2xl disabled:opacity-30"
            >
              Continue <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Step 2: Household */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "'Georgia', serif" }}>
              Who's in your household, {name}?
            </h2>
            <p className="text-stone-400 mb-6">Add family members, roommates, pets — anyone I should know about. Or skip this.</p>
            <div className="flex gap-2 mb-4">
              <Input
                value={householdInput}
                onChange={e => setHouseholdInput(e.target.value)}
                placeholder="e.g. Marcus (husband), Luna (cat)"
                className="text-base py-5 px-4 rounded-xl border-stone-200 bg-white"
                onKeyDown={e => e.key === 'Enter' && addHouseholdMember()}
              />
              <Button onClick={addHouseholdMember} variant="outline" className="px-4 rounded-xl border-stone-200">
                Add
              </Button>
            </div>
            {household.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {household.map((h, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 text-sm cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    onClick={() => setHousehold(prev => prev.filter((_, j) => j !== i))}
                  >
                    {h} ✕
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                onClick={() => setStep(3)}
                variant="ghost"
                className="flex-1 py-6 text-base rounded-2xl text-stone-400"
              >
                Skip for now
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white py-6 text-base rounded-2xl"
              >
                Continue <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Priorities */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "'Georgia', serif" }}>
              What drains your energy most?
            </h2>
            <p className="text-stone-400 mb-6">Pick the areas where you need the most help. I'll prioritize these.</p>
            <div className="grid grid-cols-1 gap-3 mb-8">
              {PRIORITIES.map(p => {
                const Icon = p.icon
                const selected = priorities.includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePriority(p.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      selected
                        ? 'border-stone-800 bg-stone-50 shadow-sm'
                        : 'border-stone-100 bg-white hover:border-stone-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${p.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-base font-medium text-stone-700 flex-1">{p.label}</span>
                    {selected && (
                      <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <Button
              onClick={handleComplete}
              className="w-full bg-stone-900 hover:bg-stone-800 text-white py-6 text-lg rounded-2xl"
            >
              Launch my Life Pilot AI <Sparkles className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function OnboardingSignIn({ onBack }: { onBack: () => void }) {
  const { signInWithEmail, signInWithGoogle, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async () => {
    if (!email.trim() || !password) return
    setLoading(true); setError('')
    const result = await signInWithEmail(email.trim(), password)
    setLoading(false)
    if (result.error) setError(result.error)
    // If successful, the auth state change will trigger App.tsx to load cloud data and skip onboarding
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-stone-900 mb-2 text-center" style={{ fontFamily: "'Georgia', serif" }}>
        Welcome back
      </h2>
      <p className="text-stone-500 mb-6 text-center">Sign in to pick up where you left off</p>

      <button onClick={() => { setLoading(true); signInWithGoogle() }}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white border border-stone-200 text-stone-700 text-base font-medium hover:bg-stone-50 mb-4">
        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        {loading ? 'Connecting...' : 'Continue with Google'}
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-stone-200" /><span className="text-xs text-stone-500">or</span><div className="flex-1 h-px bg-stone-200" />
      </div>

      <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address"
        className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400 mb-3" />
      <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password"
        onKeyDown={e => e.key === 'Enter' && handleSignIn()}
        className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400 mb-3" />

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-3">{error}</p>}

      <Button onClick={handleSignIn} disabled={loading || !email.trim() || !password}
        className="w-full bg-amber-500 hover:bg-amber-600 text-white py-6 text-base rounded-xl mb-3 disabled:opacity-50">
        Sign in
      </Button>

      <div className="flex justify-between">
        <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-700">← Back</button>
        <button onClick={async () => {
          if (!email.trim()) { setError('Enter your email first'); return }
          const r = await resetPassword(email.trim())
          if (r.error) setError(r.error)
          else setError('Password reset email sent! Check your inbox.')
        }} className="text-sm text-amber-600 hover:text-amber-700">Forgot password?</button>
      </div>
    </div>
  )
}
