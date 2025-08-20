/**
 * Audit Logs Table Component
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログ一覧表示・ページング・ソート
 * Features:
 * - 監査ログデータテーブル表示
 * - ソート・ページング・詳細表示
 * - レスポンシブデザイン・アクセシビリティ
 * - エラーハンドリング・ローディング状態
 */

'use client'

import { useState, useCallback } from 'react'

interface AuditLogRecord {
  id: string
  actor_id: string
  action: string
  target: string | null
  at: string
  ip: string | null
  ua: string | null
  meta: Record<string, any> | null
}

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

interface AuditLogsTableProps {
  logs: AuditLogRecord[]
  loading: boolean
  error: string | null
  totalCount: number
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
  searchParams: AuditSearchParams
  onSearchParamsChange: (params: Partial<AuditSearchParams>) => void
}

export function AuditLogsTable({
  logs,
  loading,
  error,
  totalCount,
  totalPages,
  currentPage,
  onPageChange,
  searchParams,
  onSearchParamsChange
}: AuditLogsTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // ソート処理
  const handleSort = useCallback((field: string) => {
    const newSortOrder = 
      searchParams.sortBy === field && searchParams.sortOrder === 'desc' 
        ? 'asc' 
        : 'desc'
    
    onSearchParamsChange({
      sortBy: field,
      sortOrder: newSortOrder,
      page: 1 // ソート時はページをリセット
    })
  }, [searchParams.sortBy, searchParams.sortOrder, onSearchParamsChange])

  // 詳細表示
  const handleShowDetails = useCallback((log: AuditLogRecord) => {
    setSelectedLog(log)
    setShowDetails(true)
  }, [])

  // アクションバッジの色決定
  const getActionBadgeColor = (action: string) => {
    if (action.includes('failure') || action.includes('error')) return 'red'
    if (action.includes('success')) return 'green'
    if (action.includes('start')) return 'blue'
    if (action.includes('login') || action.includes('auth')) return 'purple'
    if (action.includes('export') || action.includes('download')) return 'yellow'
    return 'gray'
  }

  // 時間フォーマット
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return {
      date: date.toLocaleDateString('ja-JP'),
      time: date.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
    }
  }

  // ローディング状態
  if (loading) {
    return <AuditTableSkeleton />
  }

  // エラー状態
  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                監査ログ取得エラー
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // データがない場合
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">監査ログがありません</h3>
          <p className="mt-1 text-sm text-gray-500">
            指定された条件に一致する監査ログが見つかりません。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* ヘッダー */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            監査ログ一覧
          </h3>
          <div className="text-sm text-gray-500">
            {totalCount.toLocaleString()}件中 {((currentPage - 1) * (searchParams.limit || 50) + 1).toLocaleString()}-{Math.min(currentPage * (searchParams.limit || 50), totalCount).toLocaleString()}件を表示
          </div>
        </div>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader
                label="時刻"
                field="at"
                currentSort={searchParams.sortBy}
                currentOrder={searchParams.sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="ユーザー"
                field="actor_id"
                currentSort={searchParams.sortBy}
                currentOrder={searchParams.sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="アクション"
                field="action"
                currentSort={searchParams.sortBy}
                currentOrder={searchParams.sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="ターゲット"
                field="target"
                currentSort={searchParams.sortBy}
                currentOrder={searchParams.sortOrder}
                onSort={handleSort}
              />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IPアドレス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                詳細
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log, index) => {
              const { date, time } = formatDateTime(log.at)
              return (
                <tr key={log.id || index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{time}</div>
                      <div className="text-gray-500">{date}</div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700">
                            {log.actor_id.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="font-medium">{log.actor_id}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ActionBadge action={log.action} color={getActionBadgeColor(log.action)} />
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.target || '-'}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ip || '-'}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleShowDetails(log)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ページング */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}

      {/* 詳細モーダル */}
      {showDetails && selectedLog && (
        <AuditLogDetailModal
          log={selectedLog}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  )
}

// ソート可能ヘッダー
function SortableHeader({
  label,
  field,
  currentSort,
  currentOrder,
  onSort
}: {
  label: string
  field: string
  currentSort?: string
  currentOrder?: string
  onSort: (field: string) => void
}) {
  const isActive = currentSort === field
  
  return (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      <button
        onClick={() => onSort(field)}
        className="flex items-center space-x-1 hover:text-gray-700"
      >
        <span>{label}</span>
        <div className="flex flex-col">
          <svg
            className={`w-3 h-3 ${isActive && currentOrder === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 4.414 6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <svg
            className={`w-3 h-3 -mt-1 ${isActive && currentOrder === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 15.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
    </th>
  )
}

// アクションバッジ
function ActionBadge({ action, color }: { action: string; color: string }) {
  const colorClasses = {
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    gray: 'bg-gray-100 text-gray-800'
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClasses[color] || colorClasses.gray}`}>
      {action}
    </span>
  )
}

// ページング
function Pagination({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const pages = []
  const maxVisiblePages = 7
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          前へ
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              1
            </button>
            {startPage > 2 && <span className="text-gray-500">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 text-sm border rounded-md ${
              page === currentPage
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="text-gray-500">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              {totalPages}
            </button>
          </>
        )}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          次へ
        </button>
      </div>
      
      <div className="text-sm text-gray-500">
        {totalPages}ページ中{currentPage}ページ
      </div>
    </div>
  )
}

// 詳細モーダル
function AuditLogDetailModal({
  log,
  onClose
}: {
  log: AuditLogRecord
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-start">
              <div className="w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  監査ログ詳細
                </h3>
                
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">タイムスタンプ</dt>
                    <dd className="text-sm text-gray-900">{new Date(log.at).toLocaleString('ja-JP')}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ユーザー</dt>
                    <dd className="text-sm text-gray-900">{log.actor_id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">アクション</dt>
                    <dd className="text-sm text-gray-900">{log.action}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">ターゲット</dt>
                    <dd className="text-sm text-gray-900">{log.target || 'なし'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">IPアドレス</dt>
                    <dd className="text-sm text-gray-900">{log.ip || 'なし'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">User Agent</dt>
                    <dd className="text-sm text-gray-900 break-all">{log.ua || 'なし'}</dd>
                  </div>
                  {log.meta && Object.keys(log.meta).length > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">メタデータ</dt>
                      <dd className="text-sm text-gray-900">
                        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.meta, null, 2)}
                        </pre>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ローディングスケルトン
function AuditTableSkeleton() {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="animate-pulse h-6 bg-gray-200 rounded w-1/4"></div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: 6 }).map((_, index) => (
                <th key={index} className="px-6 py-3">
                  <div className="animate-pulse h-4 bg-gray-200 rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: 6 }).map((_, colIndex) => (
                  <td key={colIndex} className="px-6 py-4">
                    <div className="animate-pulse h-4 bg-gray-200 rounded"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
