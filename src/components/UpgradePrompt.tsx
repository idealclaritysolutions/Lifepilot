import { Lock } from 'lucide-react'

interface Props {
  feature: string
  planNeeded: string
  compact?: boolean
}

export function UpgradePrompt({ feature, planNeeded, compact }: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
        <Lock className="w-3.5 h-3.5 text-amber-600 flex-none" />
        <p className="text-xs text-amber-800"><span className="font-semibold">{feature}</span> is available on the {planNeeded} plan. Tap 👑 to upgrade.</p>
      </div>
    )
  }
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-5 text-center">
      <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
        <Lock className="w-6 h-6 text-amber-600" />
      </div>
      <p className="text-base font-semibold text-amber-900 mb-1">{feature}</p>
      <p className="text-sm text-amber-800 mb-2">Available on the <span className="font-semibold">{planNeeded}</span> plan and above.</p>
      <p className="text-xs text-amber-700">Tap the 👑 icon in the top menu to view plans</p>
    </div>
  )
}
