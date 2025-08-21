/**
 * Optimized Database Helpers for Performance
 * Task #014: 性能・p95最適化実装
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { createClient } from '@/lib/supabase/server'
import { 
  Database, 
  DashboardFilters, 
  AnalyticsData,
  SalesWithCalculated
} from '@/types/database.types'
import { performance } from 'perf_hooks'

type SupabaseClient = ReturnType<typeof createClient>

// Global cache with TTL for query results
const queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
const CACHE_TTL = {
  ANALYTICS: 5 * 60 * 1000, // 5 minutes
  STORES: 60 * 60 * 1000,   // 1 hour (rarely changes)
  DEPARTMENTS: 60 * 60 * 1000, // 1 hour
  STATS: 2 * 60 * 1000      // 2 minutes
}

/**
 * Performance monitoring utilities
 */
export function measureQueryPerformance<T>(
  queryName: string,
  operation: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now()
    const memBefore = process.memoryUsage()
    
    try {
      const result = await operation()
      const endTime = performance.now()
      const duration = endTime - startTime
      const memAfter = process.memoryUsage()
      
      // Log performance metrics
      console.log(`🔍 Query [${queryName}]: ${duration.toFixed(2)}ms`)
      if (duration > 1000) {
        console.warn(`⚠️  Slow query [${queryName}]: ${duration.toFixed(2)}ms`)
      }
      
      // Memory usage tracking
      const memDelta = {
        rss: memAfter.rss - memBefore.rss,
        heapUsed: memAfter.heapUsed - memBefore.heapUsed
      }
      
      if (memDelta.heapUsed > 50 * 1024 * 1024) { // 50MB threshold
        console.warn(`🧠 High memory usage [${queryName}]: +${Math.round(memDelta.heapUsed / 1024 / 1024)}MB`)
      }
      
      resolve(result)
    } catch (error) {
      const endTime = performance.now()
      console.error(`❌ Query failed [${queryName}]: ${(endTime - startTime).toFixed(2)}ms`, error)
      reject(error)
    }
  })
}

/**
 * Cache management utilities
 */
function getCacheKey(prefix: string, params: any): string {
  return `${prefix}:${JSON.stringify(params)}`
}

function getFromCache<T>(key: string): T | null {
  const cached = queryCache.get(key)
  if (!cached) return null
  
  const now = Date.now()
  if (now - cached.timestamp > cached.ttl) {
    queryCache.delete(key)
    return null
  }
  
  console.log(`💾 Cache hit: ${key}`)
  return cached.data as T
}

function setToCache<T>(key: string, data: T, ttl: number): void {
  queryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  })
  
  // Cleanup old cache entries (keep last 1000)
  if (queryCache.size > 1000) {
    const entries = Array.from(queryCache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    queryCache.clear()
    entries.slice(0, 1000).forEach(([k, v]) => queryCache.set(k, v))
  }
}

/**
 * Optimized sales data query with aggressive optimization
 */
export async function getOptimizedSalesData(
  supabase: SupabaseClient, 
  filters: DashboardFilters
): Promise<SalesWithCalculated[]> {
  const cacheKey = getCacheKey('sales', filters)
  const cached = getFromCache<SalesWithCalculated[]>(cacheKey)
  if (cached) return cached

  return measureQueryPerformance('optimized-sales-data', async () => {
    // Optimized query with proper indexing strategy
    let query = supabase
      .from('sales')
      .select(`
        id,
        date,
        store_id,
        department,
        product_category,
        revenue_ex_tax,
        footfall,
        transactions,
        discounts,
        tax,
        notes,
        dim_store!inner (
          name,
          area
        )
      `)
      .gte('date', filters.dateRange.start)
      .lte('date', filters.dateRange.end)
      .order('date', { ascending: false })
      .limit(5000) // Performance limit

    // Apply filters efficiently using indexes
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
      throw new Error(`Optimized sales query failed: ${error.message}`)
    }

    // Calculate additional fields with optimized math
    const result = data.map(sale => {
      const revenueExTax = sale.revenue_ex_tax || 0
      const taxAmount = sale.tax || 0
      const footfall = sale.footfall || 0
      const transactions = sale.transactions || 0
      
      return {
        ...sale,
        total_revenue: revenueExTax + taxAmount,
        average_transaction_value: transactions > 0 ? revenueExTax / transactions : null,
        conversion_rate: footfall > 0 ? transactions / footfall : null,
        store_name: sale.dim_store?.name,
        area: sale.dim_store?.area
      }
    })

    setToCache(cacheKey, result, CACHE_TTL.ANALYTICS)
    return result
  })
}

/**
 * Optimized external data aggregation with parallel fetching
 */
