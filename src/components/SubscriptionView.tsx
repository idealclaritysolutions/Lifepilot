import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import type { AppState, Subscription, SubscriptionTier, PROMO_CODES } from '@/App'
import { Check, Crown, Sparkles, Zap, Star, X } from 'lucide-react'

interface Props {
  state: AppState
  applyPromoCode: (code: string) => boolean
  onClose: () => void
}

const TIERS = [
  {
    id: 'free' as SubscriptionTier,
    name: 'Clarity Starter',
    price: 'Free',
    annual: '',
    icon: '✦',
    color: 'border-stone-200',
    features: ['10 AI messages/day', '5 journal entries/month', '3 people tracked', 'Life board', 'Push notifications'],
    missing: ['Voice journal', 'Theme detection', 'Weekly recaps', 'Document scanning', 'Habit tracking', 'Shared lists', 'Monthly reports'],
  },
  {
    id: 'pro' as SubscriptionTier,
    name: 'Life Pilot',
    price: '$9.99/mo',
    annual: '$79.99/yr (save 33%)',
    icon: '⚡',
    color: 'border-amber-300 ring-2 ring-amber-100',
    popular: true,
    features: ['Unlimited AI chat', 'Unlimited journal + voice', 'Theme detection + coaching', 'Weekly recaps', 'Unlimited people & events', 'Document scanning', 'Location search', 'Calendar integration', 'Daily nudges', 'Journal search'],
    missing: ['Shared lists', 'Habit tracking', 'Monthly life report', 'Journal export'],
  },
  {
    id: 'premium' as SubscriptionTier,
    name: 'Inner Circle',
    price: '$19.99/mo',
    annual: '$149.99/yr (save 37%)',
    icon: '👑',
    color: 'border-purple-300 ring-2 ring-purple-100',
    features: ['Everything in Life Pilot', 'Shared lists with family & friends', 'Habit tracking + streaks', 'Monthly life report (PDF)', 'Purchase intelligence', 'Journal export to PDF', 'Custom themes', 'Priority AI responses', 'Early access to features'],
    missing: [],
  },
  {
    id: 'enterprise' as SubscriptionTier,
    name: 'Guided',
    price: '$79.99/mo',
    annual: '',
    icon: '🎯',
    color: 'border-rose-300',
    features: ['Everything in Inner Circle', 'Monthly 30-min coaching call', 'Personalized weekly check-ins', 'Custom goal-setting', 'Coach reviews your patterns', 'Priority support'],
    missing: [],
  },
]

const STRIPE_LINKS: Record<string, { monthly: string; annual?: string }> = {
  pro: {
    monthly: 'https://buy.stripe.com/aFa4gA0fU9nb8aP7zBdAk0g',
    annual: 'https://buy.stripe.com/6oUcN6e6Karf8aP2fhdAk0h',
  },
  premium: {
    monthly: 'https://buy.stripe.com/fZu7sMgeSdDrcr5cTVdAk0i',
    annual: 'https://buy.stripe.com/eVqcN6e6KdDrfDhdXZdAk0j',
  },
  enterprise: {
    monthly: 'https://buy.stripe.com/5kQaEYbYCgPDezd8DFdAk0k',
  },
}

