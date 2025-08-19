'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logAuthEvent } from '@/lib/auth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the auth code from URL parameters
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (error) {
          console.error('Auth callback error:', error, errorDescription)
          setStatus('error')
          setMessage(errorDescription || error)
          return
        }

        if (!code) {
          setStatus('error')
          setMessage('認証コードが見つかりません')
          return
        }

        // Exchange the auth code for a session
        const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

        if (sessionError) {
          console.error('Session exchange error:', sessionError)
          setStatus('error')
          setMessage('認証に失敗しました: ' + sessionError.message)
          return
        }

        if (data.user) {
          // Log successful authentication
          await logAuthEvent('login', data.user.email || undefined, {
            user_id: data.user.id,
            login_method: 'magic_link',
            callback_success: true,
          })

          setStatus('success')
          setMessage('ログインに成功しました。ダッシュボードにリダイレクトします...')
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else {
          setStatus('error')
          setMessage('ユーザー情報の取得に失敗しました')
        }
      } catch (error) {
        console.error('Auth callback processing error:', error)
        setStatus('error')
        setMessage('認証処理中にエラーが発生しました')
      }
    }

    handleAuthCallback()
  }, [searchParams, router])

  const handleRetry = () => {
    router.push('/auth/login')
  }

  const handleGoToDashboard = () => {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            {status === 'loading' && (
              <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
            
            {status === 'success' && (
              <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            
            {status === 'error' && (
              <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
            {status === 'loading' && '認証処理中...'}
            {status === 'success' && 'ログイン成功'}
            {status === 'error' && '認証エラー'}
          </h2>

          <p className="text-sm text-gray-600 mb-8">
            {message}
          </p>

          {status === 'error' && (
            <div className="space-y-4">
              <button
                onClick={handleRetry}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ログインページに戻る
              </button>
              
              <p className="text-xs text-gray-500">
                問題が続く場合は、システム管理者にお問い合わせください
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <button
                onClick={handleGoToDashboard}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                ダッシュボードへ移動
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-xs text-gray-500">
              <p>メールリンクの認証処理を行っています...</p>
              <p className="mt-2">少々お待ちください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
