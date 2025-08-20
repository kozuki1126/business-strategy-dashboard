/**
 * Optimized Database Helpers for High Performance
 * Task #014: 性能・p95最適化実装 - N+1解消・クエリ最適化
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { createClient } from '@/lib/supabase/server'
import { 
  Database, 
  SalesWithCalculated, 
  DashboardFilters, 
  AnalyticsData,
  WeatherCondition,
  EventType,
  STEMCategory,
  AuditAction
} from '@/types/database.types'
import { 
  CacheAsideStrategy, 
  StaleWhileRevalidateStrategy,
  getCachedMasterData,
  getCachedExternalData 
} from '@/lib/cache/server-cache'

type SupabaseClient = ReturnType<typeof createClient>

// ========================================
// OPTIMIZED ANALYTICS FUNCTIONS
// ========================================

/**
 * Optimized Analytics Data Fetching
 * - Eliminates N+1 queries through JOIN optimization
 * - Implements parallel data fetching
 * - Adds server-side caching with SWR
 * - Includes aggregation optimization
 */
export async function getOptimizedAnalyticsData(
  supabase: SupabaseClient,
  filters: DashboardFilters
): Promise<AnalyticsData> {
  const startTime = performance.now()

  try {
    // Use cache-aside strategy with 5-minute TTL
    return await CacheAsideStrategy.get(
      'analytics-data',
      { filters },
      async () => {
        // Parallel data fetching for optimal performance
        const [salesData, marketData, weatherData, eventsData, correlations] = await Promise.all([
          getOptimizedSalesData(supabase, filters),
          getCachedMarketData(supabase, ['TOPIX', 'NIKKEI225'], filters.dateRange),
          getCachedWeatherData(supabase, ['東京', '大阪'], filters.dateRange),
          getCachedEventsData(supabase, filters.dateRange),
          calculateOptimizedCorrelations(supabase, filters)
        ])

        const result: AnalyticsData = {
          sales: salesData,
          marketData,
          weatherData,
          events: eventsData,
          correlations
        }

        console.log(`Analytics data fetched in ${performance.now() - startTime}ms`)
        return result
      },
      { ttl: 5 * 60 * 1000 } // 5 minutes TTL
    )
  } catch (error) {
    console.error('Analytics data fetch failed:', error)
    throw new Error(`Failed to fetch analytics data: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Optimized Sales Data with Single JOIN Query
 * Eliminates N+1 problem by fetching all related data in one query
 */
async function getOptimizedSalesData(
  supabase: SupabaseClient, 
  filters: DashboardFilters
): Promise<SalesWithCalculated[]> {
  const startTime = performance.now()

  // Build optimized query with all JOINs in single request
  let query = supabase
    .from('sales')
    .select(`
      *,
      dim_store!inner (
        id,
        name,
        area,
        lat,
        lng
      )
    `)
    .gte('date', filters.dateRange.start)
    .lte('date', filters.dateRange.end)
    .order('date', { ascending: false })

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
    throw new Error(`Optimized sales query failed: ${error.message}`)
  }

  // Optimized calculation with minimal memory allocation
  const result = data.map(sale => {
    const revenueExTax = sale.revenue_ex_tax || 0
    const tax = sale.tax || 0
    const transactions = sale.transactions || 0
    const footfall = sale.footfall || 0

    return {
      ...sale,
      total_revenue: revenueExTax + tax,
      average_transaction_value: transactions > 0 ? revenueExTax / transactions : null,
      conversion_rate: footfall > 0 ? transactions / footfall : null,
      store_name: sale.dim_store?.name,
      area: sale.dim_store?.area
    }
  })

  console.log(`Optimized sales data fetched in ${performance.now() - startTime}ms`)
  return result
}

/**
 * Cached Market Data with Stale-While-Revalidate
 */
async function getCachedMarketData(
  supabase: SupabaseClient,
  symbols: string[],
  dateRange: { start: string; end: string }
) {
  return await StaleWhileRevalidateStrategy.get(
    'market-data',
    { symbols, dateRange },
    async () => {
      const { data, error } = await supabase
        .from('ext_market_index')
        .select('*')
        .in('symbol', symbols)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false })

      if (error) {
        throw new Error(`Market data fetch failed: ${error.message}`)
      }

      return data
    },
    { ttl: 10 * 60 * 1000 } // 10 minutes TTL
  )
}

/**
 * Cached Weather Data with Background Refresh
 */
async function getCachedWeatherData(
  supabase: SupabaseClient,
  locations: string[],
  dateRange: { start: string; end: string }
) {
  return await StaleWhileRevalidateStrategy.get(
    'weather-data',
    { locations, dateRange },
    async () => {
      const { data, error } = await supabase
        .from('ext_weather_daily')
        .select('*')
        .in('location', locations)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false })

      if (error) {
        throw new Error(`Weather data fetch failed: ${error.message}`)
      }

      return data
    },
    { ttl: 15 * 60 * 1000 } // 15 minutes TTL
  )
}

/**
 * Cached Events Data
 */
async function getCachedEventsData(
  supabase: SupabaseClient,
  dateRange: { start: string; end: string }
) {
  return await CacheAsideStrategy.get(
    'events-data',
    { dateRange },
    async () => {
      const { data, error } = await supabase
        .from('ext_events')
        .select('*')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false })

      if (error) {
        throw new Error(`Events data fetch failed: ${error.message}`)
      }

      return data
    },
    { ttl: 30 * 60 * 1000 } // 30 minutes TTL
  )
}

/**
 * Optimized Correlation Calculations
 * Performs calculations on database level for better performance
 */
async function calculateOptimizedCorrelations(
  supabase: SupabaseClient,
  filters: DashboardFilters
) {
  return await CacheAsideStrategy.get(
    'correlations',
    { filters },
    async () => {
      // Use database aggregation functions for correlation calculation
      const { data: correlationData, error } = await supabase
        .rpc('calculate_sales_correlations', {
          start_date: filters.dateRange.start,
          end_date: filters.dateRange.end,
          store_ids: filters.storeIds || null
        })

      if (error) {
        console.warn('Correlation calculation failed, using defaults:', error)
        return {
          weather_sales: 0.0,
          events_sales: 0.0,
          market_sales: 0.0
        }
      }

      return correlationData || {
        weather_sales: 0.0,
        events_sales: 0.0,
        market_sales: 0.0
      }
    },
    { ttl: 15 * 60 * 1000 } // 15 minutes TTL
  )
}

// ========================================
// OPTIMIZED STORE OPERATIONS
// ========================================

/**
 * Bulk Store Performance with Single Query
 * Replaces multiple individual queries with aggregated approach
 */
export async function getOptimizedStorePerformance(
  supabase: SupabaseClient,
  dateRange: { start: string; end: string }
) {
  return await CacheAsideStrategy.get(
    'store-performance',
    { dateRange },
    async () => {
      // Use database aggregation for optimal performance
      const { data, error } = await supabase
        .rpc('get_store_performance_summary', {
          start_date: dateRange.start,
          end_date: dateRange.end
        })

      if (error) {
        throw new Error(`Store performance query failed: ${error.message}`)
      }

      return data
    },
    { ttl: 10 * 60 * 1000 } // 10 minutes TTL
  )
}

/**
 * Cached Master Data with Long TTL
 */
export async function getOptimizedMasterData(
  supabase: SupabaseClient,
  type: 'stores' | 'departments' | 'categories'
) {
  return await getCachedMasterData(type)
}

// ========================================
// OPTIMIZED EXPORT FUNCTIONS
// ========================================

/**
 * Streaming Export for Large Datasets
 * Processes data in chunks to avoid memory issues
 */
export async function getOptimizedExportData(
  supabase: SupabaseClient,
  filters: DashboardFilters,
  chunkSize: number = 1000
) {
  const result: any[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        dim_store!inner (name, area)
      `)
      .gte('date', filters.dateRange.start)
      .lte('date', filters.dateRange.end)
      .range(offset, offset + chunkSize - 1)
      .order('date', { ascending: false })

    if (error) {
      throw new Error(`Export data chunk failed: ${error.message}`)
    }

    if (data.length === 0) {
      hasMore = false
    } else {
      // Process chunk with optimized mapping
      const processedChunk = data.map(sale => ({
        '日付': sale.date,
        '店舗名': sale.dim_store?.name || 'Unknown',
        'エリア': sale.dim_store?.area || 'Unknown',
        '部門': sale.department || '',
        '商品カテゴリ': sale.product_category || '',
        '税抜売上': sale.revenue_ex_tax || 0,
        '客数': sale.footfall || 0,
        '取引数': sale.transactions || 0,
        '割引': sale.discounts || 0,
        '税額': sale.tax || 0,
        '総売上': (sale.revenue_ex_tax || 0) + (sale.tax || 0),
        '平均単価': sale.transactions > 0 ? ((sale.revenue_ex_tax || 0) / sale.transactions).toFixed(2) : '',
        '転換率': sale.footfall > 0 ? `${((sale.transactions || 0) / sale.footfall * 100).toFixed(2)}%` : '',
        '備考': sale.notes || ''
      }))

      result.push(...processedChunk)
      offset += chunkSize

      if (data.length < chunkSize) {
        hasMore = false
      }
    }
  }

  return result
}

