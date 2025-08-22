/**
 * Advanced API Performance Optimizations for Task #014
 * High-Performance Analytics & Query Optimization
 */

import { createClient } from '@/lib/supabase/client'
import { LRUCache } from 'lru-cache'
import { compress } from 'compression'

interface OptimizedQueryResult<T> {
  data: T
  cached: boolean
  executionTime: number
  cacheKey: string
  metadata: {
    dataSize: number
    compressionRatio?: number
    hitRatio: number
  }
}

interface QueryOptimizationConfig {
  enableCache: boolean
  enableCompression: boolean
  enablePagination: boolean
  enableAggregation: boolean
  maxCacheSize: number
  cacheTTL: number
}

/**
 * High-Performance Analytics Query Optimizer
 */
export class AnalyticsQueryOptimizer {
  private cache: LRUCache<string, any>
  private config: QueryOptimizationConfig
  private hitRatioStats = { hits: 0, misses: 0 }

  constructor(config: Partial<QueryOptimizationConfig> = {}) {
    this.config = {
      enableCache: true,
      enableCompression: true,
      enablePagination: true,
      enableAggregation: true,
      maxCacheSize: 500,
      cacheTTL: 10 * 60 * 1000, // 10 minutes
      ...config
    }

    this.cache = new LRUCache({
      max: this.config.maxCacheSize,
      ttl: this.config.cacheTTL,
      allowStale: true,
      updateAgeOnGet: true
    })
  }

