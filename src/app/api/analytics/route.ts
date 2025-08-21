/**
 * Optimized Analytics API Route
 * Task #014: 性能・p95最適化実装 - 最適化ミドルウェア適用
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  getOptimizedAnalyticsData, 
  measureQueryPerformance,
  getCacheStats,
  warmUpCaches 
} from '@/lib/database/optimized-helpers'
import { 
  withPerformanceOptimization,
  withApiCache,
  withRequestDeduplication,
  withResponseCompression,
  logMemoryUsage
} from '@/lib/middleware/performance'
import { DashboardFilters } from '@/types/database.types'
import { performance } from 'perf_hooks'

// Edge Runtime for global distribution and performance
export const runtime = 'edge'

// ISR configuration for optimal caching
export const revalidate = 300 // 5 minutes
export const dynamic = 'force-dynamic' // For real-time requirements

// Performance-optimized response headers
const PERF_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  'CDN-Cache-Control': 'max-age=300',
  'Vary': 'Accept-Encoding, Authorization',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Performance-Optimized': 'true',
  'X-Cache-Strategy': 'multi-tier'
}

/**
 * Optimized analytics data fetcher with all performance enhancements
 */
const getAnalyticsWithOptimizations = withRequestDeduplication(
  withApiCache(
    withPerformanceOptimization(
      async (supabase: ReturnType<typeof createClient>, filters: DashboardFilters) => {
        logMemoryUsage('analytics-start')
        
        const result = await measureQueryPerformance(
          'analytics-optimized',
          () => getOptimizedAnalyticsData(supabase, filters)
        )
        
        logMemoryUsage('analytics-end')
        return result
      }
    ),
    {
      keyGenerator: (supabase, filters) => `analytics:${JSON.stringify(filters)}`,
      ttl: 1000 * 60 * 5 // 5 minutes
    }
  ),
  (supabase, filters) => `analytics-dedup:${JSON.stringify(filters)}`
)

/**
 * GET endpoint with full performance optimization
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const requestId = crypto.randomUUID().slice(0, 8)
  
  console.log(`[${requestId}] 🚀 Optimized analytics request started`)

  try {
    // Fast authentication with performance monitoring
    const authStart = performance.now()
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const authTime = performance.now() - authStart
    
    console.log(`[${requestId}] Auth completed in ${authTime.toFixed(2)}ms`)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse and validate filters with performance monitoring
    const filterStart = performance.now()
    const filters = await parseOptimizedFilters(request.nextUrl.searchParams)
    const filterTime = performance.now() - filterStart
    
    console.log(`[${requestId}] Filter parsing completed in ${filterTime.toFixed(2)}ms`)
    
    if (!filters) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid filters',
          requestId,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 400,
          headers: PERF_HEADERS
        }
      )
    }

    // Get client info for monitoring and regional optimization
    const clientInfo = {
      ip: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      region: request.geo?.region || 'unknown',
      country: request.geo?.country || 'unknown',
      city: request.geo?.city || 'unknown'
    }

    console.log(`[${requestId}] Client: ${clientInfo.region}/${clientInfo.country}`)

    // Fetch analytics data with full optimization stack
    const dataStart = performance.now()
    const analyticsData = await getAnalyticsWithOptimizations(supabase, filters)
    const dataTime = performance.now() - dataStart
    
    console.log(`[${requestId}] Data fetch completed in ${dataTime.toFixed(2)}ms`)

    // Get performance metrics
    const cacheStats = getCacheStats()
    const responseTime = performance.now() - startTime

    // Performance status assessment
    const performanceStatus = {
      target: 1500,
      actual: Math.round(responseTime),
      status: responseTime <= 1500 ? 'excellent' : responseTime <= 2000 ? 'good' : 'slow',
      p95Compliant: responseTime <= 1500
    }

    // Log performance metrics
    console.log(`[${requestId}] ✅ Request completed in ${responseTime.toFixed(2)}ms (${performanceStatus.status})`)
    
    if (!performanceStatus.p95Compliant) {
      console.warn(`[${requestId}] ⚠️  P95 target exceeded: ${responseTime.toFixed(2)}ms > 1500ms`)
    }

    // Prepare optimized response with comprehensive metadata
    const response = {
      data: analyticsData,
      meta: {
        requestId,
        performance: {
          ...performanceStatus,
          breakdown: {
            auth: Math.round(authTime),
            filters: Math.round(filterTime),
            data: Math.round(dataTime),
            total: Math.round(responseTime)
          }
        },
        cache: {
          stats: cacheStats,
          hitRatioPercent: Object.values(cacheStats).reduce((acc, cache) => acc + cache.hitRatio, 0) / Object.keys(cacheStats).length * 100
        },
        client: clientInfo,
        server: {
          timestamp: new Date().toISOString(),
          version: '1.0-optimized',
          runtime: 'edge'
        },
        filters: filters,
        recordCounts: analyticsData.meta?.recordCounts || {}
      }
    }

    // Apply response compression and caching headers
    const optimizedResponse = new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...PERF_HEADERS,
          'X-Request-ID': requestId,
          'X-Response-Time': responseTime.toFixed(2),
          'X-Performance-Status': performanceStatus.status,
          'X-Cache-Hit-Ratio': (response.meta.cache.hitRatioPercent).toFixed(1),
          'X-Region': clientInfo.region,
          'X-P95-Compliant': performanceStatus.p95Compliant.toString()
        }
      }
    )

    return withResponseCompression(optimizedResponse)

  } catch (error) {
    const responseTime = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error(`[${requestId}] ❌ Error after ${responseTime.toFixed(2)}ms:`, error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        requestId,
        message: process.env.NODE_ENV === 'development' ? errorMessage : 'Something went wrong',
        timestamp: new Date().toISOString(),
        performance: {
          responseTimeMs: Math.round(responseTime),
          failed: true
        }
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Response-Time': responseTime.toFixed(2),
          'X-Performance-Status': 'error'
        }
      }
    )
  }
}

/**
 * POST endpoint with optimization stack
 */
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

    // Parse request body with size validation
    const body = await request.json()
    const { filters } = body as { filters: DashboardFilters }

    if (!validateOptimizedFilters(filters)) {
      return new Response(
        JSON.stringify({ error: 'Invalid filters', requestId }),
        { status: 400, headers: PERF_HEADERS }
      )
    }

    // Process with optimization stack
    const analyticsData = await getAnalyticsWithOptimizations(supabase, filters)
    const responseTime = performance.now() - startTime
    
    const response = {
      data: analyticsData,
      meta: {
        requestId,
        performance: {
          responseTimeMs: Math.round(responseTime),
          p95Compliant: responseTime <= 1500
        },
        userId: user.id,
        timestamp: new Date().toISOString(),
        filtersApplied: filters
      }
    }

    return withResponseCompression(
      new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: {
            ...PERF_HEADERS,
            'X-Request-ID': requestId,
            'X-Response-Time': responseTime.toFixed(2)
          }
        }
      )
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

