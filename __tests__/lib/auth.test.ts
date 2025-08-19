import { authClient, authServer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import { createServerClient } from '@/lib/supabase/server'

// Mock Supabase clients
jest.mock('@/lib/supabase/client')
jest.mock('@/lib/supabase/server')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCreateServerClient = createServerClient as jest.MockedFunction<
  typeof createServerClient
>

describe('Auth Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock window.location for client-side tests
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost:3000',
        href: 'http://localhost:3000',
      },
      writable: true,
    })
  })

  describe('authClient', () => {
    const mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
        signOut: jest.fn(),
        signInWithOtp: jest.fn(),
        onAuthStateChange: jest.fn(),
      },
    }

    beforeEach(() => {
      mockCreateClient.mockReturnValue(mockSupabaseClient as any)
    })

    describe('getCurrentUser', () => {
      it('should return user when authenticated', async () => {
        const mockUser = {
          id: '123',
          email: 'test@example.com',
          aud: 'authenticated',
          created_at: '2023-01-01T00:00:00.000Z',
        }

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        })

        const result = await authClient.getCurrentUser()

        expect(result).toEqual(mockUser)
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(1)
      })

      it('should return null when not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        })

        const result = await authClient.getCurrentUser()

        expect(result).toBeNull()
      })

      it('should return null when there is an error', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Auth error' },
        })

        const result = await authClient.getCurrentUser()

        expect(result).toBeNull()
      })
    })

    describe('signOut', () => {
      it('should call supabase signOut and redirect', async () => {
        mockSupabaseClient.auth.signOut.mockResolvedValue({
          error: null,
        })

        // Mock window.location.href
        const mockLocationAssign = jest.fn()
        Object.defineProperty(window, 'location', {
          value: { href: 'http://localhost:3000' },
          writable: true,
        })

        await authClient.signOut()

        expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledTimes(1)
        expect(window.location.href).toBe('/auth')
      })
    })

    describe('sendMagicLink', () => {
      it('should send magic link successfully', async () => {
        const email = 'test@example.com'
        mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({
          data: {},
          error: null,
        })

        const result = await authClient.sendMagicLink(email)

        expect(result).toEqual({})
        expect(mockSupabaseClient.auth.signInWithOtp).toHaveBeenCalledWith({
          email,
          options: {
            emailRedirectTo: 'http://localhost:3000/auth/callback',
            shouldCreateUser: true,
          },
        })
      })

      it('should return error when magic link fails', async () => {
        const email = 'test@example.com'
        const errorMessage = 'Invalid email'
        mockSupabaseClient.auth.signInWithOtp.mockResolvedValue({
          data: {},
          error: { message: errorMessage },
        })

        const result = await authClient.sendMagicLink(email)

        expect(result).toEqual({ error: errorMessage })
      })
    })

    describe('onAuthStateChange', () => {
      it('should set up auth state listener', () => {
        const mockCallback = jest.fn()
        const mockUnsubscribe = jest.fn()
        const mockSubscription = { unsubscribe: mockUnsubscribe }

        mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
          data: { subscription: mockSubscription },
        })

        const unsubscribe = authClient.onAuthStateChange(mockCallback)

        expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledWith(
          expect.any(Function),
        )

        // Test the unsubscribe function
        unsubscribe()
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
      })

      it('should call callback with user when auth state changes', () => {
        const mockCallback = jest.fn()
        const mockUser = { id: '123', email: 'test@example.com' }
        const mockSession = { user: mockUser }

        let authStateCallback: any
        mockSupabaseClient.auth.onAuthStateChange.mockImplementation(
          (callback) => {
            authStateCallback = callback
            return {
              data: { subscription: { unsubscribe: jest.fn() } },
            }
          },
        )

        authClient.onAuthStateChange(mockCallback)

        // Simulate auth state change with session
        authStateCallback('SIGNED_IN', mockSession)
        expect(mockCallback).toHaveBeenCalledWith(mockUser)

        // Simulate auth state change without session
        authStateCallback('SIGNED_OUT', null)
        expect(mockCallback).toHaveBeenCalledWith(null)
      })
    })
  })

  describe('authServer', () => {
    const mockSupabaseServerClient = {
      auth: {
        getUser: jest.fn(),
        getSession: jest.fn(),
      },
    }

    beforeEach(() => {
      mockCreateServerClient.mockReturnValue(mockSupabaseServerClient as any)
    })

    describe('getCurrentUser', () => {
      it('should return user from server', async () => {
        const mockUser = {
          id: '123',
          email: 'test@example.com',
          aud: 'authenticated',
          created_at: '2023-01-01T00:00:00.000Z',
        }

        mockSupabaseServerClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        })

        const result = await authServer.getCurrentUser()

        expect(result).toEqual(mockUser)
        expect(mockSupabaseServerClient.auth.getUser).toHaveBeenCalledTimes(1)
      })
    })

    describe('getSession', () => {
      it('should return session from server', async () => {
        const mockSession = {
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: '123', email: 'test@example.com' },
        }

        mockSupabaseServerClient.auth.getSession.mockResolvedValue({
          data: { session: mockSession },
          error: null,
        })

        const result = await authServer.getSession()

        expect(result).toEqual(mockSession)
        expect(mockSupabaseServerClient.auth.getSession).toHaveBeenCalledTimes(1)
      })
    })
  })
})
