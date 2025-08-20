/**
 * useAuditLogs Hook
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログデータ取得・検索・状態管理
 * Features:
 * - 監査ログAPI呼び出し・パラメータ管理
 * - ローディング・エラー状態管理
 * - リアルタイム更新・キャッシュ制御
 * - パフォーマンス最適化・メモリ効率化
 */

import { useState, useEffect, useCallback, useRef } from 'react'

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

interface AuditLogsResponse {
  logs: AuditLogRecord[]
  totalCount: number
  totalPages: number
  currentPage: number
  filters: AuditSearchParams
  executionTime: number
}

interface UseAuditLogsReturn {
  logs: AuditLogRecord[]
  loading: boolean
  error: string | null
  totalCount: number
  totalPages: number
  currentPage: number
  executionTime: number | null
  refetch: () => void
}

export function useAuditLogs(searchParams: AuditSearchParams): UseAuditLogsReturn {
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [executionTime, setExecutionTime] = useState<number | null>(null)
  
  // リクエストキャンセル用
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastParamsRef = useRef<string>('')

  // API呼び出し関数
  const fetchAuditLogs = useCallback(async (params: AuditSearchParams, signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/audit/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        signal
      })

      if (!response.ok) {
        throw new Error(`監査ログ取得エラー: ${response.status}`)
      }

      const data: { success: boolean; data: AuditLogsResponse; error?: string } = await response.json()

      if (!data.success) {
        throw new Error(data.error || '監査ログの取得に失敗しました')
      }

      return data.data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // リクエストがキャンセルされた場合は無視
        return null
      }
      throw error
    }
  }, [])

  // データ取得実行
  const loadAuditLogs = useCallback(async () => {
    // パラメータの変化チェック
    const paramsString = JSON.stringify(searchParams)
    if (paramsString === lastParamsRef.current) {
      return // 同じパラメータなら再取得しない
    }

    // 前のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 新しいAbortControllerを作成
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      setLoading(true)
      setError(null)

      const result = await fetchAuditLogs(searchParams, abortController.signal)
      
      if (result) {
        setLogs(result.logs)
        setTotalCount(result.totalCount)
        setTotalPages(result.totalPages)
        setCurrentPage(result.currentPage)
        setExecutionTime(result.executionTime)
        lastParamsRef.current = paramsString
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
        console.error('Audit logs fetch error:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [searchParams, fetchAuditLogs])

  // 手動更新
  const refetch = useCallback(() => {
    lastParamsRef.current = '' // キャッシュをクリア
    loadAuditLogs()
  }, [loadAuditLogs])

  // パラメータ変更時の自動更新
  useEffect(() => {
    loadAuditLogs()
  }, [loadAuditLogs])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    logs,
    loading,
    error,
    totalCount,
    totalPages,
    currentPage,
    executionTime,
    refetch
  }
}
