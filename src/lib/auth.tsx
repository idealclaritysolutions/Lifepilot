import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoaded: boolean
  isSignedIn: boolean
  isRecovery: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
  updatePassword: (newPassword: string) => Promise<{ error?: string }>
  clearRecovery: () => void
  userName: string
  userEmail: string
  userAvatar: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)
  const lastUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      lastUserIdRef.current = s?.user?.id ?? null
      setIsLoaded(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // Detect password recovery flow
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
      
      const newUserId = s?.user?.id ?? null
      if (newUserId !== lastUserIdRef.current) {
        setSession(s)
        setUser(s?.user ?? null)
        lastUserIdRef.current = newUserId
        setIsLoaded(true)
      } else if (s) {
        setSession(s)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || '' },
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return { error: error.message }
    return {}
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) return { error: error.message }
    return {}
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }
    setIsRecovery(false)
    return {}
  }, [])

  const clearRecovery = useCallback(() => setIsRecovery(false), [])

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const userEmail = user?.email || ''
  const userAvatar = user?.user_metadata?.avatar_url || null
  const isSignedIn = !!user

  const value = useMemo(() => ({
    user,
    session,
    isLoaded,
    isSignedIn,
    isRecovery,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    clearRecovery,
    userName,
    userEmail,
    userAvatar,
  }), [user?.id, isLoaded, isSignedIn, isRecovery, session?.access_token])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
