import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'

/**
 * Server-side authentication helper functions
 * Note: This file should ONLY be used in Server Components and API routes
 * NEVER import this in client components as it uses next/headers
 */

/**
 * Get current user session (server-side)
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Get current session (server-side)
 */
export const getSession = async () => {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}
