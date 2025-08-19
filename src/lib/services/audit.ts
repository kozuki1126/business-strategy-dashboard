/**
 * Audit Service
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: ETL・システム操作の監査ログ記録
 * Features:
 * - ETL実行・成功・失敗の記録
 * - システム操作・データアクセスの追跡
 * - 監査証跡の永続化
 * - パフォーマンス・メタデータ記録
 */

import { createClient } from '@/lib/supabase/server'
import { AuditAction } from '@/types/database.types'

interface AuditLogEntry {
  action: AuditAction | string
  target?: string | null
  actor_id?: string | null
  ip?: string | null
  ua?: string | null
  meta?: Record<string, any> | null
}

export class AuditService {
  private static supabase = createClient()

  /**
   * Log audit entry to database
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('audit_log')
        .insert({
          actor_id: entry.actor_id || 'system',
          action: entry.action,
          target: entry.target,
          at: new Date().toISOString(),
          ip: entry.ip,
          ua: entry.ua,
          meta: entry.meta
        })

      if (error) {
        console.error('[AuditService] Failed to log audit entry:', error)
        // Don't throw error to avoid breaking main flow
      }
    } catch (error) {
      console.error('[AuditService] Audit logging failed:', error)
      // Silent fail - audit should not break main functionality
    }
  }

  /**
   * Log ETL start event
   */
  static async logETLStart(runId: string, metadata?: Record<string, any>): Promise<void> {
    await this.log({
      action: 'etl_start',
      target: 'all_external_tables',
      actor_id: 'etl_scheduler',
      meta: {
        run_id: runId,
        started_at: new Date().toISOString(),
        ...metadata
      }
    })
  }

  /**
   * Log ETL success event
   */
  static async logETLSuccess(
    runId: string, 
    duration: number, 
    results: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: 'etl_success',
      target: 'all_external_tables',
      actor_id: 'etl_scheduler',
      meta: {
        run_id: runId,
        duration_ms: duration,
        completed_at: new Date().toISOString(),
        results: results,
        ...metadata
      }
    })
  }

  /**
   * Log ETL failure event
   */
  static async logETLFailure(
    runId: string, 
    duration: number, 
    error: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: 'etl_failure',
      target: 'all_external_tables',
      actor_id: 'etl_scheduler',
      meta: {
        run_id: runId,
        duration_ms: duration,
        failed_at: new Date().toISOString(),
        error: error,
        ...metadata
      }
    })
  }

  /**
   * Log data source processing event
   */
  static async logDataSourceProcessing(
    source: string,
    status: 'start' | 'success' | 'failure',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: `etl_${source}_${status}`,
      target: `ext_${source}`,
      actor_id: 'etl_scheduler',
      meta: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    })
  }

  /**
   * Log system health check
   */
  static async logHealthCheck(
    status: 'healthy' | 'degraded' | 'unhealthy',
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: 'system_health_check',
      target: 'system',
      actor_id: 'health_monitor',
      meta: {
        status: status,
        checked_at: new Date().toISOString(),
        ...metadata
      }
    })
  }

  /**
   * Log performance metrics
   */
  static async logPerformanceMetrics(
    operation: string,
    metrics: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: 'performance_metrics',
      target: operation,
      actor_id: 'performance_monitor',
      meta: {
        metrics: metrics,
        measured_at: new Date().toISOString()
      }
    })
  }

  /**
   * Log user dashboard access
   */
  static async logDashboardAccess(
    userId: string,
    filters?: Record<string, any>,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      action: 'view_dashboard',
      target: 'dashboard',
      actor_id: userId,
      ip: ip,
      ua: userAgent,
      meta: {
        filters: filters,
        accessed_at: new Date().toISOString()
      }
    })
  }

  /**
   * Log data export event
   */
  static async logDataExport(
    userId: string,
    exportType: 'csv' | 'excel' | 'pdf',
    filters: Record<string, any>,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      action: `export_${exportType}`,
      target: 'export_data',
      actor_id: userId,
      ip: ip,
      ua: userAgent,
      meta: {
        export_type: exportType,
        filters: filters,
        exported_at: new Date().toISOString()
      }
    })
  }

  /**
   * Log sales data input
   */
  static async logSalesInput(
    userId: string,
    salesData: Record<string, any>,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      action: 'input_sales',
      target: 'sales_data',
      actor_id: userId,
      ip: ip,
      ua: userAgent,
      meta: {
        store_id: salesData.store_id,
        date: salesData.date,
        department: salesData.department,
        revenue: salesData.revenue_ex_tax,
        input_at: new Date().toISOString()
      }
    })
  }

  /**
   * Get recent audit logs
   */
  static async getRecentLogs(
    limit: number = 100,
    action?: string
  ): Promise<any[]> {
    try {
      let query = this.supabase
        .from('audit_log')
        .select('*')
        .order('at', { ascending: false })
        .limit(limit)

      if (action) {
        query = query.eq('action', action)
      }

      const { data, error } = await query

      if (error) {
        console.error('[AuditService] Failed to fetch audit logs:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('[AuditService] Error fetching audit logs:', error)
      return []
    }
  }

  /**
   * Get ETL execution history
   */
  static async getETLHistory(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('audit_log')
        .select('*')
        .in('action', ['etl_start', 'etl_success', 'etl_failure'])
        .order('at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[AuditService] Failed to fetch ETL history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('[AuditService] Error fetching ETL history:', error)
      return []
    }
  }

  /**
   * Get system health metrics from audit logs
   */
  static async getSystemHealthMetrics(hours: number = 24): Promise<Record<string, any>> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      const { data, error } = await this.supabase
        .from('audit_log')
        .select('*')
        .gte('at', since)
        .in('action', ['etl_success', 'etl_failure', 'system_health_check'])
        .order('at', { ascending: false })

      if (error) {
        console.error('[AuditService] Failed to fetch health metrics:', error)
        return {}
      }

      // Analyze health metrics
      const etlSuccesses = data?.filter(log => log.action === 'etl_success').length || 0
      const etlFailures = data?.filter(log => log.action === 'etl_failure').length || 0
      const totalETL = etlSuccesses + etlFailures
      const successRate = totalETL > 0 ? (etlSuccesses / totalETL) * 100 : 0

      return {
        hours_analyzed: hours,
        etl_success_count: etlSuccesses,
        etl_failure_count: etlFailures,
        etl_success_rate: successRate,
        last_updated: new Date().toISOString(),
        total_operations: data?.length || 0
      }
    } catch (error) {
      console.error('[AuditService] Error calculating health metrics:', error)
      return {}
    }
  }
}
