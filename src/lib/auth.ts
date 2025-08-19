import { createClient } from '@/lib/supabase/client'
import { createServerClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'

/**
 * Client-side authentication helper functions
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
 * Server-side authentication helper functions
 */
export const authServer = {
  /**
   * Get current user session (server-side)
   */
  getCurrentUser: async (): Promise<User | null> => {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  },

  /**
   * Get current session (server-side)
   */
  getSession: async () => {
    const supabase = createServerClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session
  },
}

/**
 * Authentication status type
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/**
 * Hook for managing authentication state (client-side only)
 */
export const useAuthState = () => {
  if (typeof window === 'undefined') {
    throw new Error('useAuthState can only be used on the client side')
  }

  const [user, setUser] = React.useState<User | null>(null)
  const [status, setStatus] = React.useState<AuthStatus>('loading')

  React.useEffect(() => {
    // Get initial session
    authClient.getCurrentUser().then((initialUser) => {
      setUser(initialUser)
      setStatus(initialUser ? 'authenticated' : 'unauthenticated')
    })

    // Listen for auth changes
    const unsubscribe = authClient.onAuthStateChange((user) => {
      setUser(user)
      setStatus(user ? 'authenticated' : 'unauthenticated')
    })

    return unsubscribe
  }, [])

  return {
    user,
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    signOut: authClient.signOut,
  }
}

// Add React import for the hook
const React = typeof window !== 'undefined' ? require('react') : null
