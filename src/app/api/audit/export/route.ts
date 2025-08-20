/**
 * Audit Export API Endpoint
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: 監査ログエクスポート・コンプライアンスレポートAPI
 * Endpoints:
 * - POST /api/audit/export - CSV/JSON形式エクスポート
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
    console.error('[AuditExportAPI] Auth verification failed:', error)
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
 * POST /api/audit/export - 監査ログエクスポート
 */
export async function POST(request: NextRequest) {
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
    
    // リクエストボディ取得
    const body = await request.json()
    const {
      format = 'csv',
      startDate,
      endDate,
      actorIds = [],
      actions = [],
      targets = [],
      searchTerm,
      ipAddresses = [],
      hasErrors
    } = body
    
    // フォーマット検証
    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'サポートされていないフォーマットです（csv, json）' },
        { status: 400 }
      )
    }
    
    // 監査ログ記録
    await AuditService.log({
      action: `export_audit_${format}`,
      target: 'audit_export',
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        format,
        filters: {
          startDate,
          endDate,
          actorIds,
          actions,
          targets,
          searchTerm,
          ipAddresses,
          hasErrors
        },
        exported_at: new Date().toISOString()
      }
    })
    
    // エクスポートパラメータ準備
    const exportParams = {
      startDate,
      endDate,
      actorIds,
      actions,
      targets,
      searchTerm,
      ipAddresses,
      hasErrors,
      // エクスポート用の大きな制限値
      limit: 50000
    }
    
    // エクスポート実行
    const exportResult = await EnhancedAuditService.exportAuditLogs(
      exportParams,
      format as 'csv' | 'json'
    )
    
    const duration = Date.now() - startTime
    
    // パフォーマンス記録
    await AuditService.logPerformanceMetrics('audit_export', {
      duration_ms: duration,
      format,
      data_size_bytes: exportResult.data.length,
      filters_applied: Object.keys(exportParams).filter(key => 
        exportParams[key as keyof typeof exportParams] !== undefined &&
        exportParams[key as keyof typeof exportParams] !== ''
      ).length
    })
    
    // エクスポート成功ログ
    await AuditService.log({
      action: 'audit_export_success',
      target: 'audit_export',
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        format,
        filename: exportResult.filename,
        data_size_bytes: exportResult.data.length,
        duration_ms: duration,
        exported_at: new Date().toISOString()
      }
    })
    
    // レスポンスヘッダー設定
    const headers = new Headers()
    headers.set('Content-Type', format === 'json' ? 'application/json' : 'text/csv')
    headers.set('Content-Disposition', `attachment; filename="${exportResult.filename}"`)
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    
    return new NextResponse(exportResult.data, {
      status: 200,
      headers
    })
    
  } catch (error) {
    console.error('[AuditExportAPI] POST /export failed:', error)
    
    const duration = Date.now() - startTime
    
    // エラー記録
    await AuditService.log({
      action: 'audit_export_failure',
      target: 'audit_api',
      actor_id: 'system',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      }
    })
    
    return NextResponse.json(
      { 
        error: '監査ログエクスポートに失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
