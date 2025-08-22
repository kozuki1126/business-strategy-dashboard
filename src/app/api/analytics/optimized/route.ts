/**
 * Optimized Analytics API Endpoint for Task #014
 * High-Performance Analytics with Sub-Second Response Times
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyticsOptimizer, optimizeApiResponse } from '@/lib/performance/api-optimizations'
import { logAuditEvent } from '@/lib/services/audit'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth-server'
import { z } from 'zod'

// Validation schema for analytics requests
const analyticsRequestSchema = z.object({
  type: z.enum(['dashboard', 'correlation', 'export']).default('dashboard'),
  filters: z.object({
    dateRange: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }),
    storeIds: z.array(z.number()).optional(),
    departments: z.array(z.string()).optional(),
    productCategories: z.array(z.string()).optional()
  }),
  options: z.object({
    enableCache: z.boolean().default(true),
    enableCompression: z.boolean().default(true),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    maxExecutionTime: z.number().min(1000).max(30000).default(15000)
  }).optional()
})

interface PerformanceMetrics {
  executionTime: number
  cacheHit: boolean
  dataSize: number
  compressionRatio?: number
  queryOptimizations: string[]
  responseTime: number
}

/**
 * GET /api/analytics/optimized - High-performance analytics endpoint
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now()
  let performanceMetrics: PerformanceMetrics = {
    executionTime: 0,
    cacheHit: false,
    dataSize: 0,
    queryOptimizations: [],
    responseTime: 0
  }

  try {
    // Authentication check
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Parse and validate query parameters
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'dashboard'
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const storeIds = url.searchParams.get('storeIds')?.split(',').map(Number).filter(Boolean)
    const departments = url.searchParams.get('departments')?.split(',').filter(Boolean)
    const enableCache = url.searchParams.get('cache') !== 'false'

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate, endDate', code: 'MISSING_PARAMS' },
        { status: 400 }
      )
    }

    const requestData = {
      type: type as 'dashboard' | 'correlation' | 'export',
      filters: {
        dateRange: { start: startDate, end: endDate },
        ...(storeIds?.length && { storeIds }),
        ...(departments?.length && { departments })
      },
      options: {
        enableCache,
        enableCompression: true,
        priority: 'high' as const,
        maxExecutionTime: 15000
      }
    }

    // Validate request
    const validationResult = analyticsRequestSchema.safeParse(requestData)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request parameters', 
          details: validationResult.error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    const validatedRequest = validationResult.data

    // Execute optimized query based on type
    let result
    const queryStartTime = performance.now()

    switch (validatedRequest.type) {
      case 'dashboard':
        result = await analyticsOptimizer.getDashboardData(validatedRequest.filters)
        performanceMetrics.queryOptimizations.push('materialized_view', 'aggregation')
        break
      
      case 'correlation':
        result = await analyticsOptimizer.getCorrelationData(validatedRequest.filters)
        performanceMetrics.queryOptimizations.push('pre_computed_stats', 'correlation_matrix')
        break
      
      case 'export':
        result = await analyticsOptimizer.getExportData({
          ...validatedRequest.filters,
          format: 'csv',
          limit: 10000
        })
        performanceMetrics.queryOptimizations.push('streaming', 'batch_processing')
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid analytics type', code: 'INVALID_TYPE' },
          { status: 400 }
        )
    }

    // Update performance metrics
    performanceMetrics.executionTime = performance.now() - queryStartTime
    performanceMetrics.cacheHit = result.cached
    performanceMetrics.dataSize = result.metadata.dataSize
    performanceMetrics.compressionRatio = result.metadata.compressionRatio

    // Apply response optimizations
    const optimizedData = optimizeApiResponse(result.data, {
      enableCompression: validatedRequest.options?.enableCompression,
      enableMinification: true
    })

    // Log audit event (non-blocking)
    const supabase = createClient()
    logAuditEvent(
      supabase,
      'analytics_query',
      `analytics_${validatedRequest.type}`,
      {
        filters: validatedRequest.filters,
        executionTime: performanceMetrics.executionTime,
        cacheHit: performanceMetrics.cacheHit,
        dataSize: performanceMetrics.dataSize,
        queryOptimizations: performanceMetrics.queryOptimizations
      },
      user.id
    ).catch(console.error) // Don't let audit errors affect response

    // Final performance metrics
    performanceMetrics.responseTime = performance.now() - startTime

    // Check if performance targets are met
    const performanceAlert = performanceMetrics.responseTime > 1500 ? {
      warning: 'Response time exceeded 1500ms target',
      actualTime: Math.round(performanceMetrics.responseTime),
      suggestions: [
        'Consider reducing date range',
        'Add more specific filters',
        'Check database performance'
      ]
    } : null

    // Build response with metadata
    const response = {
      success: true,
      data: optimizedData,
      metadata: {
        type: validatedRequest.type,
        filters: validatedRequest.filters,
        performance: performanceMetrics,
        cacheStats: analyticsOptimizer.getCacheStats(),
        timestamp: new Date().toISOString()
      },
      ...(performanceAlert && { performanceAlert })
    }

    // Set performance headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Response-Time': Math.round(performanceMetrics.responseTime).toString(),
      'X-Cache-Status': performanceMetrics.cacheHit ? 'HIT' : 'MISS',
      'X-Data-Size': performanceMetrics.dataSize.toString(),
      'X-Query-Optimizations': performanceMetrics.queryOptimizations.join(',')
    })

    // Enable caching for GET requests
    if (performanceMetrics.cacheHit || performanceMetrics.responseTime < 1000) {
      headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    } else {
      headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
    }

    return NextResponse.json(response, { headers })

  } catch (error) {
    console.error('Analytics API error:', error)
    
    performanceMetrics.responseTime = performance.now() - startTime

    // Log error for monitoring
    const supabase = createClient()
    const user = await getCurrentUser().catch(() => null)
    
    if (user) {
      logAuditEvent(
        supabase,
        'analytics_error',
        'analytics_api',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: performanceMetrics.responseTime,
          stack: error instanceof Error ? error.stack : undefined
        },
        user.id
      ).catch(console.error)
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        metadata: {
          performance: performanceMetrics,
          timestamp: new Date().toISOString()
        }
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': Math.round(performanceMetrics.responseTime).toString(),
          'X-Error': 'true'
        }
      }
    )
  }
}

/**
 * POST /api/analytics/optimized - Batch analytics requests
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now()
  
  try {
    // Authentication check
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const batchRequestSchema = z.object({
      queries: z.array(z.object({
        id: z.string(),
        type: z.enum(['dashboard', 'correlation', 'export']),
        filters: z.object({
          dateRange: z.object({
            start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
          }),
          storeIds: z.array(z.number()).optional(),
          departments: z.array(z.string()).optional()
        }),
        priority: z.enum(['high', 'medium', 'low']).default('medium')
      })).min(1).max(10), // Limit batch size
      options: z.object({
        enableCache: z.boolean().default(true),
        enableCompression: z.boolean().default(true),
        maxExecutionTime: z.number().min(5000).max(60000).default(30000)
      }).optional()
    })

    const validationResult = batchRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid batch request', 
          details: validationResult.error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    const { queries, options } = validationResult.data

    // Execute batch queries with optimization
    const batchStartTime = performance.now()
    const batchResults = await analyticsOptimizer.batchOptimizedQueries(
      queries.map(q => ({
        type: q.type,
        filters: q.filters,
        priority: q.priority
      }))
    )

    // Process results
    const processedResults = Object.entries(batchResults).map(([key, result], index) => ({
      id: queries[index]?.id || key,
      success: true,
      data: optimizeApiResponse(result.data, options),
      metadata: {
        executionTime: result.executionTime,
        cacheHit: result.cached,
        dataSize: result.metadata.dataSize
      }
    }))

    const totalExecutionTime = performance.now() - batchStartTime
    const overallResponseTime = performance.now() - startTime

    // Log batch audit event
    const supabase = createClient()
    logAuditEvent(
      supabase,
      'analytics_batch',
      'analytics_api_batch',
      {
        queryCount: queries.length,
        totalExecutionTime,
        overallResponseTime,
        cacheStats: analyticsOptimizer.getCacheStats()
      },
      user.id
    ).catch(console.error)

    return NextResponse.json({
      success: true,
      results: processedResults,
      metadata: {
        batchSize: queries.length,
        totalExecutionTime,
        overallResponseTime,
        cacheStats: analyticsOptimizer.getCacheStats(),
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        'X-Batch-Size': queries.length.toString(),
        'X-Response-Time': Math.round(overallResponseTime).toString(),
        'X-Total-Execution-Time': Math.round(totalExecutionTime).toString()
      }
    })

  } catch (error) {
    console.error('Batch analytics API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        code: 'BATCH_ERROR',
        metadata: {
          responseTime: performance.now() - startTime,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
}

// Export for edge runtime compatibility
export const runtime = 'edge'
export const dynamic = 'force-dynamic'
