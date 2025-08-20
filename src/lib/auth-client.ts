import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

/**
 * Client-side authentication helper functions
 * Note: This file should ONLY be used in client components
 */
export const authClient = {
  /**
   * Get current user session (client-side)
   */
  getCurrentUser: async (): Promise<User | null> => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  },

  /**
   * Sign out user (client-side)
   */
  signOut: async (): Promise<void> => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Redirect will be handled by middleware
    window.location.href = '/auth'
  },

  /**
   * Send magic link to email
   */
  sendMagicLink: async (email: string): Promise<{ error?: string }> => {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })

    if (error) {
      return { error: error.message }
    }

    return {}
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange: (callback: (user: User | null) => void) => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  },
}

/**
 * Authentication status type
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/**
 * Authentication state type
 */
export interface AuthState {
  user: User | null
  status: AuthStatus
  isLoading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}
