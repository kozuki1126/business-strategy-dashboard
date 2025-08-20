/**
 * Authentication module - Client/Server separation
 * 
 * IMPORTANT: This file now only exports re-exports for convenience.
 * Use specific imports for better tree-shaking and to avoid client/server confusion:
 * 
 * For CLIENT components:
 * import { authClient } from '@/lib/auth-client'
 * 
 * For SERVER components:
 * import { getCurrentUser } from '@/lib/auth-server'
 */

// Re-export client helpers for backward compatibility
export { authClient, type AuthStatus, type AuthState } from './auth-client'

// Re-export server helpers for backward compatibility
// Note: Server-side functions should be imported directly from auth-server.ts
export { getCurrentUser, getSession } from './auth-server'
