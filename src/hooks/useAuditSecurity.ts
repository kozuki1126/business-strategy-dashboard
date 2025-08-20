/**
 * useAuditSecurity Hook
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: セキュリティ分析・異常検知・リスクアセスメント
 * Features:
 * - セキュリティ分析API呼び出し・脅威検知
 * - 異常検知・リスクスコア・IP分析
 * - リアルタイム監視・アラート管理
 * - エラーハンドリング・状態管理
 */

import { useState, useEffect, useCallback, useRef } from 'react'

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

interface UseAuditSecurityParams {
  startDate?: string
  endDate?: string
}

interface UseAuditSecurityReturn {
  securityAnalysis: SecurityAnalysis | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAuditSecurity(params: UseAuditSecurityParams): UseAuditSecurityReturn {
  const [securityAnalysis, setSecurityAnalysis] = useState<SecurityAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // リクエストキャンセル・重複防止用
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastParamsRef = useRef<string>('')

  // API呼び出し関数
  const fetchSecurityAnalysis = useCallback(async (params: UseAuditSecurityParams, signal?: AbortSignal) => {
    try {
      const url = new URL('/api/audit/security', window.location.origin)
      
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
        throw new Error(`セキュリティ分析エラー: ${response.status}`)
      }

      const data: { success: boolean; data: SecurityAnalysis; error?: string } = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'セキュリティ分析の取得に失敗しました')
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
  const loadSecurityAnalysis = useCallback(async () => {
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

      const result = await fetchSecurityAnalysis(params, abortController.signal)
      
      if (result) {
        setSecurityAnalysis(result)
        lastParamsRef.current = paramsString
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
        console.error('Security analysis fetch error:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [params, fetchSecurityAnalysis])

  // 手動更新
  const refetch = useCallback(() => {
    lastParamsRef.current = ''
    loadSecurityAnalysis()
  }, [loadSecurityAnalysis])

  // パラメータ変更時の自動更新
  useEffect(() => {
    loadSecurityAnalysis()
  }, [loadSecurityAnalysis])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    securityAnalysis,
    loading,
    error,
    refetch
  }
}
