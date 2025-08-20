/**
 * Audit Security Panel Component
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: セキュリティ分析・異常検知・リスクアセスメント
 * Features:
 * - 異常検知・セキュリティアラート
 * - リスクスコア・脅威分析
 * - IP分析・失敗率監視
 * - セキュリティ可視化・レポート
 */

'use client'

import { useMemo } from 'react'

interface SecurityAnalysis {
  anomalies: {
    type: 'unusual_time' | 'unusual_location' | 'unusual_action' | 'high_frequency'
    actor_id: string
    description: string
    severity: 'low' | 'medium' | 'high'
    timestamp: string
  }[]
  riskScore: number
  riskFactors: string[]
  ipAnalysis: {
    ip: string
    actorCount: number
    actionCount: number
    riskLevel: 'low' | 'medium' | 'high'
  }[]
  failureRates: {
    action: string
    total: number
    failures: number
    failureRate: number
  }[]
}

interface AuditSecurityPanelProps {
  securityAnalysis: SecurityAnalysis | null
  loading: boolean
  error: string | null
}

export function AuditSecurityPanel({
  securityAnalysis,
  loading,
  error
}: AuditSecurityPanelProps) {
  // リスクレベルの色とアイコン
  const riskLevelInfo = useMemo(() => {
    if (!securityAnalysis) return { color: 'gray', icon: '❓', label: '不明', description: 'データなし' }
    
    const score = securityAnalysis.riskScore
    
    if (score >= 70) {
      return {
        color: 'red',
        icon: '🔴',
        label: '高リスク',
        description: '即座の対応が必要'
      }
    } else if (score >= 40) {
      return {
        color: 'yellow',
        icon: '🟡',
        label: '中リスク',
        description: '監視・注意が必要'
      }
    } else {
      return {
        color: 'green',
        icon: '🟢',
        label: '低リスク',
        description: '安全な状態'
      }
    }
  }, [securityAnalysis])

  // 異常レベル別の統計
  const anomalyStats = useMemo(() => {
    if (!securityAnalysis) return { high: 0, medium: 0, low: 0 }
    
    return securityAnalysis.anomalies.reduce(
      (stats, anomaly) => {
        stats[anomaly.severity]++
        return stats
      },
      { high: 0, medium: 0, low: 0 }
    )
  }, [securityAnalysis])

  if (loading) {
    return <SecurityPanelSkeleton />
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
              セキュリティ分析エラー
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!securityAnalysis) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500">セキュリティ分析データがありません</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* リスクスコア・概要 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 総合リスクスコア */}
        <div className="bg-white shadow rounded-lg p-6 lg:col-span-1">
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl ${
              riskLevelInfo.color === 'red' ? 'bg-red-100' :
              riskLevelInfo.color === 'yellow' ? 'bg-yellow-100' :
              'bg-green-100'
            }`}>
              {riskLevelInfo.icon}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-gray-900">
                {securityAnalysis.riskScore}/100
              </p>
              <p className="text-sm font-medium text-gray-600">
                {riskLevelInfo.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {riskLevelInfo.description}
              </p>
            </div>
          </div>
        </div>

        {/* 異常検知統計 */}
        <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4">異常検知サマリー</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{anomalyStats.high}</div>
              <div className="text-sm text-gray-600">高リスク</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{anomalyStats.medium}</div>
              <div className="text-sm text-gray-600">中リスク</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{anomalyStats.low}</div>
              <div className="text-sm text-gray-600">低リスク</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              総検知数: <span className="font-medium">{securityAnalysis.anomalies.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* リスク要因 */}
      {securityAnalysis.riskFactors.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">リスク要因</h3>
          <div className="space-y-2">
            {securityAnalysis.riskFactors.map((factor, index) => (
              <div key={index} className="flex items-center">
                <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">{factor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 異常検知詳細 */}
      {securityAnalysis.anomalies.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">異常検知詳細</h3>
          <div className="space-y-4">
            {securityAnalysis.anomalies.map((anomaly, index) => (
              <AnomalyCard key={index} anomaly={anomaly} />
            ))}
          </div>
        </div>
      )}

      {/* IP分析・失敗率分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IP分析 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            IP分析 (リスクレベル別)
          </h3>
          <div className="space-y-3">
            {securityAnalysis.ipAnalysis
              .filter(ip => ip.riskLevel !== 'low')
              .slice(0, 10)
              .map((ip, index) => (
                <IPAnalysisCard key={index} ipData={ip} />
              ))}
            {securityAnalysis.ipAnalysis.filter(ip => ip.riskLevel !== 'low').length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                リスクの高いIPアドレスは検出されていません
              </p>
            )}
          </div>
        </div>

        {/* 失敗率分析 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            失敗率分析 (Top 10)
          </h3>
          <div className="space-y-3">
            {securityAnalysis.failureRates
              .slice(0, 10)
              .map((failure, index) => (
                <FailureRateCard key={index} failureData={failure} />
              ))}
            {securityAnalysis.failureRates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                失敗率データがありません
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 異常検知カード
function AnomalyCard({ anomaly }: { anomaly: SecurityAnalysis['anomalies'][0] }) {
  const severityColors = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200'
  }

  const severityIcons = {
    high: '🚨',
    medium: '⚠️',
    low: 'ℹ️'
  }

  const typeLabels = {
    unusual_time: '異常時間',
    unusual_location: '異常位置',
    unusual_action: '異常行動',
    high_frequency: '高頻度'
  }

  return (
    <div className={`border rounded-lg p-4 ${severityColors[anomaly.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start">
          <span className="text-lg mr-2">{severityIcons[anomaly.severity]}</span>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">{typeLabels[anomaly.type]}</span>
              <span className="text-xs font-medium px-2 py-1 bg-white rounded">
                {anomaly.severity.toUpperCase()}
              </span>
            </div>
            <p className="text-sm mt-1">{anomaly.description}</p>
            <div className="text-xs mt-2 space-x-4">
              <span>ユーザー: {anomaly.actor_id}</span>
              <span>検知時刻: {new Date(anomaly.timestamp).toLocaleString('ja-JP')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// IP分析カード
function IPAnalysisCard({ ipData }: { ipData: SecurityAnalysis['ipAnalysis'][0] }) {
  const riskColors = {
    high: 'text-red-600 bg-red-100',
    medium: 'text-yellow-600 bg-yellow-100',
    low: 'text-green-600 bg-green-100'
  }

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div>
        <div className="font-medium text-sm">{ipData.ip}</div>
        <div className="text-xs text-gray-500">
          {ipData.actorCount}ユーザー・{ipData.actionCount}アクション
        </div>
      </div>
      <span className={`px-2 py-1 text-xs font-medium rounded ${riskColors[ipData.riskLevel]}`}>
        {ipData.riskLevel === 'high' ? '高リスク' : 
         ipData.riskLevel === 'medium' ? '中リスク' : '低リスク'}
      </span>
    </div>
  )
}

// 失敗率カード
function FailureRateCard({ failureData }: { failureData: SecurityAnalysis['failureRates'][0] }) {
  const isHighFailure = failureData.failureRate > 10

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div>
        <div className="font-medium text-sm">{failureData.action}</div>
        <div className="text-xs text-gray-500">
          {failureData.total}回中{failureData.failures}回失敗
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium ${isHighFailure ? 'text-red-600' : 'text-green-600'}`}>
          {failureData.failureRate.toFixed(1)}%
        </div>
        <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
          <div
            className={`h-2 rounded-full ${isHighFailure ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(failureData.failureRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ローディングスケルトン
function SecurityPanelSkeleton() {
  return (
    <div className="space-y-6">
      {/* リスクスコア */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="animate-pulse text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-20 mx-auto mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 lg:col-span-2">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* その他のセクション */}
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-white shadow rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
