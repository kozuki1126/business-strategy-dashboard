'use client';

import { useState, useEffect } from 'react';
import { useRequireAuth, useAuth } from '@/contexts/AuthContext';
import { getUserDisplayName } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { 
  useSalesData, 
  useExternalData, 
  useDashboardFilters, 
  useDataRefresh,
  useFormatCurrency,
  useFormatNumber,
  useFormatPercentage
} from '@/hooks/useApi';
import {
  SalesChart,
  StorePerformanceChart,
  MarketIndexChart,
  FxRateChart,
  DepartmentPieChart,
  ChartSkeleton,
  ChartError
} from '@/components/charts/Charts';
import { RefreshCw, TrendingUp, TrendingDown, Users, DollarSign } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading, isAuthenticated } = useRequireAuth();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Dashboard state management
  const { period, setPeriod, storeId, setStoreId, dateRange, setDateRange } = useDashboardFilters();
  const { lastRefresh, isRefreshing, refresh } = useDataRefresh();
  
  // Data fetching
  const salesData = useSalesData(period, storeId, { autoRefresh: true });
  const externalData = useExternalData(dateRange, undefined, { autoRefresh: true });
  
  // Formatting utilities
  const formatCurrency = useFormatCurrency();
  const formatNumber = useFormatNumber();
  const formatPercentage = useFormatPercentage();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      console.error('Unexpected sign out error:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleRefreshAll = async () => {
    await refresh([salesData.refetch, externalData.refetch]);
  };

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, the useRequireAuth hook will redirect
  if (!isAuthenticated) {
    return null;
  }

  const kpis = salesData.data?.kpis;
  const trends = salesData.data?.trends || [];
  const stores = salesData.data?.stores || [];
  const departments = salesData.data?.departments || [];
  
  const marketIndices = externalData.data?.market_indices || [];
  const fxRates = externalData.data?.fx_rates || [];
  const weather = externalData.data?.weather?.[0]; // Latest weather
  const events = externalData.data?.events?.slice(0, 3) || []; // Recent events

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              経営戦略ダッシュボード
            </h1>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>更新</span>
              </Button>
              
              <div className="text-sm text-gray-600">
                <span className="font-medium">{getUserDisplayName(user)}</span>
                <span className="text-gray-400 ml-2">でログイン中</span>
              </div>
              
              <Button
                onClick={handleSignOut}
                disabled={isSigningOut}
                variant="outline"
                size="sm"
              >
                {isSigningOut ? 'ログアウト中...' : 'ログアウト'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div>
            <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">
              期間
            </label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input"
            >
              <option value="current-month">当月</option>
              <option value="last-month">前月</option>
              <option value="current-year">当年</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="store" className="block text-sm font-medium text-gray-700 mb-1">
              店舗
            </label>
            <select
              id="store"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="input"
            >
              <option value="all">全店舗</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700 mb-1">
              外部データ期間
            </label>
            <select
              id="dateRange"
              value={dateRange}
              onChange={(e) => setDateRange(parseInt(e.target.value))}
              className="input"
            >
              <option value={7}>過去7日</option>
              <option value={30}>過去30日</option>
              <option value={90}>過去90日</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">売上（税抜）</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {salesData.loading ? '...' : kpis ? formatCurrency(kpis.totalRevenue) : '¥0'}
                </p>
                {kpis && (
                  <div className={`flex items-center text-sm ${kpis.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {formatPercentage(Math.abs(kpis.revenueGrowth))} vs 前期
                  </div>
                )}
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">客数</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {salesData.loading ? '...' : kpis ? formatNumber(kpis.totalFootfall) : '0'}
                </p>
                {kpis && (
                  <div className={`flex items-center text-sm ${kpis.footfallGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.footfallGrowth >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {formatPercentage(Math.abs(kpis.footfallGrowth))} vs 前期
                  </div>
                )}
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">客単価</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {salesData.loading ? '...' : kpis ? formatCurrency(kpis.averageOrderValue) : '¥0'}
                </p>
                {kpis && (
                  <div className={`flex items-center text-sm ${kpis.aovGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpis.aovGrowth >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {formatPercentage(Math.abs(kpis.aovGrowth))} vs 前期
                  </div>
                )}
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">取引数</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {salesData.loading ? '...' : kpis ? formatNumber(kpis.totalTransactions) : '0'}
                </p>
                <p className="text-sm text-gray-500">総取引件数</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600 font-bold text-sm">Tx</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">売上推移</h3>
            {salesData.loading ? (
              <ChartSkeleton height={400} />
            ) : salesData.error ? (
              <ChartError error={salesData.error} onRetry={salesData.refetch} />
            ) : (
              <SalesChart data={trends} height={400} />
            )}
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">店舗別売上</h3>
            {salesData.loading ? (
              <ChartSkeleton height={400} />
            ) : salesData.error ? (
              <ChartError error={salesData.error} onRetry={salesData.refetch} />
            ) : (
              <StorePerformanceChart data={stores} height={400} />
            )}
          </div>
        </div>

        {/* External Data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">市場指数</h3>
            {externalData.loading ? (
              <ChartSkeleton height={300} />
            ) : externalData.error ? (
              <ChartError error={externalData.error} onRetry={externalData.refetch} />
            ) : (
              <MarketIndexChart data={marketIndices} height={300} />
            )}
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">為替レート</h3>
            {externalData.loading ? (
              <ChartSkeleton height={300} />
            ) : externalData.error ? (
              <ChartError error={externalData.error} onRetry={externalData.refetch} />
            ) : (
              <FxRateChart data={fxRates} height={300} />
            )}
          </div>
        </div>

        {/* Department Performance & External Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">部門別売上</h3>
            {salesData.loading ? (
              <ChartSkeleton height={300} />
            ) : salesData.error ? (
              <ChartError error={salesData.error} onRetry={salesData.refetch} />
            ) : (
              <DepartmentPieChart data={departments} height={300} />
            )}
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">外部情報</h3>
            <div className="space-y-4">
              {/* Weather */}
              {weather && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900">天候 ({weather.location})</h4>
                  <p className="text-sm text-blue-700">
                    {weather.weather_condition} | 
                    最高 {weather.temperature_high}°C / 最低 {weather.temperature_low}°C
                  </p>
                </div>
              )}

              {/* Recent Events */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">最近のイベント</h4>
                <div className="space-y-2">
                  {events.map((event, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="font-medium">{event.event_name}</div>
                      <div className="text-gray-600">{event.date} | {event.location}</div>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <p className="text-gray-500 text-sm">イベント情報がありません</p>
                  )}
                </div>
              </div>

              {/* Latest updates */}
              <div className="text-xs text-gray-500 pt-2 border-t">
                最終更新: {lastRefresh ? lastRefresh.toLocaleString('ja-JP') : '未更新'}
              </div>
            </div>
          </div>
        </div>

        {/* Status Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>リアルタイムデータ連携中</span>
            <span>•</span>
            <span>自動更新: 5分間隔</span>
          </div>
        </div>
      </main>
    </div>
  );
}