export function SubscriptionView({ state, applyPromoCode, onClose }: Props) {
  const [promoInput, setPromoInput] = useState('')
  const [promoResult, setPromoResult] = useState<'success' | 'error' | null>(null)
  const [promoMsg, setPromoMsg] = useState('')
  const { user } = useAuth()

  const currentTier = state.subscription.tier
  const expiresAt = state.subscription.expiresAt ? new Date(state.subscription.expiresAt) : null
  const isExpired = expiresAt ? expiresAt < new Date() : false

  // Append user email to Stripe links for prefill
  const getStripeLink = (baseUrl: string) => {
    const email = user?.primaryEmailAddress?.emailAddress
    if (email) return `${baseUrl}?prefilled_email=${encodeURIComponent(email)}`
    return baseUrl
  }

  const handlePromo = () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    const success = applyPromoCode(code)
    if (success) {
      setPromoResult('success')
      setPromoMsg('Code applied! Enjoy your upgrade. 🎉')
    } else {
      setPromoResult('error')
      setPromoMsg('Invalid code. Check and try again.')
    }
    setTimeout(() => { setPromoResult(null); setPromoMsg('') }, 5000)
  }

  return (
    <div className="min-h-[100dvh] bg-[#FAF9F6]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
        <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Choose Your Plan</h1>
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
          <X className="w-5 h-5 text-stone-400" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto pb-32">
        {/* Current status */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
          <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider mb-1">Current Plan</p>
          <p className="text-lg font-bold text-stone-800">{TIERS.find(t => t.id === currentTier)?.name || 'Free'}</p>
          {state.subscription.promoCode && (
            <p className="text-xs text-amber-500 mt-1">Code: {state.subscription.promoCode}</p>
          )}
          {expiresAt && !isExpired && (
            <p className="text-xs text-stone-400 mt-1">Expires: {expiresAt.toLocaleDateString()}</p>
          )}
          {isExpired && (
            <p className="text-xs text-red-500 mt-1 font-medium">Expired — renew to keep your features</p>
          )}
        </div>

        {/* Promo code */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Have a code?</p>
          <div className="flex gap-2">
            <input value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())}
              placeholder="Enter promo code"
              className="flex-1 px-3 py-2.5 rounded-xl border border-stone-200 text-sm uppercase tracking-wider font-mono"
              onKeyDown={e => e.key === 'Enter' && handlePromo()} />
            <button onClick={handlePromo} className="px-5 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium">Apply</button>
          </div>
          {promoResult && (
            <p className={`text-xs mt-2 font-medium ${promoResult === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
              {promoResult === 'success' ? '✅ ' : '❌ '}{promoMsg}
            </p>
          )}
        </div>

        {/* Tier cards */}
        {TIERS.map(tier => {
          const isCurrent = tier.id === currentTier && !isExpired
          return (
            <div key={tier.id} className={`bg-white rounded-2xl border-2 p-5 shadow-sm relative ${isCurrent ? 'border-emerald-300 ring-2 ring-emerald-100' : tier.color}`}>
              {tier.popular && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">Most Popular</span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider">Current Plan</span>
              )}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{tier.icon}</span>
                <div>
                  <p className="font-bold text-stone-800">{tier.name}</p>
                  <p className="text-sm text-amber-600 font-semibold">{tier.price}</p>
                  {tier.annual && <p className="text-[10px] text-stone-400">{tier.annual}</p>}
                </div>
              </div>
              <div className="space-y-1.5 mb-3">
                {tier.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-stone-600">
                    <Check className="w-3.5 h-3.5 text-emerald-500 flex-none" /><span>{f}</span>
                  </div>
                ))}
                {tier.missing.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-stone-400">
                    <X className="w-3.5 h-3.5 flex-none" /><span>{f}</span>
                  </div>
                ))}
              </div>
              {tier.id !== 'free' && !isCurrent && (
                <div className="space-y-2">
                  {STRIPE_LINKS[tier.id]?.monthly && (
                    <a href={getStripeLink(STRIPE_LINKS[tier.id].monthly)} target="_blank" rel="noopener noreferrer"
                      className="block w-full py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors text-center">
                      {tier.id === 'enterprise' ? 'Subscribe — $79.99/mo' : `Subscribe — ${tier.price}`}
                    </a>
                  )}
                  {STRIPE_LINKS[tier.id]?.annual && (
                    <a href={getStripeLink(STRIPE_LINKS[tier.id].annual!)} target="_blank" rel="noopener noreferrer"
                      className="block w-full py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium hover:bg-amber-100 transition-colors text-center">
                      Save with annual — {tier.annual?.split(' ')[0]}
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