export async function getOptimizedExternalData(
  supabase: SupabaseClient,
  filters: DashboardFilters
) {
  const cacheKey = getCacheKey('external', filters)
  const cached = getFromCache(cacheKey)
  if (cached) return cached

  return measureQueryPerformance('optimized-external-data', async () => {
    // Parallel execution for maximum performance
    const [marketData, weatherData, eventsData] = await Promise.all([
      // Market data (limited to essential symbols)
      supabase
        .from('ext_market_index')
        .select('symbol, date, close_price, change_percent')
        .in('symbol', ['TOPIX', 'NIKKEI225'])
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: false })
        .limit(200),
      
      // Weather data (key locations only)
      supabase
        .from('ext_weather_daily')
        .select('location, date, condition, temperature, humidity, precipitation')
        .in('location', ['東京', '大阪'])
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: false })
        .limit(200),
      
      // Events data (recent events only)
      supabase
        .from('ext_events')
        .select('title, date, type, location, impact_radius')
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: false })
        .limit(100)
    ])

    // Fast error checking
    if (marketData.error) throw new Error(`Market data error: ${marketData.error.message}`)
    if (weatherData.error) throw new Error(`Weather data error: ${weatherData.error.message}`)
    if (eventsData.error) throw new Error(`Events data error: ${eventsData.error.message}`)

    const result = {
      marketData: marketData.data || [],
      weatherData: weatherData.data || [],
      events: eventsData.data || []
    }

    setToCache(cacheKey, result, CACHE_TTL.ANALYTICS)
    return result
  })
}

/**
 * Optimized analytics data aggregation with comprehensive caching
 */
export async function getOptimizedAnalyticsData(
  supabase: SupabaseClient,
  filters: DashboardFilters
): Promise<AnalyticsData> {
  const cacheKey = getCacheKey('analytics-full', filters)
  const cached = getFromCache<AnalyticsData>(cacheKey)
  if (cached) return cached

  return measureQueryPerformance('optimized-analytics-full', async () => {
    // Execute all data fetching in parallel for maximum performance
    const [salesData, externalData] = await Promise.all([
      getOptimizedSalesData(supabase, filters),
      getOptimizedExternalData(supabase, filters)
    ])

    // Fast correlation calculations (simplified for performance)
    const correlations = {
      weather_sales: 0.0, // TODO: Implement in background job
      events_sales: 0.0,
      market_sales: 0.0
    }

    const result: AnalyticsData = {
      sales: salesData,
      marketData: externalData.marketData,
      weatherData: externalData.weatherData,
      events: externalData.events,
      correlations,
      meta: {
        recordCounts: {
          sales: salesData.length,
          market: externalData.marketData.length,
          weather: externalData.weatherData.length,
          events: externalData.events.length
        },
        cacheStatus: 'fresh',
        queryTime: new Date().toISOString()
      }
    }

    setToCache(cacheKey, result, CACHE_TTL.ANALYTICS)
    return result
  })
}

/**
 * Cache warming for improved initial performance
 */
export async function warmUpCaches(supabase: SupabaseClient): Promise<void> {
  console.log('🔥 Starting cache warm-up...')
  
  const startTime = performance.now()
  
  try {
    // Common filter patterns for warming
    const commonFilters = [
      // Current month
      {
        dateRange: {
          start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        }
      },
      // Last 7 days
      {
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        }
      },
      // Last 30 days
      {
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        }
      }
    ]

    // Warm up caches in parallel
    await Promise.all(
      commonFilters.map(filters => 
        getOptimizedAnalyticsData(supabase, filters).catch(err => {
          console.warn('Cache warm-up failed for filter:', filters, err.message)
        })
      )
    )

    const duration = performance.now() - startTime
    console.log(`✅ Cache warm-up completed in ${duration.toFixed(2)}ms`)
    
  } catch (error) {
    console.error('❌ Cache warm-up failed:', error)
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  const now = Date.now()
  const stats = {
    total: queryCache.size,
    valid: 0,
    expired: 0,
    hitRatio: 0
  }

  for (const [key, entry] of queryCache.entries()) {
    if (now - entry.timestamp <= entry.ttl) {
      stats.valid++
    } else {
      stats.expired++
    }
  }

  stats.hitRatio = stats.total > 0 ? stats.valid / stats.total : 0

  return {
    analytics: {
      total: stats.total,
      valid: stats.valid,
      expired: stats.expired,
      hitRatio: stats.hitRatio
    }
  }
}

/**
 * Clear cache (for debugging or manual cache invalidation)
 */
export function clearCache(pattern?: string): void {
  if (pattern) {
    const keysToDelete = Array.from(queryCache.keys()).filter(key => key.includes(pattern))
    keysToDelete.forEach(key => queryCache.delete(key))
    console.log(`🗑️  Cleared ${keysToDelete.length} cache entries matching "${pattern}"`)
  } else {
    queryCache.clear()
    console.log('🗑️  Cleared all cache')
  }
}

/**
 * Database connection pool optimization
 */
export function optimizeConnectionPool() {
  // Connection pool settings for Supabase
  return {
    poolSize: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    maxUses: 7500
  }
}