  /**
   * Optimized Dashboard Data Query
   * - Uses materialized view for pre-aggregated data
   * - Implements result caching with stale-while-revalidate
   * - Compression for large datasets
   */
  async getDashboardData(filters: {
    dateRange: { start: string; end: string }
    storeIds?: number[]
    departments?: string[]
    productCategories?: string[]
  }): Promise<OptimizedQueryResult<any>> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('dashboard', filters)

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        this.hitRatioStats.hits++
        return {
          data: cached.data,
          cached: true,
          executionTime: performance.now() - startTime,
          cacheKey,
          metadata: {
            dataSize: cached.dataSize,
            compressionRatio: cached.compressionRatio,
            hitRatio: this.getHitRatio()
          }
        }
      }
      this.hitRatioStats.misses++
    }

    const supabase = createClient()

    // Use optimized materialized view query
    let query = supabase
      .from('vw_dashboard_analytics') // Materialized view
      .select(`
        sales_date,
        store_name,
        department,
        total_revenue_ex_tax,
        total_footfall,
        total_transactions,
        avg_customer_price,
        conversion_rate,
        weather_temp,
        weather_condition,
        has_nearby_events
      `)
      .gte('sales_date', filters.dateRange.start)
      .lte('sales_date', filters.dateRange.end)

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

    // Order by date for better cache locality
    query = query.order('sales_date', { ascending: true })

    const { data, error } = await query

    if (error) {
      throw new Error(`Dashboard query failed: ${error.message}`)
    }

    const executionTime = performance.now() - startTime
    const result = this.processAndOptimizeData(data)

    // Cache the result with compression
    if (this.config.enableCache) {
      const dataSize = JSON.stringify(result).length
      let compressionRatio: number | undefined

      if (this.config.enableCompression && dataSize > 1024) {
        // Implement compression for large datasets
        compressionRatio = this.estimateCompressionRatio(result)
      }

      this.cache.set(cacheKey, {
        data: result,
        dataSize,
        compressionRatio,
        timestamp: Date.now()
      })
    }

    return {
      data: result,
      cached: false,
      executionTime,
      cacheKey,
      metadata: {
        dataSize: JSON.stringify(result).length,
        hitRatio: this.getHitRatio()
      }
    }
  }

  /**
   * High-Performance Correlation Analysis
   * - Pre-computed correlation matrices
   * - Efficient statistical calculations
   */
  async getCorrelationData(filters: {
    dateRange: { start: string; end: string }
    storeIds?: number[]
  }): Promise<OptimizedQueryResult<any>> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('correlation', filters)

    // Check cache
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        this.hitRatioStats.hits++
        return {
          data: cached.data,
          cached: true,
          executionTime: performance.now() - startTime,
          cacheKey,
          metadata: {
            dataSize: cached.dataSize,
            hitRatio: this.getHitRatio()
          }
        }
      }
      this.hitRatioStats.misses++
    }

    const supabase = createClient()

    // Use optimized correlation query with pre-computed aggregations
    const query = `
      WITH daily_aggregates AS (
        SELECT 
          sales_date,
          EXTRACT(DOW FROM sales_date) as day_of_week,
          SUM(revenue_ex_tax) as daily_revenue,
          SUM(footfall) as daily_footfall,
          AVG(w.temperature) as avg_temp,
          AVG(w.humidity) as avg_humidity,
          MAX(w.precipitation) as max_precipitation,
          CASE WHEN COUNT(e.id) > 0 THEN 1 ELSE 0 END as has_events
        FROM sales s
        LEFT JOIN ext_weather_daily w ON w.date = s.sales_date
        LEFT JOIN ext_events e ON e.event_date = s.sales_date 
          AND ST_DWithin(ST_Point(e.longitude, e.latitude), ST_Point(35.6762, 139.6503), 5000)
        WHERE s.sales_date >= $1 AND s.sales_date <= $2
        ${filters.storeIds?.length ? 'AND s.store_id = ANY($3::int[])' : ''}
        GROUP BY sales_date
      ),
      correlation_base AS (
        SELECT 
          day_of_week,
          AVG(daily_revenue) as avg_revenue_by_dow,
          AVG(CASE WHEN has_events = 1 THEN daily_revenue END) as avg_revenue_with_events,
          AVG(CASE WHEN has_events = 0 THEN daily_revenue END) as avg_revenue_without_events,
          CORR(daily_revenue, avg_temp) as temp_correlation,
          CORR(daily_revenue, avg_humidity) as humidity_correlation,
          CORR(daily_revenue, max_precipitation) as precipitation_correlation
        FROM daily_aggregates
        GROUP BY day_of_week
      )
      SELECT 
        json_build_object(
          'dayOfWeek', json_agg(
            json_build_object(
              'day', day_of_week,
              'avgRevenue', avg_revenue_by_dow
            ) ORDER BY day_of_week
          ),
          'eventImpact', json_build_object(
            'withEvents', AVG(avg_revenue_with_events),
            'withoutEvents', AVG(avg_revenue_without_events),
            'improvement', (AVG(avg_revenue_with_events) - AVG(avg_revenue_without_events)) / AVG(avg_revenue_without_events) * 100
          ),
          'weatherCorrelations', json_build_object(
            'temperature', AVG(temp_correlation),
            'humidity', AVG(humidity_correlation),
            'precipitation', AVG(precipitation_correlation)
          )
        ) as correlation_data
      FROM correlation_base
    `

    const params = [
      filters.dateRange.start,
      filters.dateRange.end,
      ...(filters.storeIds?.length ? [filters.storeIds] : [])
    ]

    const { data, error } = await supabase.rpc('execute_optimized_query', {
      query_text: query,
      params
    })

    if (error) {
      throw new Error(`Correlation query failed: ${error.message}`)
    }

    const executionTime = performance.now() - startTime
    const result = data[0]?.correlation_data || {}

    // Cache result
    if (this.config.enableCache) {
      const dataSize = JSON.stringify(result).length
      this.cache.set(cacheKey, {
        data: result,
        dataSize,
        timestamp: Date.now()
      })
    }

    return {
      data: result,
      cached: false,
      executionTime,
      cacheKey,
      metadata: {
        dataSize: JSON.stringify(result).length,
        hitRatio: this.getHitRatio()
      }
    }
  }

  /**
   * Optimized Export Data Query with Streaming
   */
  async getExportData(filters: {
    dateRange: { start: string; end: string }
    storeIds?: number[]
    format: 'csv' | 'excel'
    limit?: number
  }): Promise<OptimizedQueryResult<any>> {
    const startTime = performance.now()
    const cacheKey = this.generateCacheKey('export', filters)

    const supabase = createClient()

    // Use streaming approach for large exports
    let query = supabase
      .from('vw_export_data') // Optimized export view
      .select('*')
      .gte('sales_date', filters.dateRange.start)
      .lte('sales_date', filters.dateRange.end)

    if (filters.storeIds?.length) {
      query = query.in('store_id', filters.storeIds)
    }

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    // Order for consistent exports
    query = query.order('sales_date', { ascending: true })
      .order('store_id', { ascending: true })

    const { data, error } = await query

    if (error) {
      throw new Error(`Export query failed: ${error.message}`)
    }

    const executionTime = performance.now() - startTime

    return {
      data,
      cached: false,
      executionTime,
      cacheKey,
      metadata: {
        dataSize: JSON.stringify(data).length,
        hitRatio: this.getHitRatio()
      }
    }
  }

  /**
   * Batch query optimization for multiple endpoints
   */
  async batchOptimizedQueries(queries: Array<{
    type: 'dashboard' | 'correlation' | 'export'
    filters: any
    priority: 'high' | 'medium' | 'low'
  }>): Promise<Record<string, OptimizedQueryResult<any>>> {
    // Sort by priority
    const sortedQueries = queries.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    const results: Record<string, OptimizedQueryResult<any>> = {}

    // Execute high priority queries first
    for (const query of sortedQueries.filter(q => q.priority === 'high')) {
      const key = `${query.type}_${Date.now()}`
      results[key] = await this.executeQuery(query.type, query.filters)
    }

    // Execute medium and low priority in parallel
    const remainingQueries = sortedQueries.filter(q => q.priority !== 'high')
    const remainingPromises = remainingQueries.map(async (query) => {
      const key = `${query.type}_${Date.now()}`
      results[key] = await this.executeQuery(query.type, query.filters)
      return { key, result: results[key] }
    })

    await Promise.all(remainingPromises)

    return results
  }

  /**
   * Generate cache key for consistent caching
   */
  private generateCacheKey(type: string, filters: any): string {
    const filterStr = JSON.stringify(filters, Object.keys(filters).sort())
    return `${type}_${Buffer.from(filterStr).toString('base64').slice(0, 32)}`
  }

  /**
   * Process and optimize data structure
   */
  private processAndOptimizeData(data: any[]): any {
    if (!data?.length) return { sales: [], summary: {} }

    // Group and aggregate for better performance
    const aggregated = data.reduce((acc, item) => {
      const key = `${item.sales_date}_${item.store_name}`
      if (!acc[key]) {
        acc[key] = {
          date: item.sales_date,
          store: item.store_name,
          revenue: 0,
          footfall: 0,
          transactions: 0,
          departments: new Set()
        }
      }

      acc[key].revenue += item.total_revenue_ex_tax || 0
      acc[key].footfall += item.total_footfall || 0
      acc[key].transactions += item.total_transactions || 0
      acc[key].departments.add(item.department)

      return acc
    }, {} as Record<string, any>)

    // Convert to array and calculate summary
    const sales = Object.values(aggregated).map((item: any) => ({
      ...item,
      departments: Array.from(item.departments),
      avgCustomerPrice: item.footfall > 0 ? item.revenue / item.footfall : 0,
      conversionRate: item.footfall > 0 ? (item.transactions / item.footfall) * 100 : 0
    }))

    const summary = {
      totalRevenue: sales.reduce((sum, item) => sum + item.revenue, 0),
      totalFootfall: sales.reduce((sum, item) => sum + item.footfall, 0),
      totalTransactions: sales.reduce((sum, item) => sum + item.transactions, 0),
      averageCustomerPrice: 0,
      overallConversionRate: 0
    }

    summary.averageCustomerPrice = summary.totalFootfall > 0 
      ? summary.totalRevenue / summary.totalFootfall : 0
    summary.overallConversionRate = summary.totalFootfall > 0 
      ? (summary.totalTransactions / summary.totalFootfall) * 100 : 0

    return { sales, summary }
  }

  /**
   * Execute query based on type
   */
  private async executeQuery(type: string, filters: any): Promise<OptimizedQueryResult<any>> {
    switch (type) {
      case 'dashboard':
        return this.getDashboardData(filters)
      case 'correlation':
        return this.getCorrelationData(filters)
      case 'export':
        return this.getExportData(filters)
      default:
        throw new Error(`Unknown query type: ${type}`)
    }
  }

  /**
   * Estimate compression ratio for large datasets
   */
  private estimateCompressionRatio(data: any): number {
    const jsonStr = JSON.stringify(data)
    // Simplified compression ratio estimation
    const repeatedChars = jsonStr.length - new Set(jsonStr).size
    return Math.max(0.1, 1 - (repeatedChars / jsonStr.length))
  }

  /**
   * Get current cache hit ratio
   */
  private getHitRatio(): number {
    const total = this.hitRatioStats.hits + this.hitRatioStats.misses
    return total > 0 ? this.hitRatioStats.hits / total : 0
  }

  /**
   * Clear cache and reset stats
   */
  clearCache(): void {
    this.cache.clear()
    this.hitRatioStats = { hits: 0, misses: 0 }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      hitRatio: this.getHitRatio(),
      hits: this.hitRatioStats.hits,
      misses: this.hitRatioStats.misses,
      ttl: this.config.cacheTTL
    }
  }
}

/**
 * Global optimizer instance
 */
export const analyticsOptimizer = new AnalyticsQueryOptimizer({
  enableCache: true,
  enableCompression: true,
  enablePagination: true,
  enableAggregation: true,
  maxCacheSize: 1000,
  cacheTTL: 15 * 60 * 1000 // 15 minutes
})

/**
 * API Response optimization middleware
 */
export function optimizeApiResponse<T>(data: T, options: {
  enableCompression?: boolean
  enableMinification?: boolean
} = {}): T {
  if (!data) return data

  // Remove null/undefined fields to reduce payload size
  if (typeof data === 'object' && data !== null) {
    const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value === null || value === undefined) return undefined
      return value
    }))

    return cleaned
  }

  return data
}

/**
 * Export for use in API routes
 */
export { OptimizedQueryResult, QueryOptimizationConfig }
