'use client'

import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { 
  getSalesData, 
  getMarketData, 
  getFXRates, 
  getWeatherData,
  getAllStores,
  getAnalyticsData,
  logAuditEvent
} from '@/lib/database/helpers'
import { DashboardFilters, SalesWithCalculated, AnalyticsData } from '@/types/database.types'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { ExternalIndicators } from '@/components/dashboard/ExternalIndicators'
import { KPICards } from '@/components/dashboard/KPICards'
import { DashboardFilters as FilterComponent } from '@/components/dashboard/DashboardFilters'
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [stores, setStores] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // Default filters - current month, all stores
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: {
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    },
    storeIds: undefined,
    departments: undefined,
    productCategories: undefined
  })

  const supabase = createClient()

  useEffect(() => {
    // Get current user
    authClient.getCurrentUser().then((currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    // Listen for auth changes
    const unsubscribe = authClient.onAuthStateChange((user) => {
      setUser(user)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (user) {
      // Log dashboard view
      logAuditEvent(
        supabase,
        'view_dashboard',
        'dashboard_main',
        { filters },
        user.id
      )
      
      loadInitialData()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadAnalyticsData()
    }
  }, [filters, user])

  const loadInitialData = async () => {
    try {
      const [storesData] = await Promise.all([
        getAllStores(supabase)
      ])
      
      setStores(storesData)
    } catch (error) {
      console.error('Failed to load initial data:', error)
      setError('初期データの読み込みに失敗しました')
    }
  }

  const loadAnalyticsData = async () => {
    if (!user) return
    
    setLoading(true)
    setError(null)
    
    try {
      const startTime = performance.now()
      
      // Load analytics data with current filters
      const data = await getAnalyticsData(supabase, filters)
      setAnalyticsData(data)
      
      const endTime = performance.now()
      const responseTime = endTime - startTime
      
      // Log performance metrics
      console.log(`Dashboard data loaded in ${responseTime.toFixed(2)}ms`)
      
      // Performance warning if over 1500ms (p95 target)
      if (responseTime > 1500) {
        console.warn(`Dashboard performance below target: ${responseTime.toFixed(2)}ms > 1500ms`)
      }
      
    } catch (error) {
      console.error('Failed to load analytics data:', error)
      setError('データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

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
    setFilters(newFilters)
  }

  if (loading && !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">ダッシュボードを読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button onClick={() => loadAnalyticsData()} variant="outline">
            再読み込み
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              経営戦略ダッシュボード
            </h1>
            
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
              {loading && (
                <div className="ml-auto flex items-center text-sm text-green-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                  データ更新中...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard Filters */}
        <FilterComponent
          filters={filters}
          stores={stores}
          onFiltersChange={handleFiltersChange}
          disabled={loading}
        />

        {analyticsData && (
          <>
            {/* KPI Cards */}
            <KPICards 
              salesData={analyticsData.sales}
              loading={loading}
            />

            {/* Charts and External Indicators */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Chart */}
              <SalesChart 
                salesData={analyticsData.sales}
                loading={loading}
              />

              {/* External Indicators */}
              <ExternalIndicators
                marketData={analyticsData.marketData}
                weatherData={analyticsData.weatherData}
                events={analyticsData.events}
                loading={loading}
              />
            </div>
          </>
        )}

        {/* Performance Note */}
        <div className="mt-8 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            💡 パフォーマンス目標: 応答時間 p95 ≤ 1500ms | 
            最終更新: {analyticsData ? new Date().toLocaleString('ja-JP') : '未取得'}
          </p>
        </div>
      </main>
    </div>
  )
}