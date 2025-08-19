import { supabase } from '@/lib/supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export interface AuthResponse {
  user?: User | null
  session?: Session | null
  error?: AuthError | null
}

/**
 * Send magic link to user's email
 */
export async function signInWithMagicLink(email: string): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  return { user: data.user, session: data.session, error }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Get current session
 */
export async function getCurrentSession(): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.getSession()
  return { user: data.session?.user || null, session: data.session, error }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.getUser()
  return { user: data.user, error }
}

/**
 * Refresh current session
 */
export async function refreshSession(): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.refreshSession()
  return { user: data.user, session: data.session, error }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(
  callback: (user: User | null, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null, session)
  })
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(session: Session | null): boolean {
  return !!session?.user
}

/**
 * Create audit log entry for authentication events
 */
export async function logAuthEvent(
  action: 'login' | 'logout' | 'login_attempt' | 'session_refresh',
  userEmail?: string,
  metadata?: Record<string, any>
) {
  try {
    const { error } = await supabase.from('audit_log').insert({
      actor_email: userEmail,
      action,
      target_type: 'auth',
      ip_address: null, // Will be set by RLS policy if needed
      user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    })

    if (error) {
      console.error('Failed to log auth event:', error)
    }
  } catch (err) {
    console.error('Error logging auth event:', err)
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Get user display name (email until profile is implemented)
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return ''
  return user.email || 'Unknown User'
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: Session | null): boolean {
  if (!session) return true
  
  const expiresAt = session.expires_at
  if (!expiresAt) return false
  
  return Date.now() / 1000 > expiresAt
}

/**
 * Get session expiry time
 */
export function getSessionExpiryTime(session: Session | null): Date | null {
  if (!session?.expires_at) return null
  return new Date(session.expires_at * 1000)
}
