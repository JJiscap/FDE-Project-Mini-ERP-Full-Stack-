import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/query-client'

interface AuthContextValue {
  /** `undefined` while the stored session is being read, `null` when logged out. */
  session: Session | null | undefined
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Message shown on the login page for the failures people can fix. */
export class LoginError extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    // Do not await Supabase calls inside this callback (supabase-js deadlock warning).
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return
    if (error.status === 400 || error.code === 'invalid_credentials') {
      throw new LoginError('Email or password is incorrect. Check them and try again.')
    }
    throw new LoginError('Cannot log in right now. Check your internet connection and try again.')
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [])

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
