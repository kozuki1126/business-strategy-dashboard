/**
 * Audit Metrics API Endpoint
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログメトリクス・集計・分析API
 * Endpoints:
 * - GET /api/audit/metrics - 集計・分析データ
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnhancedAuditService } from '@/lib/services/audit-enhanced'
import { AuditService } from '@/lib/services/audit'

// 認証チェック
async function verifyAuth(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return user
  } catch (error) {
    console.error('[AuditMetricsAPI] Auth verification failed:', error)
    return null
  }
}

// リクエスト情報取得
function getRequestInfo(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 
             request.headers.get('x-real-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  return { ip, userAgent }
}

/**
 * GET /api/audit/metrics - 監査ログメトリクス・集計分析
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 認証チェック
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }
    
    // リクエスト情報
    const { ip, userAgent } = getRequestInfo(request)
    
    // 監査ログ記録
    await AuditService.log({
      action: 'view_audit_metrics',
      target: 'audit_metrics',
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        accessed_at: new Date().toISOString()
      }
    })
    
    // クエリパラメータ取得
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined
    
    // デフォルト期間（過去30日）
    const defaultEndDate = new Date()
    const defaultStartDate = new Date(defaultEndDate.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const effectiveStartDate = startDate || defaultStartDate.toISOString()
    const effectiveEndDate = endDate || defaultEndDate.toISOString()
    
    // メトリクス取得
    const metrics = await EnhancedAuditService.getAuditMetrics(
      effectiveStartDate,
      effectiveEndDate
    )
    
    const duration = Date.now() - startTime
    
    // パフォーマンス記録
    await AuditService.logPerformanceMetrics('audit_metrics_generation', {
      duration_ms: duration,
      start_date: effectiveStartDate,
      end_date: effectiveEndDate,
      total_logs_analyzed: metrics.totalLogs
    })
    
    return NextResponse.json({
      success: true,
      data: {
        ...metrics,
        period: {
          start: effectiveStartDate,
          end: effectiveEndDate
        }
      },
      meta: {
        executionTime: duration,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('[AuditMetricsAPI] GET /metrics failed:', error)
    
    const duration = Date.now() - startTime
    
    // エラー記録
    await AuditService.log({
      action: 'audit_metrics_failure',
      target: 'audit_api',
      actor_id: 'system',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      }
    })
    
    return NextResponse.json(
      { 
        error: 'メトリクス取得に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
