/**
 * SLO Performance Monitoring Page
 * Task #014: 性能・p95最適化実装 - ページ統合
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { SLOMonitoringDashboard } from '@/components/monitoring/SLOMonitoringDashboard'
import { Navigation, QuickActions } from '@/components/navigation/Navigation'

export const metadata: Metadata = {
  title: 'SLO監視 - 経営戦略ダッシュボード',
  description: '99.5%可用性・p95≤1500ms目標のリアルタイムSLO監視・負荷テスト実行・パフォーマンス分析',
  keywords: ['SLO', 'パフォーマンス監視', '負荷テスト', '可用性', '応答時間'],
}

export default function SLOMonitoringPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                SLO パフォーマンス監視
              </h1>
              
              {/* 監視状況インジケーター */}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600">監視中</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Quick Actions */}
              <QuickActions className="hidden sm:flex" />
            </div>
          </div>
          
          {/* Navigation */}
          <div className="mt-4 border-t pt-4">
            <Navigation />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Page Info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm text-blue-700">
                <strong>SLO目標:</strong> 99.5%可用性 / P95≤1500ms / 100CCU負荷対応 / エラー率≤1%
              </p>
              <p className="text-xs text-blue-600 mt-1">
                リアルタイム監視・負荷テスト・パフォーマンス分析を提供します
              </p>
            </div>
          </div>
        </div>

        {/* SLO Dashboard */}
        <Suspense fallback={
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        }>
          <SLOMonitoringDashboard />
        </Suspense>
      </main>
    </div>
  )
}
