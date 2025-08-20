/**
 * Audit Metrics Cards Component
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログメトリクス・KPI表示カード
 * Features:
 * - 基本統計・ユーザー活動・セキュリティメトリクス
 * - 時系列チャート・パフォーマンス指標
 * - レスポンシブデザイン・詳細表示モード
 * - リアルタイム更新・エラーハンドリング
 */

'use client'

import { useMemo } from 'react'

interface AuditMetrics {
  totalLogs: number
  uniqueUsers: number
  uniqueActions: number
  actionsOverTime: { date: string; count: number }[]
  actionsPerHour: { hour: number; count: number }[]
  topUsers: { user: string; count: number }[]
  topActions: { action: string; count: number }[]
  failedActions: number
  suspiciousActivity: number
  uniqueIPs: number
  averageResponseTime: number
  p95ResponseTime: number
  slaCompliance: number
}

interface AuditMetricsCardsProps {
  metrics: AuditMetrics | null
  loading: boolean
  error: string | null
  detailed?: boolean
}

export function AuditMetricsCards({
  metrics,
  loading,
  error,
  detailed = false
}: AuditMetricsCardsProps) {
  // 基本メトリクスカード計算
  const basicMetrics = useMemo(() => {
    if (!metrics) return []

    return [
      {
        title: '総ログ数',
        value: metrics.totalLogs.toLocaleString(),
        change: null,
        icon: '📋',
        color: 'blue'
      },
      {
        title: '活動ユーザー数',
        value: metrics.uniqueUsers.toLocaleString(),
        change: null,
        icon: '👥',
        color: 'green'
      },
      {
        title: 'アクション種類',
        value: metrics.uniqueActions.toLocaleString(),
        change: null,
        icon: '⚡',
        color: 'purple'
      },
      {
        title: '失敗率',
        value: metrics.totalLogs > 0 ? 
          `${((metrics.failedActions / metrics.totalLogs) * 100).toFixed(1)}%` : 
          '0%',
        change: null,
        icon: '⚠️',
        color: metrics.failedActions > 0 ? 'red' : 'green'
      }
    ]
  }, [metrics])

  // パフォーマンスメトリクス
  const performanceMetrics = useMemo(() => {
    if (!metrics) return []

    return [
      {
        title: '平均応答時間',
        value: `${metrics.averageResponseTime.toFixed(0)}ms`,
        change: null,
        icon: '⏱️',
        color: metrics.averageResponseTime > 5000 ? 'red' : 'green'
      },
      {
        title: 'P95応答時間',
        value: `${metrics.p95ResponseTime.toFixed(0)}ms`,
        change: null,
        icon: '📊',
        color: metrics.p95ResponseTime > 5000 ? 'red' : 'green'
      },
      {
        title: 'SLA準拠率',
        value: `${metrics.slaCompliance.toFixed(1)}%`,
        change: null,
        icon: '✅',
        color: metrics.slaCompliance >= 95 ? 'green' : metrics.slaCompliance >= 90 ? 'yellow' : 'red'
      },
      {
        title: '異常活動',
        value: metrics.suspiciousActivity.toLocaleString(),
        change: null,
        icon: '🔍',
        color: metrics.suspiciousActivity > 0 ? 'red' : 'green'
      }
    ]
  }, [metrics])

  // セキュリティメトリクス
  const securityMetrics = useMemo(() => {
    if (!metrics) return []

    return [
      {
        title: '失敗操作数',
        value: metrics.failedActions.toLocaleString(),
        change: null,
        icon: '❌',
        color: metrics.failedActions > 0 ? 'red' : 'green'
      },
      {
        title: '異常活動検知',
        value: metrics.suspiciousActivity.toLocaleString(),
        change: null,
        icon: '🚨',
        color: metrics.suspiciousActivity > 0 ? 'red' : 'green'
      },
      {
        title: 'ユニークIP数',
        value: metrics.uniqueIPs.toLocaleString(),
        change: null,
        icon: '🌐',
        color: 'blue'
      },
      {
        title: 'リスクレベル',
        value: calculateRiskLevel(metrics),
        change: null,
        icon: getRiskIcon(metrics),
        color: getRiskColor(metrics)
      }
    ]
  }, [metrics])

  if (loading) {
    return <MetricsCardsSkeleton detailed={detailed} />
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              メトリクス取得エラー
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">データがありません</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 基本メトリクス */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">基本統計</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {basicMetrics.map((metric, index) => (
            <MetricCard key={index} metric={metric} />
          ))}
        </div>
      </div>

      {/* 詳細表示モード */}
      {detailed && (
        <>
          {/* パフォーマンスメトリクス */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">パフォーマンス</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {performanceMetrics.map((metric, index) => (
                <MetricCard key={index} metric={metric} />
              ))}
            </div>
          </div>

          {/* セキュリティメトリクス */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">セキュリティ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {securityMetrics.map((metric, index) => (
                <MetricCard key={index} metric={metric} />
              ))}
            </div>
          </div>

          {/* トップユーザー・アクション */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* トップユーザー */}
            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                アクティブユーザー (Top 10)
              </h4>
              <div className="space-y-3">
                {metrics.topUsers.slice(0, 10).map((user, index) => (
                  <div key={user.user} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-6">
                        {index + 1}.
                      </span>
                      <span className="text-sm text-gray-900 ml-2 truncate">
                        {user.user}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-blue-600">
                      {user.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* トップアクション */}
            <div className="bg-white shadow rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                頻繁なアクション (Top 10)
              </h4>
              <div className="space-y-3">
                {metrics.topActions.slice(0, 10).map((action, index) => (
                  <div key={action.action} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-6">
                        {index + 1}.
                      </span>
                      <span className="text-sm text-gray-900 ml-2 truncate">
                        {action.action}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-green-600">
                      {action.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 時系列チャート */}
          <div className="bg-white shadow rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              アクティビティ推移
            </h4>
            <SimpleTimeChart data={metrics.actionsOverTime} />
          </div>

          {/* 時間別分布 */}
          <div className="bg-white shadow rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              時間別アクティビティ
            </h4>
            <SimpleHourChart data={metrics.actionsPerHour} />
          </div>
        </>
      )}
    </div>
  )
}

// メトリクスカードコンポーネント
function MetricCard({ metric }: { metric: any }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600'
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${colorClasses[metric.color] || colorClasses.blue}`}>
              <span className="text-lg">{metric.icon}</span>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {metric.title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {metric.value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

// ローディングスケルトン
function MetricsCardsSkeleton({ detailed = false }: { detailed?: boolean }) {
  const skeletonCards = detailed ? 12 : 4

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: skeletonCards }).map((_, index) => (
          <div key={index} className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="animate-pulse flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 簡易時系列チャート
function SimpleTimeChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count))
  
  return (
    <div className="mt-4">
      <div className="flex items-end space-x-1 h-32">
        {data.slice(-14).map((item, index) => (
          <div key={item.date} className="flex-1 flex flex-col justify-end">
            <div
              className="bg-blue-500 rounded-t"
              style={{
                height: `${maxCount > 0 ? (item.count / maxCount) * 120 : 0}px`,
                minHeight: item.count > 0 ? '2px' : '0px'
              }}
              title={`${item.date}: ${item.count}件`}
            />
            <div className="text-xs text-gray-500 mt-1 text-center">
              {item.date.split('-')[2]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 簡易時間別チャート
function SimpleHourChart({ data }: { data: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count))
  
  return (
    <div className="mt-4">
      <div className="flex items-end space-x-1 h-24">
        {data.map((item) => (
          <div key={item.hour} className="flex-1 flex flex-col justify-end">
            <div
              className="bg-green-500 rounded-t"
              style={{
                height: `${maxCount > 0 ? (item.count / maxCount) * 80 : 0}px`,
                minHeight: item.count > 0 ? '2px' : '0px'
              }}
              title={`${item.hour}時: ${item.count}件`}
            />
            <div className="text-xs text-gray-500 mt-1 text-center">
              {item.hour}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ヘルパー関数
function calculateRiskLevel(metrics: AuditMetrics): string {
  const failureRate = metrics.totalLogs > 0 ? (metrics.failedActions / metrics.totalLogs) * 100 : 0
  const suspiciousRate = metrics.totalLogs > 0 ? (metrics.suspiciousActivity / metrics.totalLogs) * 100 : 0
  
  if (failureRate > 5 || suspiciousRate > 2) return '高'
  if (failureRate > 2 || suspiciousRate > 1) return '中'
  return '低'
}

function getRiskIcon(metrics: AuditMetrics): string {
  const level = calculateRiskLevel(metrics)
  switch (level) {
    case '高': return '🔴'
    case '中': return '🟡'
    default: return '🟢'
  }
}

function getRiskColor(metrics: AuditMetrics): string {
  const level = calculateRiskLevel(metrics)
  switch (level) {
    case '高': return 'red'
    case '中': return 'yellow'
    default: return 'green'
  }
}
