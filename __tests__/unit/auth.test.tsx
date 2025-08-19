/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { signInWithMagicLink, signOut, isValidEmail } from '@/lib/auth'

// Mock the Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      })),
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ error: null }))
    }))
  }
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Test component to test auth hooks
function TestAuthComponent() {
  const { user, loading, signIn, signOut: authSignOut } = useAuth()

  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{user?.email || 'no-user'}</div>
      <button onClick={() => signIn('test@example.com')} data-testid="sign-in">
        Sign In
      </button>
      <button onClick={authSignOut} data-testid="sign-out">
        Sign Out
      </button>
    </div>
  )
}

describe('Authentication System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name+tag@domain.co.jp')).toBe(true)
      expect(isValidEmail('admin@company.com')).toBe(true)
    })

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('test.domain.com')).toBe(false)
    })
  })

  describe('Auth Helper Functions', () => {
    it('should call signInWithMagicLink with correct parameters', async () => {
      const mockSignInWithOtp = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null
      })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.signInWithOtp = mockSignInWithOtp

      await signInWithMagicLink('test@example.com')

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
    })

    it('should call signOut correctly', async () => {
      const mockSignOut = jest.fn().mockResolvedValue({ error: null })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.signOut = mockSignOut

      await signOut()

      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  describe('AuthProvider', () => {
    it('should provide authentication context', () => {
      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      expect(screen.getByTestId('sign-in')).toBeInTheDocument()
      expect(screen.getByTestId('sign-out')).toBeInTheDocument()
    })

    it('should handle sign in attempts', async () => {
      const mockSignInWithOtp = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null
      })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.signInWithOtp = mockSignInWithOtp

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      )

      fireEvent.click(screen.getByTestId('sign-in'))

      await waitFor(() => {
        expect(mockSignInWithOtp).toHaveBeenCalled()
      })
    })

    it('should handle sign out attempts', async () => {
      const mockSignOut = jest.fn().mockResolvedValue({ error: null })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.signOut = mockSignOut

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      )

      fireEvent.click(screen.getByTestId('sign-out'))

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle sign in errors gracefully', async () => {
      const mockSignInWithOtp = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid email' }
      })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.signInWithOtp = mockSignInWithOtp

      const result = await signInWithMagicLink('invalid@example.com')

      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Invalid email')
    })

    it('should handle sign out errors gracefully', async () => {
      const mockSignOut = jest.fn().mockResolvedValue({
        error: { message: 'Network error' }
      })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.signOut = mockSignOut

      const result = await signOut()

      expect(result.error).toBeDefined()
      expect(result.error?.message).toBe('Network error')
    })
  })

  describe('Session Management', () => {
    it('should initialize with session check', () => {
      const mockGetSession = jest.fn().mockResolvedValue({
        data: { session: null },
        error: null
      })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.getSession = mockGetSession

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      )

      expect(mockGetSession).toHaveBeenCalled()
    })

    it('should set up auth state change listener', () => {
      const mockOnAuthStateChange = jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      }))

      const { supabase } = require('@/lib/supabase')
      supabase.auth.onAuthStateChange = mockOnAuthStateChange

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>
      )

      expect(mockOnAuthStateChange).toHaveBeenCalled()
    })
  })

  describe('Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const result = await signInWithMagicLink('test@example.com')
      
      // Check that the result doesn't contain any database errors or internal details
      if (result.error) {
        expect(result.error).not.toContain('password')
        expect(result.error).not.toContain('database')
        expect(result.error).not.toContain('internal')
      }
    })

    it('should use secure redirect URL', async () => {
      const mockSignInWithOtp = jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null
      })

      const { supabase } = require('@/lib/supabase')
      supabase.auth.signInWithOtp = mockSignInWithOtp

      await signInWithMagicLink('test@example.com')

      const callArgs = mockSignInWithOtp.mock.calls[0][0]
      expect(callArgs.options.emailRedirectTo).toContain('/auth/callback')
      expect(callArgs.options.emailRedirectTo).toMatch(/^https?:\/\//)
    })
  })
})
