/**
 * Enhanced Audit Service
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 拡張監査ログ・セキュリティ監査・コンプライアンス対応
 * Features:
 * - 高度な検索・フィルタ・集計機能
 * - リアルタイム分析・可視化データ生成
 * - セキュリティ監査・異常検知
 * - コンプライアンス対応・レポート生成
 * - パフォーマンス最適化・SLA監視
 */

import { createClient } from '@/lib/supabase/server'
import { AuditAction } from '@/types/database.types'

// Enhanced interfaces for audit operations
interface AuditSearchParams {
  // 時間範囲フィルタ
  startDate?: string
  endDate?: string
  
  // ユーザー・アクションフィルタ
  actorIds?: string[]
  actions?: string[]
  targets?: string[]
  
  // 検索キーワード
  searchTerm?: string
  
  // ページング
  page?: number
  limit?: number
  
  // ソート
  sortBy?: 'at' | 'action' | 'actor_id' | 'target'
  sortOrder?: 'asc' | 'desc'
  
  // 高度なフィルタ
  ipAddresses?: string[]
  userAgents?: string[]
  hasErrors?: boolean
  duration?: { min?: number; max?: number }
}

interface AuditSearchResult {
  logs: AuditLogRecord[]
  totalCount: number
  totalPages: number
  currentPage: number
  filters: AuditSearchParams
  executionTime: number
}

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

interface AuditMetrics {
  // 基本統計
  totalLogs: number
  uniqueUsers: number
  uniqueActions: number
  
  // 時系列データ
  actionsOverTime: { date: string; count: number }[]
  actionsPerHour: { hour: number; count: number }[]
  
  // ユーザー活動
  topUsers: { user: string; count: number }[]
  topActions: { action: string; count: number }[]
  
  // セキュリティメトリクス
  failedActions: number
  suspiciousActivity: number
  uniqueIPs: number
  
  // パフォーマンスメトリクス
  averageResponseTime: number
  p95ResponseTime: number
  slaCompliance: number
}

interface SecurityAnalysis {
  // 異常検知
  anomalies: {
    type: 'unusual_time' | 'unusual_location' | 'unusual_action' | 'high_frequency'
    actor_id: string
    description: string
    severity: 'low' | 'medium' | 'high'
    timestamp: string
  }[]
  
  // リスクスコア
  riskScore: number
  riskFactors: string[]
  
  // IP分析
  ipAnalysis: {
    ip: string
    actorCount: number
    actionCount: number
    riskLevel: 'low' | 'medium' | 'high'
  }[]
  
  // 失敗率分析
  failureRates: {
    action: string
    total: number
    failures: number
    failureRate: number
  }[]
}

export class EnhancedAuditService {
  private static supabase = createClient()
  
