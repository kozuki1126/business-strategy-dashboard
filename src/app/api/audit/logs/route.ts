/**
 * Audit Logs API Endpoints
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログ・検索・分析・エクスポートAPI
 * Endpoints:
 * - GET /api/audit/logs - ログ検索・フィルタ
 * - GET /api/audit/metrics - 集計・分析データ
 * - GET /api/audit/security - セキュリティ分析
 * - POST /api/audit/export - エクスポート機能
 * - GET /api/audit/compliance - コンプライアンスレポート
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
    console.error('[AuditAPI] Auth verification failed:', error)
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
 * GET /api/audit/logs - 監査ログ検索・フィルタ
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
      action: 'view_audit_logs',
      target: 'audit_log',
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        accessed_at: new Date().toISOString()
      }
    })
    
    // クエリパラメータ取得
    const url = new URL(request.url)
    const searchParams = {
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      actorIds: url.searchParams.get('actorIds')?.split(',') || [],
      actions: url.searchParams.get('actions')?.split(',') || [],
      targets: url.searchParams.get('targets')?.split(',') || [],
      searchTerm: url.searchParams.get('searchTerm') || undefined,
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000),
      sortBy: url.searchParams.get('sortBy') as any || 'at',
      sortOrder: url.searchParams.get('sortOrder') as any || 'desc',
      ipAddresses: url.searchParams.get('ipAddresses')?.split(',') || [],
      hasErrors: url.searchParams.get('hasErrors') === 'true' ? true : 
                 url.searchParams.get('hasErrors') === 'false' ? false : undefined
    }
    
    // 監査ログ検索実行
    const result = await EnhancedAuditService.searchAuditLogs(searchParams)
    
    const duration = Date.now() - startTime
    
    // パフォーマンス記録
    await AuditService.logPerformanceMetrics('audit_logs_search', {
      duration_ms: duration,
      result_count: result.logs.length,
      total_count: result.totalCount,
      filters_applied: Object.keys(searchParams).filter(key => 
        searchParams[key as keyof typeof searchParams] !== undefined &&
        searchParams[key as keyof typeof searchParams] !== ''
      ).length
    })
    
    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        executionTime: duration,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('[AuditAPI] GET /logs failed:', error)
    
    const duration = Date.now() - startTime
    
    // エラー記録
    await AuditService.log({
      action: 'audit_logs_search_failure',
      target: 'audit_api',
      actor_id: 'system',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      }
    })
    
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/audit/logs - 手動監査ログ記録
 */
export async function POST(request: NextRequest) {
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
    
    // リクエストボディ取得
    const body = await request.json()
    const { action, target, meta } = body
    
    if (!action) {
      return NextResponse.json(
        { error: 'actionは必須です' },
        { status: 400 }
      )
    }
    
    // 監査ログ記録
    await AuditService.log({
      action,
      target,
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        ...meta,
        manual_entry: true,
        recorded_at: new Date().toISOString()
      }
    })
    
    return NextResponse.json({
      success: true,
      message: '監査ログが記録されました',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('[AuditAPI] POST /logs failed:', error)
    
    return NextResponse.json(
      { 
        error: 'ログ記録に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
