/**
 * Audit Compliance Report API Endpoint
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: コンプライアンスレポート・規制対応・監査報告API
 * Endpoints:
 * - GET /api/audit/compliance - コンプライアンスレポート生成
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
    console.error('[AuditComplianceAPI] Auth verification failed:', error)
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
 * GET /api/audit/compliance - コンプライアンスレポート生成
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
      action: 'generate_compliance_report',
      target: 'compliance_audit',
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        accessed_at: new Date().toISOString(),
        compliance_level: 'full'
      }
    })
    
    // クエリパラメータ取得
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    
    // 必須パラメータチェック
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDateとendDateは必須です' },
        { status: 400 }
      )
    }
    
    // 期間妥当性チェック
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: '無効な日付形式です' },
        { status: 400 }
      )
    }
    
    if (start >= end) {
      return NextResponse.json(
        { error: '開始日は終了日より前である必要があります' },
        { status: 400 }
      )
    }
    
    // 期間制限（最大1年）
    const maxDays = 365
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays > maxDays) {
      return NextResponse.json(
        { error: `レポート期間は最大${maxDays}日間です` },
        { status: 400 }
      )
    }
    
    // コンプライアンスレポート生成
    const complianceReport = await EnhancedAuditService.generateComplianceReport(
      startDate,
      endDate
    )
    
    const duration = Date.now() - startTime
    
    // パフォーマンス記録
    await AuditService.logPerformanceMetrics('compliance_report_generation', {
      duration_ms: duration,
      start_date: startDate,
      end_date: endDate,
      period_days: diffDays,
      total_events: complianceReport.summary.totalEvents,
      compliance_status: complianceReport.summary.complianceStatus
    })
    
    // コンプライアンス状況確認
    const isCompliant = complianceReport.summary.complianceStatus === 'COMPLIANT'
    
    // 非準拠の場合は追加ログ記録
    if (!isCompliant) {
      await AuditService.log({
        action: 'compliance_violation_detected',
        target: 'compliance_monitoring',
        actor_id: 'compliance_monitor',
        meta: {
          period: { start: startDate, end: endDate },
          security_events: complianceReport.summary.securityEventCount,
          violation_types: complianceReport.securityEvents.map(event => event.action),
          report_generated_by: user.id,
          generated_at: new Date().toISOString()
        }
      })
    }
    
    // レポート生成成功ログ
    await AuditService.log({
      action: 'compliance_report_generated',
      target: 'compliance_report',
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        period: { start: startDate, end: endDate },
        period_days: diffDays,
        compliance_status: complianceReport.summary.complianceStatus,
        total_events: complianceReport.summary.totalEvents,
        duration_ms: duration,
        generated_at: new Date().toISOString()
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        ...complianceReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatedBy: user.id,
          reportPeriodDays: diffDays,
          executionTime: duration,
          version: '1.0'
        }
      },
      meta: {
        executionTime: duration,
        timestamp: new Date().toISOString(),
        complianceStatus: complianceReport.summary.complianceStatus,
        requiresAction: !isCompliant
      }
    })
    
  } catch (error) {
    console.error('[AuditComplianceAPI] GET /compliance failed:', error)
    
    const duration = Date.now() - startTime
    
    // エラー記録
    await AuditService.log({
      action: 'compliance_report_failure',
      target: 'audit_api',
      actor_id: 'system',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      }
    })
    
    return NextResponse.json(
      { 
        error: 'コンプライアンスレポート生成に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
