/**
 * Audit Logs Container Component
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログ検索・フィルタ・表示の統合コンテナ
 * Features:
 * - 監査ログ検索・フィルタリング
 * - メトリクス・セキュリティ分析表示
 * - エクスポート・コンプライアンス機能
 * - リアルタイム更新・パフォーマンス監視
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { AuditSearchFilters } from './AuditSearchFilters'
import { AuditMetricsCards } from './AuditMetricsCards'
import { AuditLogsTable } from './AuditLogsTable'
import { AuditSecurityPanel } from './AuditSecurityPanel'
import { AuditExportModal } from './AuditExportModal'
import { useAuditLogs } from '@/hooks/useAuditLogs'
import { useAuditMetrics } from '@/hooks/useAuditMetrics'
import { useAuditSecurity } from '@/hooks/useAuditSecurity'

interface AuditSearchParams {
  startDate?: string
  endDate?: string
  actorIds?: string[]
  actions?: string[]
  targets?: string[]
  searchTerm?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  ipAddresses?: string[]
  hasErrors?: boolean
}

export function AuditLogsContainer() {
  // 検索・フィルタ状態
  const [searchParams, setSearchParams] = useState<AuditSearchParams>({
    page: 1,
    limit: 50,
    sortBy: 'at',
    sortOrder: 'desc',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 過去7日
    endDate: new Date().toISOString().split('T')[0] // 今日
  })
  
  // UI状態
  const [selectedTab, setSelectedTab] = useState<'logs' | 'metrics' | 'security'>('logs')
  const [showExportModal, setShowExportModal] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null)
  
  // カスタムフック
  const {
    logs,
    loading: logsLoading,
    error: logsError,
    totalCount,
    totalPages,
    currentPage,
    executionTime,
    refetch: refetchLogs
  } = useAuditLogs(searchParams)
  
  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useAuditMetrics({
    startDate: searchParams.startDate,
    endDate: searchParams.endDate
  })
  
  const {
    securityAnalysis,
    loading: securityLoading,
    error: securityError,
    refetch: refetchSecurity
  } = useAuditSecurity({
    startDate: searchParams.startDate,
    endDate: searchParams.endDate
  })
  
  // 自動リフレッシュ設定
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(() => {
        refetchLogs()
        refetchMetrics()
        refetchSecurity()
      }, refreshInterval * 1000)
      
      return () => clearInterval(interval)
    }
  }, [refreshInterval, refetchLogs, refetchMetrics, refetchSecurity])
  
  // 検索パラメータ更新
  const handleSearchParamsChange = useCallback((newParams: Partial<AuditSearchParams>) => {
    setSearchParams(prev => ({
      ...prev,
      ...newParams,
      page: newParams.page || 1 // ページ番号リセット（ページ変更以外）
    }))
  }, [])
  
  // ページ変更
  const handlePageChange = useCallback((page: number) => {
    setSearchParams(prev => ({ ...prev, page }))
  }, [])
  
  // エクスポート実行
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    try {
      const response = await fetch('/api/audit/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...searchParams,
          format
        })
      })
      
      if (!response.ok) {
        throw new Error('エクスポートに失敗しました')
      }
      
      // ファイルダウンロード
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setShowExportModal(false)
    } catch (error) {
      console.error('Export failed:', error)
      alert('エクスポートに失敗しました')
    }
  }, [searchParams])
  
  // コンプライアンスレポート生成
  const handleComplianceReport = useCallback(async () => {
    try {
      const response = await fetch(`/api/audit/compliance?startDate=${searchParams.startDate}&endDate=${searchParams.endDate}`)
      
      if (!response.ok) {
        throw new Error('コンプライアンスレポート生成に失敗しました')
      }
      
      const result = await response.json()
      
      // 結果を新しいウィンドウで表示
      const reportWindow = window.open('', '_blank')
      if (reportWindow) {
        reportWindow.document.write(`
          <html>
            <head>
              <title>コンプライアンスレポート</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                .section { margin-bottom: 20px; }
                .status-compliant { color: green; font-weight: bold; }
                .status-attention { color: red; font-weight: bold; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>コンプライアンスレポート</h1>
                <p>期間: ${searchParams.startDate} 〜 ${searchParams.endDate}</p>
                <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
              </div>
              <div class="section">
                <h2>サマリー</h2>
                <p>総イベント数: ${result.data.summary.totalEvents}</p>
                <p>コンプライアンス状況: <span class="${result.data.summary.complianceStatus === 'COMPLIANT' ? 'status-compliant' : 'status-attention'}">${result.data.summary.complianceStatus}</span></p>
                <p>セキュリティイベント: ${result.data.summary.securityEventCount}</p>
              </div>
              <pre>${JSON.stringify(result.data, null, 2)}</pre>
            </body>
          </html>
        `)
        reportWindow.document.close()
      }
    } catch (error) {
      console.error('Compliance report failed:', error)
      alert('コンプライアンスレポート生成に失敗しました')
    }
  }, [searchParams.startDate, searchParams.endDate])
  
  return (
    <div className=\"space-y-6\">
      {/* タブナビゲーション */}
      <div className=\"border-b border-gray-200\">
        <nav className=\"-mb-px flex space-x-8\">
          {[
            { key: 'logs', label: '監査ログ', icon: '📋' },
            { key: 'metrics', label: 'メトリクス', icon: '📊' },
            { key: 'security', label: 'セキュリティ', icon: '🔒' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className=\"mr-2\">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* 共通フィルター */}
      <AuditSearchFilters
        searchParams={searchParams}
        onSearchParamsChange={handleSearchParamsChange}
        onExport={() => setShowExportModal(true)}
        onComplianceReport={handleComplianceReport}
        loading={logsLoading}
      />
      
      {/* リフレッシュ設定 */}
      <div className=\"flex items-center justify-between bg-gray-50 p-4 rounded-lg\">
        <div className=\"flex items-center space-x-4\">
          <span className=\"text-sm text-gray-600\">自動リフレッシュ:</span>
          <select
            value={refreshInterval || ''}
            onChange={(e) => setRefreshInterval(e.target.value ? parseInt(e.target.value) : null)}
            className=\"text-sm border-gray-300 rounded-md\"
          >
            <option value=\"\">無効</option>
            <option value=\"30\">30秒</option>
            <option value=\"60\">1分</option>
            <option value=\"300\">5分</option>
          </select>
        </div>
        
        <div className=\"flex items-center space-x-2 text-sm text-gray-600\">
          {executionTime && (
            <span>検索時間: {executionTime}ms</span>
          )}
          <button
            onClick={() => {
              refetchLogs()
              refetchMetrics()
              refetchSecurity()
            }}
            className=\"flex items-center px-2 py-1 text-blue-600 hover:text-blue-800\"
            disabled={logsLoading}
          >
            <svg
              className={`w-4 h-4 mr-1 ${logsLoading ? 'animate-spin' : ''}`}
              fill=\"none\"
              stroke=\"currentColor\"
              viewBox=\"0 0 24 24\"
            >
              <path
                strokeLinecap=\"round\"
                strokeLinejoin=\"round\"
                strokeWidth={2}
                d=\"M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15\"
              />
            </svg>
            更新
          </button>
        </div>
      </div>
      
      {/* タブコンテンツ */}
      {selectedTab === 'logs' && (
        <div className=\"space-y-6\">
          {/* メトリクスカード */}
          <AuditMetricsCards
            metrics={metrics}
            loading={metricsLoading}
            error={metricsError}
          />
          
          {/* 監査ログテーブル */}
          <AuditLogsTable
            logs={logs}
            loading={logsLoading}
            error={logsError}
            totalCount={totalCount}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            searchParams={searchParams}
            onSearchParamsChange={handleSearchParamsChange}
          />
        </div>
      )}
      
      {selectedTab === 'metrics' && (
        <AuditMetricsCards
          metrics={metrics}
          loading={metricsLoading}
          error={metricsError}
          detailed={true}
        />
      )}
      
      {selectedTab === 'security' && (
        <AuditSecurityPanel
          securityAnalysis={securityAnalysis}
          loading={securityLoading}
          error={securityError}
        />
      )}
      
      {/* エクスポートモーダル */}
      {showExportModal && (
        <AuditExportModal
          onExport={handleExport}
          onClose={() => setShowExportModal(false)}
          searchParams={searchParams}
        />
      )}
    </div>
  )
}
