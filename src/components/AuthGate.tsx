// Re-export useAuth for backward compat
export { useAuth } from '@/lib/auth'

// AccountSection used in Settings
import { useAuth } from '@/lib/auth'
import { LogIn, UserPlus, LogOut } from 'lucide-react'

export function AccountSection({ onSignOut }: { onSignOut: () => void }) {
  const { isSignedIn, userName, userEmail, userAvatar, signOut } = useAuth()

  if (isSignedIn) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
        <h3 className="font-semibold text-stone-800 text-base mb-3">Account</h3>
        <div className="flex items-center gap-3 mb-3">
          {userAvatar ? (
            <img src={userAvatar} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center">
              <span className="text-sm font-bold text-amber-800">{userName[0]}</span>
            </div>
          )}
          <div className="flex-1">
            <p className="text-base font-medium text-stone-800">{userName}</p>
            <p className="text-sm text-stone-500">{userEmail}</p>
          </div>
        </div>
        <p className="text-xs text-emerald-600 font-medium mb-3">Your data syncs to the cloud automatically</p>
        <button onClick={onSignOut}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 font-medium">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
      <h3 className="font-semibold text-stone-800 text-base mb-2">Account</h3>
      <p className="text-sm text-stone-600 mb-4">Sign in to sync your data across devices. Tap the account icon above.</p>
    </div>
  )
}

// Backward compat
export function AuthModal({ mode, onClose }: { mode: string; onClose: () => void }) {
  return null
}