// ========================================
// PERFORMANCE MONITORING FUNCTIONS
// ========================================

/**
 * Query Performance Monitor
 */
export async function measureQueryPerformance<T>(
  queryName: string,
  query: () => Promise<T>
): Promise<T> {
  const startTime = performance.now()
  
  try {
    const result = await query()
    const duration = performance.now() - startTime
    
    console.log(`Query [${queryName}] completed in ${duration.toFixed(2)}ms`)
    
    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query detected [${queryName}]: ${duration.toFixed(2)}ms`)
    }
    
    return result
  } catch (error) {
    const duration = performance.now() - startTime
    console.error(`Query [${queryName}] failed after ${duration.toFixed(2)}ms:`, error)
    throw error
  }
}

/**
 * Database Connection Pool Monitor
 */
export function getDatabaseMetrics() {
  // This would integrate with Supabase monitoring APIs
  return {
    activeConnections: 0, // Placeholder
    queryQueueLength: 0,
    averageQueryTime: 0,
    errorRate: 0
  }
}

// ========================================
// BATCH PROCESSING UTILITIES
// ========================================

/**
 * Batch Processing for Bulk Operations
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 100
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }
  
  return results
}

/**
 * Parallel Processing with Concurrency Limit
 */
export async function processParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchPromises = batch.map(processor)
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
  }
  
  return results
}

// ========================================
// LEGACY COMPATIBILITY LAYER
// ========================================

// Maintain backward compatibility while gradually migrating to optimized versions
export {
  getOptimizedAnalyticsData as getAnalyticsData,
  getOptimizedStorePerformance as getStorePerformanceComparison,
  getOptimizedExportData as prepareSalesExportData
}

// Re-export other functions that don't need immediate optimization
export {
  logAuditEvent,
  getAuditLogs,
  getAllStores,
  getAllDepartments,
  getDistinctProductCategories,
  validateSalesInput
} from '@/lib/database/helpers'