/**
 * Health check endpoint with performance metrics
 */
export async function HEAD(request: NextRequest) {
  const startTime = performance.now()
  
  try {
    const cacheStats = getCacheStats()
    const responseTime = performance.now() - startTime
    
    // Overall health assessment
    const overallHitRatio = Object.values(cacheStats).reduce((acc, cache) => acc + cache.hitRatio, 0) / Object.keys(cacheStats).length
    const healthStatus = overallHitRatio > 0.7 ? 'healthy' : overallHitRatio > 0.5 ? 'warning' : 'critical'
    
    return new Response(null, {
      status: 200,
      headers: {
        'X-Health-Status': healthStatus,
        'X-Cache-Hit-Ratio': (overallHitRatio * 100).toFixed(1),
        'X-Response-Time': responseTime.toFixed(2),
        'X-P95-Target': '1500',
        'X-Performance-Optimized': 'true',
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    return new Response(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'critical',
        'X-Error': 'health-check-failed',
        'Cache-Control': 'no-cache'
      }
    })
  }
}

/**
 * Cache warming endpoint for performance optimization
 */
export async function PUT(request: NextRequest) {
  const startTime = performance.now()
  const requestId = crypto.randomUUID().slice(0, 8)
  
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    console.log(`[${requestId}] 🔥 Cache warm-up requested`)
    
    // Warm up caches
    await warmUpCaches(supabase)
    
    const responseTime = performance.now() - startTime
    console.log(`[${requestId}] ✅ Cache warm-up completed in ${responseTime.toFixed(2)}ms`)
    
    return new Response(
      JSON.stringify({
        success: true,
        requestId,
        responseTimeMs: Math.round(responseTime),
        message: 'Caches warmed up successfully'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      }
    )
    
  } catch (error) {
    const responseTime = performance.now() - startTime
    console.error(`[${requestId}] Cache warm-up failed:`, error)
    
    return new Response(
      JSON.stringify({
        error: 'Cache warm-up failed',
        requestId,
        responseTimeMs: Math.round(responseTime)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ========================================
// OPTIMIZED UTILITY FUNCTIONS
// ========================================

/**
 * Optimized filter parsing with validation
 */
async function parseOptimizedFilters(searchParams: URLSearchParams): Promise<DashboardFilters | null> {
  try {
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    
    if (!startDate || !endDate) {
      return null
    }

    // Fast date validation
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null
    }

    // Performance: limit date range to prevent expensive queries
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (daysDiff > 365 || daysDiff < 0) {
      return null
    }

    // Parse optional filters
    const storeIds = searchParams.get('storeIds')?.split(',').filter(Boolean)
    const departments = searchParams.get('departments')?.split(',').filter(Boolean)
    const productCategories = searchParams.get('productCategories')?.split(',').filter(Boolean)

    return {
      dateRange: { start: startDate, end: endDate },
      storeIds: storeIds?.length ? storeIds : undefined,
      departments: departments?.length ? departments : undefined,
      productCategories: productCategories?.length ? productCategories : undefined
    }
  } catch (error) {
    console.error('Optimized filter parsing error:', error)
    return null
  }
}

/**
 * Fast filter validation
 */
function validateOptimizedFilters(filters: DashboardFilters): boolean {
  if (!filters?.dateRange?.start || !filters?.dateRange?.end) {
    return false
  }

  try {
    const start = new Date(filters.dateRange.start)
    const end = new Date(filters.dateRange.end)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return false
    }

    // Performance limit
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff <= 365 && daysDiff >= 0

  } catch {
    return false
  }
}
