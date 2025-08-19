/**
 * ETL Scheduler API Endpoint
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: 外部API取得（06/12/18/22 JST）・データ正規化
 * Schedule: JST 06:00/12:00/18:00/22:00 (4 times daily)
 * Timeout: 10 minutes max
 * 
 * External Data Sources:
 * - Market indices (TOPIX, NIKKEI225, individual stocks)
 * - FX rates (USD/JPY, EUR/JPY, CNY/JPY)
 * - Weather data
 * - Local events (5km radius)
 * - STEM news (AI, semiconductor, robotics, biotech)
 * - Inbound tourism statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ETLService } from '@/lib/services/etl'
import { AuditService } from '@/lib/services/audit'
import { NotificationService } from '@/lib/services/notification'

export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const supabase = createClient()
  
  try {
    // Extract request metadata
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const runId = `etl-${Date.now()}`
    
    // Log ETL start
    await AuditService.log({
      action: 'etl_start',
      target: 'all_external_tables',
      meta: {
        run_id: runId,
        scheduled_time: new Date().toISOString(),
        user_agent: userAgent,
        ip: clientIP
      }
    })

    console.log(`[ETL] Starting ETL process ${runId} at ${new Date().toISOString()}`)

    // Initialize ETL service
    const etlService = new ETLService()
    
    // Execute ETL pipeline with timeout
    const results = await Promise.race([
      etlService.runFullETL(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('ETL timeout after 10 minutes')), 10 * 60 * 1000)
      )
    ]) as any

    const endTime = Date.now()
    const duration = endTime - startTime

    // Log successful completion
    await AuditService.log({
      action: 'etl_success',
      target: 'all_external_tables',
      meta: {
        run_id: runId,
        duration_ms: duration,
        results: results,
        completed_at: new Date().toISOString()
      }
    })

    // Send success notification
    await NotificationService.sendETLNotification({
      status: 'success',
      runId,
      duration,
      results
    })

    console.log(`[ETL] Completed successfully in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: 'ETL process completed successfully',
      data: {
        run_id: runId,
        duration_ms: duration,
        results: results,
        completed_at: new Date().toISOString()
      }
    })

  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error(`[ETL] Failed after ${duration}ms:`, error)

    // Log failure
    await AuditService.log({
      action: 'etl_failure',
      target: 'all_external_tables',
      meta: {
        error: errorMessage,
        duration_ms: duration,
        stack: error instanceof Error ? error.stack : undefined,
        failed_at: new Date().toISOString()
      }
    })

    // Send failure notification
    await NotificationService.sendETLNotification({
      status: 'failure',
      error: errorMessage,
      duration
    })

    return NextResponse.json({
      success: false,
      message: 'ETL process failed',
      error: errorMessage,
      data: {
        duration_ms: duration,
        failed_at: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

// Manual trigger endpoint for testing/debugging
export async function GET(request: NextRequest) {
  // Check for manual trigger authentication
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({
      success: false,
      message: 'Unauthorized: Bearer token required for manual ETL trigger'
    }, { status: 401 })
  }

  // For now, allow any bearer token in development
  // In production, validate against a specific ETL API key
  
  console.log('[ETL] Manual trigger requested')
  
  // Forward to POST handler
  return POST(request)
}
