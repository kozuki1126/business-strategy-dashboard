/**
 * Audit Logs Dashboard Page
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログ・検索・分析・可視化ダッシュボード
 * Features:
 * - リアルタイム監査ログ検索・フィルタ
 * - セキュリティ分析・メトリクス表示
 * - エクスポート・コンプライアンスレポート
 * - レスポンシブデザイン・アクセシビリティ対応
 */

import { Suspense } from 'react'
import { AuditLogsContainer } from '@/components/audit/AuditLogsContainer'
import { getCurrentUser } from '@/lib/auth'
import { AuditService } from '@/lib/services/audit'
import { redirect } from 'next/navigation'

export default async function AuditLogsPage() {
  // 認証チェック
  const user = await getCurrentUser()
  if (!user) {
    redirect('/auth')
  }
  
  // ページアクセス記録
  await AuditService.logDashboardAccess(user.id, {
    page: 'audit_logs',
    section: 'full_audit_dashboard'
  })
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ページヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                監査ログ管理
              </h1>
              <p className="mt-2 text-gray-600">
                システム操作・セキュリティ監査・コンプライアンス管理
              </p>
            </div>
            
            {/* クイックアクション */}
            <div className="flex space-x-3">
              <button
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="セキュリティ分析"
              >
                <svg
                  className="-ml-0.5 mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                セキュリティ分析
              </button>
              
              <button
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="コンプライアンスレポート"
              >
                <svg
                  className="-ml-0.5 mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                レポート生成
              </button>
            </div>
          </div>
        </div>
        
        {/* メインコンテンツ */}
        <Suspense fallback={<AuditLoadingSkeleton />}>
          <AuditLogsContainer />
        </Suspense>
      </div>
    </div>
  )
}

// ローディングスケルトン
function AuditLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* フィルターセクション */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* メトリクスセクション */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* テーブルセクション */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// メタデータ
export const metadata = {
  title: '監査ログ管理 | 経営戦略ダッシュボード',
  description: 'システム操作の監査ログ・セキュリティ分析・コンプライアンス管理ダッシュボード'
}
