'use client'

import { useState, useEffect, useMemo, Suspense, lazy } from 'react'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { 
  getAllStores,
  logAuditEvent
} from '@/lib/database/helpers'
import { DashboardFilters } from '@/types/database.types'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { 
  useAnalyticsData, 
  useDebouncedFilters, 
  usePerformanceMonitor,
  useMemoryMonitor,
  useAutoRefresh,
  useErrorHandler
} from '@/hooks/usePerformance'

// Lazy load components for better initial load performance
const SalesChart = lazy(() => import('@/components/dashboard/SalesChart').then(m => ({ default: m.SalesChart })))
const ExternalIndicators = lazy(() => import('@/components/dashboard/ExternalIndicators').then(m => ({ default: m.ExternalIndicators })))
const KPICards = lazy(() => import('@/components/dashboard/KPICards').then(m => ({ default: m.KPICards })))
const DashboardFilters = lazy(() => import('@/components/dashboard/DashboardFilters').then(m => ({ default: m.DashboardFilters })))

// Loading component for Suspense
function ComponentLoader({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-pulse bg-gray-100 rounded-lg h-64 flex items-center justify-center">
      <div className="text-gray-500">読み込み中...</div>
    </div>
  )
}

// Performance monitoring component
function PerformanceIndicator({ 
  responseTime, 
  cacheStats, 
  memoryUsage 
}: { 
  responseTime: number
  cacheStats: any
  memoryUsage: any 
}) {
  const getPerformanceColor = (time: number) => {
    if (time <= 1000) return 'text-green-600'
    if (time <= 1500) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-blue-700 font-medium">応答時間:</span>
          <span className={`ml-2 font-bold ${getPerformanceColor(responseTime)}`}>
            {responseTime.toFixed(0)}ms
          </span>
          {responseTime > 1500 && (
            <span className="ml-1 text-red-600">⚠️</span>
          )}
        </div>
        <div>
          <span className="text-blue-700 font-medium">キャッシュ効率:</span>
          <span className="ml-2 font-bold text-blue-900">
            {(cacheStats.hitRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-blue-700 font-medium">メモリ使用量:</span>
          <span className="ml-2 font-bold text-blue-900">
            {memoryUsage.percentage.toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-blue-700 font-medium">最終更新:</span>
          <span className="ml-2 font-bold text-blue-900">
            {new Date().toLocaleTimeString('ja-JP')}
          </span>
        </div>
      </div>
      
      {responseTime > 1500 && (
        <div className="mt-2 text-sm text-red-700">
          💡 パフォーマンス目標（p95≤1500ms）を超過しています。フィルタを調整するか、期間を短縮してください。
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stores, setStores] = useState<any[]>([])
  const [lastUserActivity, setLastUserActivity] = useState(Date.now())
  
  // Performance monitoring
  const { metrics, measureAsync } = usePerformanceMonitor()
  const memoryUsage = useMemoryMonitor()
  const { error, handleError, clearError, hasError } = useErrorHandler()
  
  // Default filters - current month, all stores
  const defaultFilters: DashboardFilters = useMemo(() => ({
    dateRange: {
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    },
    storeIds: undefined,
    departments: undefined,
    productCategories: undefined
  }), [])

  // Debounced filters for better performance
  const { 
    filters, 
    debouncedFilters, 
    updateFilters, 
    isDebouncing 
  } = useDebouncedFilters(defaultFilters)

  // Analytics data with caching and performance optimization
  const { 
    data: analyticsData, 
    loading: analyticsLoading, 
    error: analyticsError, 
    refresh: refreshAnalytics,
    cacheStats,
    lastFetch
  } = useAnalyticsData(debouncedFilters)

  // Auto-refresh setup (every 10 minutes)
  const { 
    isAutoRefreshEnabled, 
    lastRefresh, 
    toggleAutoRefresh,
    manualRefresh 
  } = useAutoRefresh(refreshAnalytics, 10 * 60 * 1000)

  const supabase = createClient()

  // Track user activity for session management
  useEffect(() => {
    const updateActivity = () => setLastUserActivity(Date.now())
    
    const events = ['click', 'keypress', 'scroll', 'mousemove']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
    }
  }, [])

  // Authentication setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await measureAsync(
          () => authClient.getCurrentUser(),
          'get_current_user'
        )
        setUser(currentUser)
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Auth failed'))
      } finally {
        setInitialLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const unsubscribe = authClient.onAuthStateChange((user) => {
      setUser(user)
      setInitialLoading(false)
    })

    return unsubscribe
  }, [measureAsync, handleError])

  // Load initial data
  useEffect(() => {
    if (user) {
      const loadInitialData = async () => {
        try {
          // Log dashboard view
          await logAuditEvent(
            supabase,
            'view_dashboard',
            'dashboard_main',
            { 
              filters: debouncedFilters,
              session_start: new Date().toISOString()
            },
            user.id
          )
          
          // Load stores data
          const storesData = await measureAsync(
            () => getAllStores(supabase),
            'load_stores'
          )
          setStores(storesData)
          
        } catch (error) {
          handleError(error instanceof Error ? error : new Error('Failed to load initial data'))
        }
      }

      loadInitialData()
    }
  }, [user, supabase, measureAsync, handleError, debouncedFilters])

  const handleSignOut = async () => {
    try {
      if (user) {
        await logAuditEvent(supabase, 'logout', 'dashboard', null, user.id)
      }
      await authClient.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleFiltersChange = (newFilters: DashboardFilters) => {
    clearError() // Clear any previous errors when filters change
    updateFilters(newFilters)
  }

  const handleRetry = async () => {
    clearError()
    try {
      await manualRefresh()
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Retry failed'))
    }
  }

  // Loading state for initial page load
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">ダッシュボードを初期化中...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            エラーが発生しました
          </h2>
          <p className="text-gray-700 mb-4">
            {error?.message || analyticsError || 'システムエラーが発生しました'}
          </p>
          <div className="space-x-3">
            <Button onClick={handleRetry} variant="primary">
              再試行
            </Button>
            <Button onClick={clearError} variant="outline">
              続行
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                経営戦略ダッシュボード
              </h1>
              
              {/* Auto-refresh indicator */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAutoRefresh}
                  className={`text-xs px-2 py-1 rounded ${
                    isAutoRefreshEnabled 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isAutoRefreshEnabled ? '🔄 自動更新' : '⏸️ 手動更新'}
                </button>
                
                {analyticsLoading && (
                  <div className="flex items-center text-xs text-blue-600">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                    更新中
                  </div>
                )}
                
                {isDebouncing && (
                  <div className="text-xs text-yellow-600">
                    ⏳ フィルタ適用中
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <p className="text-gray-600">ログイン中:</p>
                    <p className="font-medium text-gray-900">{user.email}</p>
                  </div>
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    size="sm"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    ログアウト
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* User Session Info */}
        {user && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-green-400 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-green-700">
                  認証済み - セッション有効時間: 30分
                </p>
              </div>
              
              <div className="text-xs text-green-600">
                最終更新: {lastRefresh.toLocaleTimeString('ja-JP')}
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Filters */}
        <Suspense fallback={<ComponentLoader>フィルタ読み込み中...</ComponentLoader>}>
          <DashboardFilters
            filters={filters}
            stores={stores}
            onFiltersChange={handleFiltersChange}
            disabled={analyticsLoading || isDebouncing}
          />
        </Suspense>

        {/* Dashboard Content */}
        {analyticsData && (
          <>
            {/* KPI Cards */}
            <Suspense fallback={<ComponentLoader>KPI読み込み中...</ComponentLoader>}>
              <KPICards 
                salesData={analyticsData.sales}
                loading={analyticsLoading}
              />
            </Suspense>

            {/* Charts and External Indicators */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Chart */}
              <Suspense fallback={<ComponentLoader>チャート読み込み中...</ComponentLoader>}>
                <SalesChart 
                  salesData={analyticsData.sales}
                  loading={analyticsLoading}
                />
              </Suspense>

              {/* External Indicators */}
              <Suspense fallback={<ComponentLoader>外部指標読み込み中...</ComponentLoader>}>
                <ExternalIndicators
                  marketData={analyticsData.marketData}
                  weatherData={analyticsData.weatherData}
                  events={analyticsData.events}
                  loading={analyticsLoading}
                />
              </Suspense>
            </div>
          </>
        )}

        {/* Performance Monitoring */}
        <PerformanceIndicator
          responseTime={metrics.responseTime}
          cacheStats={cacheStats}
          memoryUsage={memoryUsage}
        />

        {/* Debug Info (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-100 rounded-md text-xs">
            <details>
              <summary className="cursor-pointer font-medium">デバッグ情報</summary>
              <div className="mt-2 space-y-1">
                <div>キャッシュ統計: {JSON.stringify(cacheStats)}</div>
                <div>メモリ使用量: {JSON.stringify(memoryUsage)}</div>
                <div>最終フェッチ: {lastFetch}</div>
                <div>フィルタ: {JSON.stringify(debouncedFilters)}</div>
                <div>デバウンス中: {isDebouncing ? 'Yes' : 'No'}</div>
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  )
}