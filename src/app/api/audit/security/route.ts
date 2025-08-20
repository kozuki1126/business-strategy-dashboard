/**
 * Audit Security Analysis API Endpoint
 * Task #012: 監査ログ基盤実装
 * 
 * Purpose: セキュリティ分析・異常検知・リスク分析API
 * Endpoints:
 * - GET /api/audit/security - セキュリティ分析・異常検知
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
    console.error('[AuditSecurityAPI] Auth verification failed:', error)
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
 * GET /api/audit/security - セキュリティ分析・異常検知
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
      action: 'view_security_analysis',
      target: 'security_audit',
      actor_id: user.id,
      ip,
      ua: userAgent,
      meta: {
        accessed_at: new Date().toISOString(),
        security_level: 'high'
      }
    })
    
    // クエリパラメータ取得
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined
    
    // デフォルト期間（過去7日間）
    const defaultEndDate = new Date()
    const defaultStartDate = new Date(defaultEndDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const effectiveStartDate = startDate || defaultStartDate.toISOString()
    const effectiveEndDate = endDate || defaultEndDate.toISOString()
    
    // セキュリティ分析実行
    const securityAnalysis = await EnhancedAuditService.performSecurityAnalysis(
      effectiveStartDate,
      effectiveEndDate
    )
    
    const duration = Date.now() - startTime
    
    // パフォーマンス記録
    await AuditService.logPerformanceMetrics('security_analysis', {
      duration_ms: duration,
      start_date: effectiveStartDate,
      end_date: effectiveEndDate,
      anomalies_found: securityAnalysis.anomalies.length,
      risk_score: securityAnalysis.riskScore
    })
    
    // 高リスクの場合は追加ログ記録
    if (securityAnalysis.riskScore > 50) {
      await AuditService.log({
        action: 'high_security_risk_detected',
        target: 'security_monitoring',
        actor_id: 'security_monitor',
        meta: {
          risk_score: securityAnalysis.riskScore,
          risk_factors: securityAnalysis.riskFactors,
          anomaly_count: securityAnalysis.anomalies.length,
          analysis_period: {
            start: effectiveStartDate,
            end: effectiveEndDate
          }
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...securityAnalysis,
        period: {
          start: effectiveStartDate,
          end: effectiveEndDate
        },
        summary: {
          analysisTime: duration,
          riskLevel: securityAnalysis.riskScore > 70 ? 'high' : 
                    securityAnalysis.riskScore > 30 ? 'medium' : 'low',
          actionRequired: securityAnalysis.riskScore > 50,
          anomalyCount: securityAnalysis.anomalies.length
        }
      },
      meta: {
        executionTime: duration,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('[AuditSecurityAPI] GET /security failed:', error)
    
    const duration = Date.now() - startTime
    
    // エラー記録
    await AuditService.log({
      action: 'security_analysis_failure',
      target: 'audit_api',
      actor_id: 'system',
      meta: {
        error: error instanceof Error ? error.message : String(error),
        duration_ms: duration
      }
    })
    
    return NextResponse.json(
      { 
        error: 'セキュリティ分析に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
