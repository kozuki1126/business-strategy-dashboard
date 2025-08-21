/**
 * API Performance Middleware
 * Task #014: 性能・p95最適化実装 - API応答最適化・N+1解消
 */

import { NextRequest, NextResponse } from 'next/server'
import { LRUCache } from 'lru-cache'
import { createClient } from '@/lib/supabase/server'
import { performance } from 'perf_hooks'

// Performance monitoring cache
const performanceCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 15, // 15 minutes
  allowStale: true
})

// Query result cache for expensive operations
const queryCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes for real-time data
  allowStale: true
})

// Batch request handler to prevent N+1 queries
class BatchRequestHandler {
  private batches = new Map<string, {
    requests: Array<{ resolve: Function, reject: Function, params: any }>,
    timer: NodeJS.Timeout | null
  }>()

  /**
   * Batch similar requests together to reduce N+1 queries
   */
  async batchRequest<T>(
    key: string,
    params: any,
    executor: (batchParams: any[]) => Promise<T[]>,
    batchDelay: number = 10
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.batches.has(key)) {
        this.batches.set(key, {
          requests: [],
          timer: null
        })
      }

      const batch = this.batches.get(key)!
      batch.requests.push({ resolve, reject, params })

      // Clear existing timer if any
      if (batch.timer) {
        clearTimeout(batch.timer)
      }

      // Set new timer for batch execution
      batch.timer = setTimeout(async () => {
        const requests = [...batch.requests]
        batch.requests.length = 0
        batch.timer = null

        try {
          const batchParams = requests.map(req => req.params)
          const results = await executor(batchParams)
          
          requests.forEach((req, index) => {
            req.resolve(results[index])
          })
        } catch (error) {
          requests.forEach(req => {
            req.reject(error)
          })
        }
      }, batchDelay)
    })
  }
}

const batchHandler = new BatchRequestHandler()

/**
 * Performance monitoring and optimization middleware
 */
export function withPerformanceOptimization<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const startTime = performance.now()
    const requestId = Math.random().toString(36).substr(2, 9)
    
    try {
      console.log(`[${requestId}] API request started`)
      
      const result = await handler(...args)
      
      const duration = performance.now() - startTime
      console.log(`[${requestId}] API request completed in ${duration.toFixed(2)}ms`)
      
      // Track performance metrics
      if (duration > 1500) {
        console.warn(`[${requestId}] Slow API response: ${duration.toFixed(2)}ms`)
      }
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`[${requestId}] API request failed in ${duration.toFixed(2)}ms`, error)
      throw error
    }
  }
}

/**
 * Cache-aware API wrapper
 */
export function withApiCache<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  options: {
    keyGenerator: (...args: T) => string
    ttl?: number
    cache?: LRUCache<string, any>
  }
) {
  const cache = options.cache || queryCache
  
  return async (...args: T): Promise<R> => {
    const cacheKey = options.keyGenerator(...args)
    
    // Try to get from cache
    const cached = cache.get(cacheKey)
    if (cached) {
      console.log(`Cache hit for key: ${cacheKey}`)
      return cached
    }
    
    console.log(`Cache miss for key: ${cacheKey}`)
    
    // Execute handler and cache result
    const result = await handler(...args)
    cache.set(cacheKey, result, { ttl: options.ttl })
    
    return result
  }
}

/**
 * Optimized sales data fetcher with N+1 prevention
 */
export const optimizedSalesDataFetcher = withApiCache(
  withPerformanceOptimization(
    async (filters: {
      dateRange: { start: string, end: string }
      storeIds?: string[]
      departments?: string[]
      productCategories?: string[]
    }) => {
      const supabase = createClient()
      
      // Build optimized query with joins to prevent N+1
      let query = supabase
        .from('sales')
        .select(`
          *,
          dim_store:store_id(id, name, region),
          dim_department:department(id, name),
          dim_product_category:product_category(id, name)
        `)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
      
      // Apply filters efficiently
      if (filters.storeIds?.length) {
        query = query.in('store_id', filters.storeIds)
      }
      
      if (filters.departments?.length) {
        query = query.in('department', filters.departments)
      }
      
      if (filters.productCategories?.length) {
        query = query.in('product_category', filters.productCategories)
      }
      
      const { data, error } = await query
      
      if (error) {
        throw new Error(`Sales data fetch failed: ${error.message}`)
      }
      
      return data || []
    }
  ),
  {
    keyGenerator: (filters) => `sales:${JSON.stringify(filters)}`,
    ttl: 1000 * 60 * 5 // 5 minutes
  }
)

/**
 * Optimized analytics data aggregator
 */
export const optimizedAnalyticsAggregator = withApiCache(
  withPerformanceOptimization(
    async (filters: any) => {
      const supabase = createClient()
      
      // Use database functions for efficient aggregation
      const { data: salesSummary, error: salesError } = await supabase
        .rpc('get_sales_summary_optimized', {
          start_date: filters.dateRange.start,
          end_date: filters.dateRange.end,
          store_ids: filters.storeIds || null,
          departments: filters.departments || null,
          categories: filters.productCategories || null
        })
      
      if (salesError) {
        throw new Error(`Sales summary failed: ${salesError.message}`)
      }
      
      // Batch external data fetching
      const [marketData, weatherData, events] = await Promise.all([
        batchHandler.batchRequest(
          'market_data',
          { dateRange: filters.dateRange },
          async (batchParams) => {
            const { data } = await supabase
              .from('ext_market_index')
              .select('*')
              .gte('date', filters.dateRange.start)
              .lte('date', filters.dateRange.end)
              .order('date', { ascending: false })
            return [data || []]
          }
        ),
        
        batchHandler.batchRequest(
          'weather_data',
          { dateRange: filters.dateRange },
          async (batchParams) => {
            const { data } = await supabase
              .from('ext_weather_daily')
              .select('*')
              .gte('date', filters.dateRange.start)
              .lte('date', filters.dateRange.end)
              .order('date', { ascending: false })
            return [data || []]
          }
        ),
        
        batchHandler.batchRequest(
          'events_data',
          { dateRange: filters.dateRange },
          async (batchParams) => {
            const { data } = await supabase
              .from('ext_events')
              .select('*')
              .gte('date', filters.dateRange.start)
              .lte('date', filters.dateRange.end)
              .order('date', { ascending: false })
            return [data || []]
          }
        )
      ])
      
      return {
        sales: salesSummary || [],
        marketData: marketData || [],
        weatherData: weatherData || [],
        events: events || []
      }
    }
  ),
  {
    keyGenerator: (filters) => `analytics:${JSON.stringify(filters)}`,
    ttl: 1000 * 60 * 10 // 10 minutes
  }
)