  /**
   * 包括的な監査ログ検索・フィルタ機能
   */
  static async searchAuditLogs(params: AuditSearchParams = {}): Promise<AuditSearchResult> {
    const startTime = Date.now()
    
    try {
      // デフォルト値設定
      const {
        page = 1,
        limit = 100,
        sortBy = 'at',
        sortOrder = 'desc',
        startDate,
        endDate,
        actorIds = [],
        actions = [],
        targets = [],
        searchTerm,
        ipAddresses = [],
        userAgents = [],
        hasErrors
      } = params
      
      // ベースクエリ構築
      let query = this.supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
      
      // 時間範囲フィルタ
      if (startDate) {
        query = query.gte('at', startDate)
      }
      if (endDate) {
        query = query.lte('at', endDate)
      }
      
      // ユーザーフィルタ
      if (actorIds.length > 0) {
        query = query.in('actor_id', actorIds)
      }
      
      // アクションフィルタ
      if (actions.length > 0) {
        query = query.in('action', actions)
      }
      
      // ターゲットフィルタ
      if (targets.length > 0) {
        query = query.in('target', targets)
      }
      
      // IPアドレスフィルタ
      if (ipAddresses.length > 0) {
        query = query.in('ip', ipAddresses)
      }
      
      // エラーフィルタ
      if (hasErrors === true) {
        query = query.ilike('action', '%failure%')
      } else if (hasErrors === false) {
        query = query.not('action', 'ilike', '%failure%')
      }
      
      // 検索キーワード（action, target, meta）
      if (searchTerm) {
        query = query.or(`action.ilike.%${searchTerm}%,target.ilike.%${searchTerm}%,meta::text.ilike.%${searchTerm}%`)
      }
      
      // ページング
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)
      
      const { data, error, count } = await query
      
      if (error) {
        console.error('[EnhancedAuditService] Search failed:', error)
        throw new Error(`監査ログ検索失敗: ${error.message}`)
      }
      
      const executionTime = Date.now() - startTime
      
      return {
        logs: data || [],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
        filters: params,
        executionTime
      }
    } catch (error) {
      console.error('[EnhancedAuditService] Search error:', error)
      throw error
    }
  }
  
  /**
   * 監査ログメトリクス・集計分析
   */
  static async getAuditMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<AuditMetrics> {
    try {
      // 基本データ取得
      let baseQuery = this.supabase
        .from('audit_log')
        .select('*')
      
      if (startDate) baseQuery = baseQuery.gte('at', startDate)
      if (endDate) baseQuery = baseQuery.lte('at', endDate)
      
      const { data: logs, error } = await baseQuery
      
      if (error) {
        throw new Error(`メトリクス取得失敗: ${error.message}`)
      }
      
      if (!logs || logs.length === 0) {
        return this.getEmptyMetrics()
      }
      
      // 基本統計計算
      const totalLogs = logs.length
      const uniqueUsers = new Set(logs.map(log => log.actor_id)).size
      const uniqueActions = new Set(logs.map(log => log.action)).size
      
      // 時系列データ（日別集計）
      const actionsOverTime = this.aggregateByDate(logs)
      const actionsPerHour = this.aggregateByHour(logs)
      
      // ユーザー活動トップ10
      const userCounts = this.countByField(logs, 'actor_id')
      const topUsers = Object.entries(userCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([user, count]) => ({ user, count }))
      
      // アクション別集計トップ10
      const actionCounts = this.countByField(logs, 'action')
      const topActions = Object.entries(actionCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([action, count]) => ({ action, count }))
      
      // セキュリティメトリクス
      const failedActions = logs.filter(log => 
        log.action.includes('failure') || log.action.includes('error')
      ).length
      
      const suspiciousActivity = logs.filter(log =>
        this.isSuspiciousActivity(log)
      ).length
      
      const uniqueIPs = new Set(
        logs.map(log => log.ip).filter(ip => ip !== null)
      ).size
      
      // パフォーマンスメトリクス
      const responseTimes = logs
        .map(log => log.meta?.duration_ms || log.meta?.response_time)
        .filter(time => typeof time === 'number')
      
      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0
      
      const p95ResponseTime = responseTimes.length > 0
        ? this.calculatePercentile(responseTimes, 95)
        : 0
      
      // SLA準拠率（5秒以内）
      const slaCompliant = responseTimes.filter(time => time <= 5000).length
      const slaCompliance = responseTimes.length > 0
        ? (slaCompliant / responseTimes.length) * 100
        : 100
      
      return {
        totalLogs,
        uniqueUsers,
        uniqueActions,
        actionsOverTime,
        actionsPerHour,
        topUsers,
        topActions,
        failedActions,
        suspiciousActivity,
        uniqueIPs,
        averageResponseTime,
        p95ResponseTime,
        slaCompliance
      }
    } catch (error) {
      console.error('[EnhancedAuditService] Metrics calculation failed:', error)
      throw error
    }
  }
  
  /**
   * セキュリティ分析・異常検知
   */
  static async performSecurityAnalysis(
    startDate?: string,
    endDate?: string
  ): Promise<SecurityAnalysis> {
    try {
      let query = this.supabase
        .from('audit_log')
        .select('*')
      
      if (startDate) query = query.gte('at', startDate)
      if (endDate) query = query.lte('at', endDate)
      
      const { data: logs, error } = await query
      
      if (error) {
        throw new Error(`セキュリティ分析失敗: ${error.message}`)
      }
      
      if (!logs || logs.length === 0) {
        return this.getEmptySecurityAnalysis()
      }
      
      // 異常検知
      const anomalies = this.detectAnomalies(logs)
      
      // リスクスコア計算
      const { riskScore, riskFactors } = this.calculateRiskScore(logs, anomalies)
      
      // IP分析
      const ipAnalysis = this.analyzeIPActivity(logs)
      
      // 失敗率分析
      const failureRates = this.analyzeFailureRates(logs)
      
      return {
        anomalies,
        riskScore,
        riskFactors,
        ipAnalysis,
        failureRates
      }
    } catch (error) {
      console.error('[EnhancedAuditService] Security analysis failed:', error)
      throw error
    }
  }
  
  /**
   * 監査ログエクスポート機能
   */
  static async exportAuditLogs(
    params: AuditSearchParams,
    format: 'csv' | 'json' = 'csv'
  ): Promise<{ data: string; filename: string }> {
    try {
      // 全データ取得（ページング無効）
      const searchParams = { ...params, page: 1, limit: 10000 }
      const result = await this.searchAuditLogs(searchParams)
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      
      if (format === 'json') {
        return {
          data: JSON.stringify(result, null, 2),
          filename: `audit-logs-${timestamp}.json`
        }
      }
      
      // CSV形式
      const headers = [
        'timestamp',
        'actor_id',
        'action',
        'target',
        'ip_address',
        'user_agent',
        'metadata'
      ]
      
      const csvRows = [
        headers.join(','),
        ...result.logs.map(log => [
          `"${log.at}"`,
          `"${log.actor_id}"`,
          `"${log.action}"`,
          `"${log.target || ''}"`,
          `"${log.ip || ''}"`,
          `"${log.ua || ''}"`,
          `"${JSON.stringify(log.meta || {}).replace(/"/g, '""')}"`
        ].join(','))
      ]
      
      return {
        data: csvRows.join('\n'),
        filename: `audit-logs-${timestamp}.csv`
      }
    } catch (error) {
      console.error('[EnhancedAuditService] Export failed:', error)
      throw error
    }
  }
  
  /**
   * コンプライアンスレポート生成
   */
  static async generateComplianceReport(
    startDate: string,
    endDate: string
  ): Promise<{
    summary: Record<string, any>
    dataAccess: any[]
    dataModifications: any[]
    systemChanges: any[]
    userActivity: any[]
    securityEvents: any[]
  }> {
    try {
      const logs = await this.searchAuditLogs({
        startDate,
        endDate,
        limit: 10000
      })
      
      // データアクセス記録
      const dataAccess = logs.logs.filter(log =>
        ['view_dashboard', 'export_csv', 'export_excel'].includes(log.action)
      )
      
      // データ変更記録
      const dataModifications = logs.logs.filter(log =>
        ['input_sales', 'update_sales', 'delete_sales'].includes(log.action)
      )
      
      // システム変更記録
      const systemChanges = logs.logs.filter(log =>
        log.action.startsWith('etl_') || log.action.includes('system_')
      )
      
      // ユーザー活動記録
      const userActivity = logs.logs.filter(log =>
        !log.actor_id.includes('system') && !log.actor_id.includes('scheduler')
      )
      
      // セキュリティイベント
      const securityEvents = logs.logs.filter(log =>
        log.action.includes('failure') || 
        log.action.includes('error') ||
        this.isSuspiciousActivity(log)
      )
      
      const summary = {
        reportPeriod: { start: startDate, end: endDate },
        totalEvents: logs.totalCount,
        dataAccessCount: dataAccess.length,
        dataModificationCount: dataModifications.length,
        systemChangeCount: systemChanges.length,
        userActivityCount: userActivity.length,
        securityEventCount: securityEvents.length,
        uniqueUsers: new Set(userActivity.map(log => log.actor_id)).size,
        complianceStatus: securityEvents.length === 0 ? 'COMPLIANT' : 'ATTENTION_REQUIRED'
      }
      
      return {
        summary,
        dataAccess,
        dataModifications,
        systemChanges,
        userActivity,
        securityEvents
      }
    } catch (error) {
      console.error('[EnhancedAuditService] Compliance report failed:', error)
      throw error
    }
  }
  
  // ヘルパーメソッド
  private static aggregateByDate(logs: AuditLogRecord[]): { date: string; count: number }[] {
    const dateCounts: Record<string, number> = {}
    
    logs.forEach(log => {
      const date = log.at.split('T')[0] // YYYY-MM-DD
      dateCounts[date] = (dateCounts[date] || 0) + 1
    })
    
    return Object.entries(dateCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))
  }
  
  private static aggregateByHour(logs: AuditLogRecord[]): { hour: number; count: number }[] {
    const hourCounts: Record<number, number> = {}
    
    logs.forEach(log => {
      const hour = new Date(log.at).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })
    
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourCounts[hour] || 0
    }))
  }
  
  private static countByField(logs: AuditLogRecord[], field: keyof AuditLogRecord): Record<string, number> {
    const counts: Record<string, number> = {}
    
    logs.forEach(log => {
      const value = String(log[field] || 'unknown')
      counts[value] = (counts[value] || 0) + 1
    })
    
    return counts
  }
  
  private static isSuspiciousActivity(log: AuditLogRecord): boolean {
    // 夜間アクセス（22:00-06:00）
    const hour = new Date(log.at).getHours()
    const isNightAccess = hour >= 22 || hour <= 6
    
    // 短時間での大量アクセス
    const hasHighFrequency = log.meta?.frequency_warning === true
    
    // 失敗アクション
    const isFailure = log.action.includes('failure') || log.action.includes('error')
    
    return isNightAccess || hasHighFrequency || isFailure
  }
  
  private static detectAnomalies(logs: AuditLogRecord[]): any[] {
    const anomalies: any[] = []
    
    // ユーザー別活動頻度分析
    const userActivity: Record<string, AuditLogRecord[]> = {}
    logs.forEach(log => {
      if (!userActivity[log.actor_id]) {
        userActivity[log.actor_id] = []
      }
      userActivity[log.actor_id].push(log)
    })
    
    Object.entries(userActivity).forEach(([actorId, userLogs]) => {
      // 異常な時間でのアクセス
      const nightAccess = userLogs.filter(log => {
        const hour = new Date(log.at).getHours()
        return hour >= 22 || hour <= 6
      })
      
      if (nightAccess.length > 3) {
        anomalies.push({
          type: 'unusual_time' as const,
          actor_id: actorId,
          description: `夜間時間帯での異常なアクセス（${nightAccess.length}回）`,
          severity: 'medium' as const,
          timestamp: new Date().toISOString()
        })
      }
      
      // 高頻度アクセス
      if (userLogs.length > 100) {
        anomalies.push({
          type: 'high_frequency' as const,
          actor_id: actorId,
          description: `異常に高頻度なアクセス（${userLogs.length}回）`,
          severity: 'high' as const,
          timestamp: new Date().toISOString()
        })
      }
    })
    
    return anomalies
  }
  
  private static calculateRiskScore(logs: AuditLogRecord[], anomalies: any[]): {
    riskScore: number
    riskFactors: string[]
  } {
    let score = 0
    const factors: string[] = []
    
    // 異常検知スコア
    score += anomalies.length * 10
    if (anomalies.length > 0) {
      factors.push(`${anomalies.length}件の異常検知`)
    }
    
    // 失敗率スコア
    const failures = logs.filter(log => log.action.includes('failure')).length
    const failureRate = logs.length > 0 ? (failures / logs.length) * 100 : 0
    if (failureRate > 5) {
      score += failureRate * 2
      factors.push(`高い失敗率（${failureRate.toFixed(1)}%）`)
    }
    
    // 夜間活動スコア
    const nightActivity = logs.filter(log => {
      const hour = new Date(log.at).getHours()
      return hour >= 22 || hour <= 6
    }).length
    if (nightActivity > 10) {
      score += 20
      factors.push(`夜間活動（${nightActivity}件）`)
    }
    
    return {
      riskScore: Math.min(100, score),
      riskFactors: factors
    }
  }
  
  private static analyzeIPActivity(logs: AuditLogRecord[]): any[] {
    const ipActivity: Record<string, { actors: Set<string>; actions: number }> = {}
    
    logs.forEach(log => {
      if (log.ip) {
        if (!ipActivity[log.ip]) {
          ipActivity[log.ip] = { actors: new Set(), actions: 0 }
        }
        ipActivity[log.ip].actors.add(log.actor_id)
        ipActivity[log.ip].actions += 1
      }
    })
    
    return Object.entries(ipActivity)
      .map(([ip, data]) => ({
        ip,
        actorCount: data.actors.size,
        actionCount: data.actions,
        riskLevel: data.actors.size > 3 || data.actions > 100 ? 'high' : 
                  data.actors.size > 1 || data.actions > 50 ? 'medium' : 'low'
      }))
      .sort((a, b) => b.actionCount - a.actionCount)
  }
  
  private static analyzeFailureRates(logs: AuditLogRecord[]): any[] {
    const actionStats: Record<string, { total: number; failures: number }> = {}
    
    logs.forEach(log => {
      const baseAction = log.action.replace(/_failure$|_error$/, '')
      if (!actionStats[baseAction]) {
        actionStats[baseAction] = { total: 0, failures: 0 }
      }
      actionStats[baseAction].total += 1
      if (log.action.includes('failure') || log.action.includes('error')) {
        actionStats[baseAction].failures += 1
      }
    })
    
    return Object.entries(actionStats)
      .map(([action, stats]) => ({
        action,
        total: stats.total,
        failures: stats.failures,
        failureRate: stats.total > 0 ? (stats.failures / stats.total) * 100 : 0
      }))
      .filter(item => item.total >= 5) // 5回以上のアクションのみ
      .sort((a, b) => b.failureRate - a.failureRate)
  }
  
  private static calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[index] || 0
  }
  
  private static getEmptyMetrics(): AuditMetrics {
    return {
      totalLogs: 0,
      uniqueUsers: 0,
      uniqueActions: 0,
      actionsOverTime: [],
      actionsPerHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
      topUsers: [],
      topActions: [],
      failedActions: 0,
      suspiciousActivity: 0,
      uniqueIPs: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      slaCompliance: 100
    }
  }
  
  private static getEmptySecurityAnalysis(): SecurityAnalysis {
    return {
      anomalies: [],
      riskScore: 0,
      riskFactors: [],
      ipAnalysis: [],
      failureRates: []
    }
  }
}
