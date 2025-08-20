/**
 * Audit Export Modal Component
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログエクスポート・ダウンロード機能
 * Features:
 * - CSV/JSONエクスポート・フォーマット選択
 * - エクスポート設定・プレビュー機能
 * - ダウンロード進行状況・エラーハンドリング
 * - アクセシビリティ・モーダル制御
 */

'use client'

import { useState, useCallback } from 'react'

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

interface AuditExportModalProps {
  onExport: (format: 'csv' | 'json') => Promise<void>
  onClose: () => void
  searchParams: AuditSearchParams
}

export function AuditExportModal({
  onExport,
  onClose,
  searchParams
}: AuditExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json'>('csv')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // エクスポート実行
  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true)
      setExportError(null)
      await onExport(selectedFormat)
    } catch (error) {
      console.error('Export failed:', error)
      setExportError(error instanceof Error ? error.message : 'エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }, [selectedFormat, onExport])

  // キーボードイベント処理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  // フィルタサマリー生成
  const filterSummary = useCallback(() => {
    const summary: string[] = []
    
    if (searchParams.startDate && searchParams.endDate) {
      summary.push(`期間: ${searchParams.startDate} 〜 ${searchParams.endDate}`)
    }
    if (searchParams.searchTerm) {
      summary.push(`キーワード: "${searchParams.searchTerm}"`)
    }
    if (searchParams.actorIds && searchParams.actorIds.length > 0) {
      summary.push(`ユーザー: ${searchParams.actorIds.slice(0, 3).join(', ')}${searchParams.actorIds.length > 3 ? '他' : ''}`)
    }
    if (searchParams.actions && searchParams.actions.length > 0) {
      summary.push(`アクション: ${searchParams.actions.slice(0, 3).join(', ')}${searchParams.actions.length > 3 ? '他' : ''}`)
    }
    if (searchParams.hasErrors !== undefined) {
      summary.push(`ステータス: ${searchParams.hasErrors ? 'エラーのみ' : '成功のみ'}`)
    }
    
    return summary.length > 0 ? summary : ['すべての監査ログ']
  }, [searchParams])

  return (
    <>
      {/* オーバーレイ */}
      <div 
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* モーダル */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div 
            className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            {/* ヘッダー */}
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    監査ログエクスポート
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    選択した条件で監査ログをエクスポートします
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="閉じる"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* エクスポート設定 */}
              <div className="mt-6 space-y-6">
                {/* フォーマット選択 */}
                <div>
                  <label className="text-base font-medium text-gray-900">エクスポート形式</label>
                  <p className="text-sm leading-5 text-gray-500">ダウンロードするファイル形式を選択してください</p>
                  <fieldset className="mt-4">
                    <legend className="sr-only">エクスポート形式</legend>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          id="format-csv"
                          name="format"
                          type="radio"
                          value="csv"
                          checked={selectedFormat === 'csv'}
                          onChange={(e) => setSelectedFormat(e.target.value as 'csv')}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={isExporting}
                        />
                        <label htmlFor="format-csv" className="ml-3 block text-sm font-medium text-gray-700">
                          CSV形式
                          <span className="block text-sm font-normal text-gray-500">
                            スプレッドシートソフトで開けます（Excel、Google Sheets等）
                          </span>
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="format-json"
                          name="format"
                          type="radio"
                          value="json"
                          checked={selectedFormat === 'json'}
                          onChange={(e) => setSelectedFormat(e.target.value as 'json')}
                          className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                          disabled={isExporting}
                        />
                        <label htmlFor="format-json" className="ml-3 block text-sm font-medium text-gray-700">
                          JSON形式
                          <span className="block text-sm font-normal text-gray-500">
                            プログラムでの処理や詳細分析に適しています
                          </span>
                        </label>
                      </div>
                    </div>
                  </fieldset>
                </div>

                {/* エクスポート条件プレビュー */}
                <div>
                  <label className="text-base font-medium text-gray-900">エクスポート条件</label>
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-md p-3">
                    <ul className="text-sm text-gray-600 space-y-1">
                      {filterSummary().map((condition, index) => (
                        <li key={index} className="flex items-center">
                          <svg className="w-4 h-4 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {condition}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 注意事項 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">注意事項</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>大量のデータのエクスポートには時間がかかる場合があります</li>
                          <li>エクスポートしたファイルには機密情報が含まれる可能性があります</li>
                          <li>適切なセキュリティ対策を講じて取り扱ってください</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* エラー表示 */}
                {exportError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">エクスポートエラー</h3>
                        <div className="mt-2 text-sm text-red-700">
                          {exportError}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* フッター */}
            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    エクスポート中...
                  </>
                ) : (
                  <>
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ダウンロード開始
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                disabled={isExporting}
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
