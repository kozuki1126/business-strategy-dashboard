/**
 * Edge-Optimized API Routes for High Performance
 * Task #014: 性能・p95最適化実装 - CDN・Edge・圧縮最適化
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOptimizedAnalyticsData, measureQueryPerformance } from '@/lib/database/optimized-helpers'
import { CacheHealthMonitor } from '@/lib/cache/server-cache'
import { DashboardFilters } from '@/types/database.types'

// Edge Runtime for global distribution
export const runtime = 'edge'

// Cache configuration for CDN
export const revalidate = 300 // 5 minutes ISR
export const dynamic = 'force-dynamic' // For real-time data

// Response compression and headers
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  'CDN-Cache-Control': 'max-age=300',
  'Vercel-CDN-Cache-Control': 'max-age=300',
  'Content-Encoding': 'gzip',
  'Vary': 'Accept-Encoding, Authorization',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
}

// ========================================
// EDGE-OPTIMIZED ANALYTICS ENDPOINT
// ========================================

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const requestId = crypto.randomUUID().slice(0, 8)
  
  console.log(`[${requestId}] Analytics request started`)

  try {
    // Fast authentication check
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      )
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams
    const filters = await parseAndValidateFilters(searchParams)
    
    if (!filters) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid filters',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400,
          headers: RESPONSE_HEADERS
        }
      )
    }

    // Get client info for monitoring
    const clientInfo = {
      ip: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      region: request.geo?.region || 'unknown',
      country: request.geo?.country || 'unknown'
    }

    console.log(`[${requestId}] Client: ${clientInfo.region}, ${clientInfo.country}`)

    // Fetch analytics data with performance monitoring
    const analyticsData = await measureQueryPerformance(
      `analytics-${requestId}`,
      () => getOptimizedAnalyticsData(supabase, filters)
    )

    // Get cache health for monitoring
    const cacheHealth = CacheHealthMonitor.getHealthMetrics()

    const responseTime = performance.now() - startTime
    console.log(`[${requestId}] Request completed in ${responseTime.toFixed(2)}ms`)

    // Prepare optimized response
    const response = {
      data: analyticsData,
      meta: {
        requestId,
        responseTimeMs: Math.round(responseTime),
        userId: user.id,
        timestamp: new Date().toISOString(),
        filtersApplied: filters,
        cacheHealth: {
          hitRatio: cacheHealth.hitRatio,
          overall: cacheHealth.overall
        },
        client: clientInfo,
        performance: {
          target: 1500,
          actual: Math.round(responseTime),
          status: responseTime <= 1500 ? 'good' : 'slow'
        }
      }
    }

    // Log successful request
    console.log(`[${requestId}] Success - Cache hit ratio: ${(cacheHealth.hitRatio * 100).toFixed(1)}%`)

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...RESPONSE_HEADERS,
          'X-Request-ID': requestId,
          'X-Response-Time': responseTime.toFixed(2),
          'X-Cache-Status': cacheHealth.overall,
          'X-Region': clientInfo.region
        }
      }
    )

  } catch (error) {
    const responseTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error(`[${requestId}] Error after ${responseTime.toFixed(2)}ms:`, error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        requestId,
        message: process.env.NODE_ENV === 'development' ? errorMessage : 'Something went wrong',
        timestamp: new Date().toISOString(),
        responseTimeMs: Math.round(responseTime)
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Response-Time': responseTime.toFixed(2)
        }
      }
    )
  }
}

// ========================================
// EDGE-OPTIMIZED POST ENDPOINT
// ========================================

export async function POST(request: NextRequest) {
  const startTime = performance.now()
  const requestId = crypto.randomUUID().slice(0, 8)

  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', requestId }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body with size limit
    const body = await request.json()
    const { filters } = body as { filters: DashboardFilters }

    if (!validateFilters(filters)) {
      return new Response(
        JSON.stringify({ error: 'Invalid filters', requestId }),
        { status: 400, headers: RESPONSE_HEADERS }
      )
    }

    // Process request
    const analyticsData = await measureQueryPerformance(
      `analytics-post-${requestId}`,
      () => getOptimizedAnalyticsData(supabase, filters)
    )

    const responseTime = performance.now() - startTime
    const response = {
      data: analyticsData,
      meta: {
        requestId,
        responseTimeMs: Math.round(responseTime),
        userId: user.id,
        timestamp: new Date().toISOString(),
        filtersApplied: filters
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...RESPONSE_HEADERS,
          'X-Request-ID': requestId,
          'X-Response-Time': responseTime.toFixed(2)
        }
      }
    )

  } catch (error) {
    const responseTime = performance.now() - startTime
    console.error(`[${requestId}] POST Error:`, error)
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        requestId,
        responseTimeMs: Math.round(responseTime)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

async function parseAndValidateFilters(searchParams: URLSearchParams): Promise<DashboardFilters | null> {
  try {
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    
    if (!startDate || !endDate) {
      return null
    }

    // Validate date format and range
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null
    }

    // Limit date range to prevent abuse
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 365) { // Max 1 year
      return null
    }

    const storeIds = searchParams.get('storeIds')?.split(',').filter(Boolean)
    const departments = searchParams.get('departments')?.split(',').filter(Boolean)
    const productCategories = searchParams.get('productCategories')?.split(',').filter(Boolean)

    return {
      dateRange: { 
        start: startDate, 
        end: endDate 
      },
      storeIds: storeIds?.length ? storeIds : undefined,
      departments: departments?.length ? departments : undefined,
      productCategories: productCategories?.length ? productCategories : undefined
    }
  } catch (error) {
    console.error('Filter parsing error:', error)
    return null
  }
}

function validateFilters(filters: DashboardFilters): boolean {
  if (!filters?.dateRange?.start || !filters?.dateRange?.end) {
    return false
  }

  try {
    const start = new Date(filters.dateRange.start)
    const end = new Date(filters.dateRange.end)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false
    }

    if (start >= end) {
      return false
    }

    // Additional validation rules
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 365) {
      return false
    }

    return true
  } catch {
    return false
  }
}

// ========================================
// HEALTH CHECK ENDPOINT
// ========================================

export async function HEAD(request: NextRequest) {
  const startTime = performance.now()
  
  try {
    // Quick health check
    const cacheHealth = CacheHealthMonitor.getHealthMetrics()
    const responseTime = performance.now() - startTime
    
    return new Response(null, {
      status: 200,
      headers: {
        'X-Health-Status': cacheHealth.overall,
        'X-Cache-Hit-Ratio': (cacheHealth.hitRatio * 100).toFixed(1),
        'X-Response-Time': responseTime.toFixed(2),
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'critical',
        'Cache-Control': 'no-cache'
      }
    })
  }
}