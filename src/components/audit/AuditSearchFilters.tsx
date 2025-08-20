/**
 * Audit Search Filters Component
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログ検索・フィルタリングフォーム
 * Features:
 * - 期間・ユーザー・アクション・ターゲットフィルタ
 * - キーワード検索・高度なフィルタオプション
 * - エクスポート・コンプライアンス機能
 * - リアルタイムバリデーション・UX最適化
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

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

interface AuditSearchFiltersProps {
  searchParams: AuditSearchParams
  onSearchParamsChange: (params: Partial<AuditSearchParams>) => void
  onExport: () => void
  onComplianceReport: () => void
  loading?: boolean
}

export function AuditSearchFilters({
  searchParams,
  onSearchParamsChange,
  onExport,
  onComplianceReport,
  loading = false
}: AuditSearchFiltersProps) {
  const [localParams, setLocalParams] = useState(searchParams)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // プリセット期間
  const presetRanges = [
    { label: '過去1時間', hours: 1 },
    { label: '過去24時間', hours: 24 },
    { label: '過去7日', days: 7 },
    { label: '過去30日', days: 30 },
    { label: '過去90日', days: 90 }
  ]

  // フィルタ適用（デバウンス）
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (JSON.stringify(localParams) !== JSON.stringify(searchParams)) {
        onSearchParamsChange(localParams)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [localParams, searchParams, onSearchParamsChange])

  // プリセット期間設定
  const handlePresetRange = useCallback((preset: typeof presetRanges[0]) => {
    const endDate = new Date()
    const startDate = new Date()
    
    if (preset.hours) {
      startDate.setHours(startDate.getHours() - preset.hours)
    } else if (preset.days) {
      startDate.setDate(startDate.getDate() - preset.days)
    }

    const newParams = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
    
    setLocalParams(prev => ({ ...prev, ...newParams }))
  }, [])

  // フォーム項目更新
  const handleInputChange = useCallback((field: keyof AuditSearchParams, value: any) => {
    setLocalParams(prev => ({ ...prev, [field]: value }))
  }, [])

  // 配列フィールド更新
  const handleArrayChange = useCallback((field: keyof AuditSearchParams, value: string) => {
    const values = value.split(',').map(v => v.trim()).filter(v => v)
    setLocalParams(prev => ({ ...prev, [field]: values }))
  }, [])

  // リセット
  const handleReset = useCallback(() => {
    const resetParams = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      actorIds: [],
      actions: [],
      targets: [],
      searchTerm: '',
      ipAddresses: [],
      hasErrors: undefined,
      page: 1
    }
    setLocalParams(resetParams)
    onSearchParamsChange(resetParams)
  }, [onSearchParamsChange])

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">検索・フィルタ</h3>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '簡易表示' : '詳細フィルタ'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={loading}
          >
            リセット
          </Button>
        </div>
      </div>

      {/* 基本フィルタ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 期間選択 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            開始日
          </label>
          <input
            type="date"
            value={localParams.startDate || ''}
            onChange={(e) => handleInputChange('startDate', e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            終了日
          </label>
          <input
            type="date"
            value={localParams.endDate || ''}
            onChange={(e) => handleInputChange('endDate', e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* キーワード検索 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            キーワード検索
          </label>
          <input
            type="text"
            placeholder="アクション、ターゲット、メタデータ"
            value={localParams.searchTerm || ''}
            onChange={(e) => handleInputChange('searchTerm', e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* エラーフィルタ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ステータス
          </label>
          <select
            value={localParams.hasErrors === undefined ? '' : localParams.hasErrors ? 'error' : 'success'}
            onChange={(e) => {
              const value = e.target.value === '' ? undefined : e.target.value === 'error'
              handleInputChange('hasErrors', value)
            }}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全て</option>
            <option value="success">成功</option>
            <option value="error">エラー</option>
          </select>
        </div>
      </div>

      {/* プリセット期間 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          プリセット期間
        </label>
        <div className="flex flex-wrap gap-2">
          {presetRanges.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetRange(preset)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 詳細フィルタ */}
      {showAdvanced && (
        <div className="border-t pt-6 space-y-4">
          <h4 className="font-medium text-gray-900">詳細フィルタ</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ユーザーID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ユーザーID (カンマ区切り)
              </label>
              <input
                type="text"
                placeholder="user1, user2, system"
                value={localParams.actorIds?.join(', ') || ''}
                onChange={(e) => handleArrayChange('actorIds', e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* アクション */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アクション (カンマ区切り)
              </label>
              <input
                type="text"
                placeholder="login, export, etl_start"
                value={localParams.actions?.join(', ') || ''}
                onChange={(e) => handleArrayChange('actions', e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* IPアドレス */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IPアドレス (カンマ区切り)
              </label>
              <input
                type="text"
                placeholder="192.168.1.1, 10.0.0.1"
                value={localParams.ipAddresses?.join(', ') || ''}
                onChange={(e) => handleArrayChange('ipAddresses', e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* ターゲット */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ターゲット (カンマ区切り)
            </label>
            <input
              type="text"
              placeholder="dashboard, sales_data, export_data"
              value={localParams.targets?.join(', ') || ''}
              onChange={(e) => handleArrayChange('targets', e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-500">
          {localParams.searchTerm && (
            <span>キーワード: "{localParams.searchTerm}"</span>
          )}
          {localParams.startDate && localParams.endDate && (
            <span>期間: {localParams.startDate} 〜 {localParams.endDate}</span>
          )}
        </div>
        
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={onExport}
            disabled={loading}
            size="sm"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            エクスポート
          </Button>
          
          <Button
            onClick={onComplianceReport}
            disabled={loading}
            size="sm"
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
            コンプライアンスレポート
          </Button>
        </div>
      </div>
    </div>
  )
}
