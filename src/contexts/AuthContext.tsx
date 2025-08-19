'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { 
  getCurrentSession, 
  onAuthStateChange, 
  signInWithMagicLink,
  signOut as authSignOut,
  logAuthEvent,
  type AuthState 
} from '@/lib/auth'

interface AuthContextType extends AuthState {
  signIn: (email: string) => Promise<{ error?: string; success?: boolean }>
  signOut: () => Promise<{ error?: string }>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { user, session } = await getCurrentSession()
        setUser(user)
        setSession(session)
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()
  }, [])

  // Listen to auth changes
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (newUser, newSession) => {
      setUser(newUser)
      setSession(newSession)
      setLoading(false)

      // Log auth events
      if (newUser && newSession && !user) {
        // User logged in
        await logAuthEvent('login', newUser.email || undefined, {
          user_id: newUser.id,
          session_id: newSession.access_token.substring(0, 8) + '...',
        })
      } else if (!newUser && user) {
        // User logged out
        await logAuthEvent('logout', user.email || undefined, {
          user_id: user.id,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [user])

  const signIn = useCallback(async (email: string) => {
    try {
      setLoading(true)
      
      await logAuthEvent('login_attempt', email)
      
      const { error } = await signInWithMagicLink(email)
      
      if (error) {
        console.error('Sign in error:', error)
        return { error: error.message }
      }
      
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Sign in failed:', error)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      setLoading(true)
      
      const { error } = await authSignOut()
      
      if (error) {
        console.error('Sign out error:', error)
        return { error: error.message }
      }
      
      // State will be updated by the auth state change listener
      return {}
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Sign out failed:', error)
      return { error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAuth = useCallback(async () => {
    try {
      const { user, session } = await getCurrentSession()
      setUser(user)
      setSession(session)
      
      if (user) {
        await logAuthEvent('session_refresh', user.email || undefined, {
          user_id: user.id,
        })
      }
    } catch (error) {
      console.error('Failed to refresh auth:', error)
    }
  }, [])

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    refreshAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Auth guard hook
export function useRequireAuth() {
  const { user, loading } = useAuth()
  
  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login page
      window.location.href = '/auth/login'
    }
  }, [user, loading])
  
  return { user, loading, isAuthenticated: !!user }
}

// Admin guard hook (for future RBAC implementation)
export function useRequireAdmin() {
  const { user, loading } = useAuth()
  
  // TODO: Implement role checking when RBAC is added
  const isAdmin = user?.email?.endsWith('@admin.com') // Placeholder logic
  
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      // Redirect to unauthorized page
      window.location.href = '/unauthorized'
    }
  }, [user, loading, isAdmin])
  
  return { user, loading, isAuthenticated: !!user, isAdmin }
}