/**
 * Database function creation for optimized queries
 */
export async function createOptimizedDatabaseFunctions() {
  const supabase = createClient()
  
  // Create optimized sales summary function
  const salesSummaryFunction = `
    CREATE OR REPLACE FUNCTION get_sales_summary_optimized(
      start_date DATE,
      end_date DATE,
      store_ids TEXT[] DEFAULT NULL,
      departments TEXT[] DEFAULT NULL,
      categories TEXT[] DEFAULT NULL
    )
    RETURNS TABLE (
      date DATE,
      store_id TEXT,
      store_name TEXT,
      department TEXT,
      product_category TEXT,
      total_revenue DECIMAL,
      total_footfall INTEGER,
      total_transactions INTEGER,
      avg_transaction_value DECIMAL
    )
    LANGUAGE SQL
    STABLE
    AS $$
      SELECT 
        s.date,
        s.store_id,
        st.name as store_name,
        s.department,
        s.product_category,
        SUM(s.revenue_ex_tax) as total_revenue,
        SUM(s.footfall) as total_footfall,
        SUM(s.transactions) as total_transactions,
        CASE 
          WHEN SUM(s.transactions) > 0 
          THEN SUM(s.revenue_ex_tax) / SUM(s.transactions)
          ELSE 0 
        END as avg_transaction_value
      FROM sales s
      JOIN dim_store st ON s.store_id = st.id
      WHERE s.date >= start_date 
        AND s.date <= end_date
        AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
        AND (departments IS NULL OR s.department = ANY(departments))
        AND (categories IS NULL OR s.product_category = ANY(categories))
      GROUP BY s.date, s.store_id, st.name, s.department, s.product_category
      ORDER BY s.date DESC, s.store_id, s.department, s.product_category;
    $$;
  `
  
  // Create performance monitoring function
  const performanceMonitorFunction = `
    CREATE OR REPLACE FUNCTION check_slo_compliance(
      time_window_minutes INTEGER DEFAULT 60
    )
    RETURNS JSON
    LANGUAGE SQL
    STABLE
    AS $$
      SELECT json_build_object(
        'metrics', json_build_object(
          'availability', COALESCE(
            (SELECT 
              (COUNT(*) FILTER (WHERE action != 'error') * 100.0) / NULLIF(COUNT(*), 0)
             FROM audit_log 
             WHERE created_at >= NOW() - (time_window_minutes || ' minutes')::INTERVAL
            ), 100.0
          ),
          'p95_response_time', COALESCE(
            (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY 
              CAST(meta->>'response_time' AS NUMERIC)
            )
             FROM audit_log 
             WHERE created_at >= NOW() - (time_window_minutes || ' minutes')::INTERVAL
               AND meta->>'response_time' IS NOT NULL
            ), 1000.0
          ),
          'error_rate', COALESCE(
            (SELECT 
              (COUNT(*) FILTER (WHERE action = 'error') * 100.0) / NULLIF(COUNT(*), 0)
             FROM audit_log 
             WHERE created_at >= NOW() - (time_window_minutes || ' minutes')::INTERVAL
            ), 0.0
          )
        )
      );
    $$;
  `
  
  try {
    await supabase.rpc('execute_sql', { sql: salesSummaryFunction })
    await supabase.rpc('execute_sql', { sql: performanceMonitorFunction })
    console.log('✅ Optimized database functions created')
  } catch (error) {
    console.log('⚠️  Database function creation skipped:', error)
  }
}

/**
 * Response compression middleware
 */
export function withResponseCompression(response: NextResponse) {
  // Add compression headers for better performance
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  response.headers.set('Vary', 'Accept-Encoding')
  
  // Add performance headers
  response.headers.set('X-Performance-Optimized', 'true')
  response.headers.set('X-Cache-Strategy', 'multi-tier')
  
  return response
}

/**
 * Request deduplication for identical concurrent requests
 */
const pendingRequests = new Map<string, Promise<any>>()

export function withRequestDeduplication<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string
) {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args)
    
    // If identical request is already pending, return the same promise
    if (pendingRequests.has(key)) {
      console.log(`Deduplicating request: ${key}`)
      return pendingRequests.get(key)!
    }
    
    // Execute the request and cache the promise
    const promise = handler(...args).finally(() => {
      pendingRequests.delete(key)
    })
    
    pendingRequests.set(key, promise)
    return promise
  }
}

/**
 * Memory usage monitoring
 */
export function logMemoryUsage(context: string) {
  if (process.env.NODE_ENV === 'development') {
    const usage = process.memoryUsage()
    console.log(`[${context}] Memory Usage:`, {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`
    })
  }
}

/**
 * Export optimized data fetchers for use in API routes
 */
export {
  performanceCache,
  queryCache,
  batchHandler
}
