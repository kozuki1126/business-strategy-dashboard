/**
 * useAuditMetrics Hook
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査メトリクス・統計データ取得・管理
 * Features:
 * - メトリクスAPI呼び出し・集計データ管理
 * - KPI・パフォーマンス指標取得
 * - リアルタイム更新・キャッシュ制御
 * - エラーハンドリング・状態管理
 */

import { useState, useEffect, useCallback, useRef } from 'react'

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

interface UseAuditMetricsParams {
  startDate?: string
  endDate?: string
}

interface UseAuditMetricsReturn {
  metrics: AuditMetrics | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAuditMetrics(params: UseAuditMetricsParams): UseAuditMetricsReturn {
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // リクエストキャンセル・重複防止用
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastParamsRef = useRef<string>('')

  // API呼び出し関数
  const fetchMetrics = useCallback(async (params: UseAuditMetricsParams, signal?: AbortSignal) => {
    try {
      const url = new URL('/api/audit/metrics', window.location.origin)
      
      if (params.startDate) {
        url.searchParams.append('startDate', params.startDate)
      }
      if (params.endDate) {
        url.searchParams.append('endDate', params.endDate)
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal
      })

      if (!response.ok) {
        throw new Error(`メトリクス取得エラー: ${response.status}`)
      }

      const data: { success: boolean; data: AuditMetrics; error?: string } = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'メトリクスの取得に失敗しました')
      }

      return data.data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null
      }
      throw error
    }
  }, [])

  // データ取得実行
  const loadMetrics = useCallback(async () => {
    // パラメータの変化チェック
    const paramsString = JSON.stringify(params)
    if (paramsString === lastParamsRef.current) {
      return
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

      const result = await fetchMetrics(params, abortController.signal)
      
      if (result) {
        setMetrics(result)
        lastParamsRef.current = paramsString
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
        console.error('Audit metrics fetch error:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [params, fetchMetrics])

  // 手動更新
  const refetch = useCallback(() => {
    lastParamsRef.current = ''
    loadMetrics()
  }, [loadMetrics])

  // パラメータ変更時の自動更新
  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    metrics,
    loading,
    error,
    refetch
  }
}
