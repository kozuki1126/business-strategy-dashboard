'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const supabase = createClient()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true, // Allow sign-up via magic link
        },
      })

      if (error) {
        setMessage({
          type: 'error',
          text: error.message,
        })
      } else {
        setMessage({
          type: 'success',
          text: 'マジックリンクをメールで送信しました。メールをご確認ください。',
        })
        setEmail('')
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'エラーが発生しました。もう一度お試しください。',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            経営戦略ダッシュボード
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            メールアドレスでサインイン
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleMagicLink}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                メールアドレス
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                aria-describedby={message ? 'auth-message' : undefined}
              />
            </div>
          </div>

          {message && (
            <div
              id="auth-message"
              className={`rounded-md p-4 ${
                message.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}
              role={message.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              <p className="text-sm">{message.text}</p>
            </div>
          )}

          <div>
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-describedby="magic-link-description"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  送信中...
                </>
              ) : (
                'マジックリンクを送信'
              )}
            </Button>
          </div>

          <div className="text-center">
            <p id="magic-link-description" className="text-xs text-gray-600">
              マジックリンクをクリックするとサインインまたは新規登録が完了します。
              <br />
              アカウントがない場合は自動的に作成されます。
            </p>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">
                セキュアな認証方式
              </span>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              このシステムは社内利用専用です。
              <br />
              パスワード不要のセキュアな認証方式を採用しています。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
