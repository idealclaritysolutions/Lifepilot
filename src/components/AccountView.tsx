import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { User, LogOut, Shield, X, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  onClose: () => void
}

export function AccountView({ onClose }: Props) {
  const { isSignedIn, user, userName, userEmail, userAvatar, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, resetPassword, updatePassword, isRecovery, clearRecovery } = useAuth()
  const [mode, setMode] = useState<'view' | 'signin' | 'signup'>('view')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSignIn = async () => {
    if (!email.trim() || !password) return
    setLoading(true); setError('')
    const result = await signInWithEmail(email.trim(), password)
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      toast.success('Signed in!')
      setMode('view')
    }
  }

  const handleSignUp = async () => {
    if (!email.trim() || !password) return
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const result = await signUpWithEmail(email.trim(), password, name.trim())
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      toast.success('Account created! Check your email to confirm, then sign in here.')
      setMode('view')
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    await signInWithGoogle()
  }

  // Signed in
  // Password recovery flow
  if (isRecovery) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF9F6]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Reset Password</h1>
          <button onClick={() => { clearRecovery(); onClose() }} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
            <X className="w-5 h-5 text-stone-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🔐</span>
            </div>
            <h2 className="text-lg font-bold text-stone-800 mb-1">Set your new password</h2>
            <p className="text-sm text-stone-600">Choose a strong password for your account</p>
          </div>
          <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
            type="password" placeholder="New password (min 6 characters)"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800" />
          <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            type="password" placeholder="Confirm new password"
            onKeyDown={e => { if (e.key === 'Enter' && newPassword.length >= 6 && newPassword === confirmPassword) {
              setLoading(true); updatePassword(newPassword).then(r => { setLoading(false); if (r.error) setError(r.error); else { toast.success('Password updated!'); clearRecovery() } })
            }}}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800" />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}
          <button onClick={async () => {
            if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
            if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
            setLoading(true); setError('')
            const r = await updatePassword(newPassword)
            setLoading(false)
            if (r.error) setError(r.error)
            else { toast.success('Password updated successfully!'); clearRecovery() }
          }} disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
            className="w-full py-3.5 rounded-xl bg-amber-500 text-white text-base font-semibold disabled:opacity-50">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>
    )
  }

  // Signed in
  if (isSignedIn && user) {
    return (
      <div className="min-h-[100dvh] bg-[#FAF9F6]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Account</h1>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
            <X className="w-5 h-5 text-stone-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              {userAvatar ? (
                <img src={userAvatar} alt="" className="w-14 h-14 rounded-full" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center">
                  <User className="w-7 h-7 text-amber-800" />
                </div>
              )}
              <div>
                <p className="font-bold text-stone-800 text-lg">{userName}</p>
                <p className="text-sm text-stone-500">{userEmail}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <p className="font-semibold text-emerald-800 text-sm">Account active</p>
            </div>
            <p className="text-sm text-emerald-700 leading-relaxed">
              Your data syncs to the cloud automatically. Access it from any device by signing in.
            </p>
          </div>

          <button onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50">
            <LogOut className="w-4 h-4" /> Sign out
          </button>

          <button onClick={async () => {
            if (!confirm('Delete your account and all cloud data? This cannot be undone. Your local data will remain on this device.')) return
            if (!confirm('Are you absolutely sure? All your synced data will be permanently deleted.')) return
            try {
              const { deleteUserData } = await import('@/lib/supabase')
              await deleteUserData(user!.id)
              await signOut()
              toast.success('Account data deleted.')
            } catch { toast.error('Failed to delete. Try again.') }
          }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-red-400 hover:text-red-600">
            Delete my account and data
          </button>
        </div>
      </div>
    )
  }

  // Sign in / Sign up form
  if (mode === 'signin' || mode === 'signup') {
    return (
      <div className="min-h-[100dvh] bg-[#FAF9F6]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <button onClick={() => { setMode('view'); setError('') }} className="text-sm text-stone-600 font-medium">← Back</button>
          <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
            <X className="w-5 h-5 text-stone-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Google sign in */}
          <button onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white border border-stone-200 text-stone-700 text-base font-medium hover:bg-stone-50 disabled:opacity-50">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {loading ? 'Connecting...' : `Continue with Google`}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-500">or</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          {/* Email form */}
          {mode === 'signup' && (
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400" />
          )}
          <input value={email} onChange={e => setEmail(e.target.value)}
            type="email" placeholder="Email address" autoComplete="email"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400" />
          <div className="relative">
            <input value={password} onChange={e => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'} placeholder="Password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              onKeyDown={e => e.key === 'Enter' && (mode === 'signin' ? handleSignIn() : handleSignUp())}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-base text-stone-800 placeholder:text-stone-400 pr-12" />
            <button onClick={() => setShowPassword(!showPassword)} type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
          )}

          <button onClick={mode === 'signin' ? handleSignIn : handleSignUp} disabled={loading || !email.trim() || !password}
            className="w-full py-3.5 rounded-xl bg-amber-500 text-white text-base font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
            className="w-full text-sm text-stone-600 hover:text-amber-600">
            {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>
          {mode === 'signin' && (
            <button onClick={async () => {
              if (!email.trim()) { setError('Enter your email first, then tap Forgot password'); return }
              const result = await resetPassword(email.trim())
              if (result.error) setError(result.error)
              else { setError(''); toast.success('Password reset email sent! Check your inbox.') }
            }} className="w-full text-xs text-stone-500 hover:text-amber-600 mt-1">
              Forgot your password?
            </button>
          )}
        </div>
      </div>
    )
  }

  // Not signed in — landing
  return (
    <div className="min-h-[100dvh] bg-[#FAF9F6]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
        <h1 className="text-base font-bold text-stone-800" style={{ fontFamily: "'Georgia', serif" }}>Account</h1>
        <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center">
          <X className="w-5 h-5 text-stone-600" />
        </button>
      </div>
      <div className="p-5 space-y-5">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-amber-700" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2" style={{ fontFamily: "'Georgia', serif" }}>
            Save your progress
          </h2>
          <p className="text-base text-stone-600 max-w-xs mx-auto leading-relaxed">
            Create a free account to keep your journal, tasks, and habits safe — even if you switch devices.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
          {[
            { icon: '🔒', text: 'Your data backed up securely' },
            { icon: '📱', text: 'Access from any device' },
            { icon: '👥', text: 'Share lists with family & friends' },
            { icon: '👑', text: 'Unlock premium features' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-3">
              <span className="text-lg">{b.icon}</span>
              <p className="text-sm text-stone-700">{b.text}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button onClick={() => setMode('signup')}
            className="w-full py-3.5 rounded-xl bg-amber-500 text-white text-base font-semibold hover:bg-amber-600 active:scale-[0.98]">
            Create free account
          </button>
          <button onClick={() => setMode('signin')}
            className="w-full py-3.5 rounded-xl bg-white border border-stone-200 text-stone-700 text-base font-medium hover:bg-stone-50 active:scale-[0.98]">
            Already have an account? Sign in
          </button>
        </div>

        <p className="text-xs text-stone-500 text-center">
          You can keep using LifePilot without an account. Your data stays on this device.
        </p>
      </div>
    </div>
  )
}
