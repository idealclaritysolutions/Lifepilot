import { useState, useEffect } from 'react'
import { Bell, MapPin, ArrowRight, X } from 'lucide-react'

interface Props {
  onGoToSettings: () => void
  onSkip: () => void
}

export function SetupPrompt({ onGoToSettings, onSkip }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('lp-setup-prompt-seen')
    if (!seen) {
      // Delay so it doesn't overlap with install prompt
      setTimeout(() => setShow(true), 1500)
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('lp-setup-prompt-seen', '1')
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-6 pt-6 pb-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center mx-auto mb-3 shadow-md">
            <span className="text-2xl">✦</span>
          </div>
          <h2 className="text-lg font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>
            One quick thing
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            So you never miss what matters
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-none">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">Push Notifications</p>
              <p className="text-xs text-stone-500 leading-relaxed mt-0.5">
                The best ideas and reminders mean nothing if they don't reach you at the right moment. Enable notifications so LifePilot can nudge you before deadlines slip, birthdays pass, and habits break.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-none">
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">Location</p>
              <p className="text-xs text-stone-500 leading-relaxed mt-0.5">
                When you need to find a pharmacy, a restaurant, or the nearest anything — LifePilot can only help if it knows where you are. Your location stays private and is never shared.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-2">
          <button onClick={() => { dismiss(); onGoToSettings() }}
            className="w-full py-3 rounded-xl bg-stone-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-stone-700 transition-colors">
            Enable in Settings <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => { dismiss(); onSkip() }}
            className="w-full py-2.5 rounded-xl text-stone-400 text-xs font-medium hover:text-stone-500 transition-colors">
            I'll do this later
          </button>
        </div>
      </div>
    </div>
  )
}
