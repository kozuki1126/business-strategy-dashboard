/**
 * Optimized Database Helpers for Performance
 * Task #014: 性能・p95最適化実装 - N+1解消・効率的クエリ
 */

import { createClient } from '@/lib/supabase/server'
import { LRUCache } from 'lru-cache'
import { DashboardFilters } from '@/types/database.types'
import { performance } from 'perf_hooks'

// Multi-tier cache system
const queryCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
  allowStale: true
})

const masterDataCache = new LRUCache<string, any>({
  max: 100,
  ttl: 1000 * 60 * 60, // 1 hour for master data
  allowStale: true
})

const aggregationCache = new LRUCache<string, any>({
  max: 200,
  ttl: 1000 * 60 * 10, // 10 minutes for aggregations
  allowStale: true
})

/**
 * Performance measurement wrapper
 */
export async function measureQueryPerformance<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now()
  
  try {
    const result = await operation()
    const duration = performance.now() - startTime
    
    console.log(`[PERF] ${operationName}: ${duration.toFixed(2)}ms`)
    
    if (duration > 1000) {
      console.warn(`[SLOW QUERY] ${operationName}: ${duration.toFixed(2)}ms`)
    }
    
    return result
  } catch (error) {
    const duration = performance.now() - startTime
    console.error(`[QUERY ERROR] ${operationName} failed after ${duration.toFixed(2)}ms:`, error)
    throw error
  }
}

/**
 * Optimized analytics data fetcher with minimal N+1 queries
 */
export async function getOptimizedAnalyticsData(
  supabase: ReturnType<typeof createClient>,
  filters: DashboardFilters
) {
  const cacheKey = `analytics:${JSON.stringify(filters)}`
  
  // Try cache first
  const cached = queryCache.get(cacheKey)
  if (cached) {
    console.log(`[CACHE HIT] Analytics data: ${cacheKey}`)
    return cached
  }
  
  console.log(`[CACHE MISS] Analytics data: ${cacheKey}`)
  
  try {
    // Use parallel queries to minimize total time
    const [salesData, externalData] = await Promise.all([
      getOptimizedSalesData(supabase, filters),
      getOptimizedExternalData(supabase, filters)
    ])
    
    const result = {
      sales: salesData,
      marketData: externalData.marketData,
      weatherData: externalData.weatherData,
      events: externalData.events,
      meta: {
        generatedAt: new Date().toISOString(),
        filters: filters,
        recordCounts: {
          sales: salesData.length,
          market: externalData.marketData.length,
          weather: externalData.weatherData.length,
          events: externalData.events.length
        }
      }
    }
    
    // Cache the result
    queryCache.set(cacheKey, result)
    
    return result
    
  } catch (error) {
    console.error('Failed to get optimized analytics data:', error)
    throw new Error(`Analytics data fetch failed: ${error}`)
  }
}

/**
 * Optimized sales data with single query and joins
 */
async function getOptimizedSalesData(
  supabase: ReturnType<typeof createClient>,
  filters: DashboardFilters
) {
  const cacheKey = `sales:${JSON.stringify(filters)}`
  
  const cached = queryCache.get(cacheKey)
  if (cached) return cached
  
  try {
    // Single optimized query with all necessary joins
    let query = supabase
      .from('sales')
      .select(`
        date,
        store_id,
        department,
        product_category,
        revenue_ex_tax,
        footfall,
        transactions,
        discounts,
        tax,
        dim_store:store_id(id, name, region, prefecture),
        dim_department:department(id, name, description),
        dim_product_category:product_category(id, name, description)
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
      throw new Error(`Sales query failed: ${error.message}`)
    }
    
    const processedData = processSalesData(data || [])
    queryCache.set(cacheKey, processedData)
    
    return processedData
    
  } catch (error) {
    console.error('Optimized sales data fetch failed:', error)
    throw error
  }
}

/**
 * Optimized external data with parallel fetching
 */
async function getOptimizedExternalData(
  supabase: ReturnType<typeof createClient>,
  filters: DashboardFilters
) {
  const cacheKey = `external:${JSON.stringify(filters)}`
  
  const cached = queryCache.get(cacheKey)
  if (cached) return cached
  
  try {
    // Parallel fetch of external data
    const [marketData, weatherData, eventsData] = await Promise.all([
      // Market data
      supabase
        .from('ext_market_index')
        .select('*')
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: false })
        .limit(100),
      
      // Weather data
      supabase
        .from('ext_weather_daily')
        .select('*')
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: false })
        .limit(100),
      
      // Events data
      supabase
        .from('ext_events')
        .select('*')
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: false })
        .limit(200)
    ])
    
    // Check for errors
    if (marketData.error) throw marketData.error
    if (weatherData.error) throw weatherData.error
    if (eventsData.error) throw eventsData.error
    
    const result = {
      marketData: marketData.data || [],
      weatherData: weatherData.data || [],
      events: eventsData.data || []
    }
    
    queryCache.set(cacheKey, result)
    return result
    
  } catch (error) {
    console.error('External data fetch failed:', error)
    throw error
  }
}

/**
 * Process and aggregate sales data for better performance
 */
function processSalesData(rawData: any[]) {
  if (!rawData.length) return []
  
  // Group and aggregate data efficiently
  const aggregated = rawData.reduce((acc, row) => {
    const key = `${row.date}_${row.store_id}_${row.department}_${row.product_category}`
    
    if (!acc[key]) {
      acc[key] = {
        date: row.date,
        store_id: row.store_id,
        store_name: row.dim_store?.name || 'Unknown',
        store_region: row.dim_store?.region || 'Unknown',
        department: row.department,
        department_name: row.dim_department?.name || row.department,
        product_category: row.product_category,
        category_name: row.dim_product_category?.name || row.product_category,
        revenue_ex_tax: 0,
        revenue_inc_tax: 0,
        footfall: 0,
        transactions: 0,
        discounts: 0,
        count: 0
      }
    }
    
    // Aggregate values
    acc[key].revenue_ex_tax += Number(row.revenue_ex_tax) || 0
    acc[key].revenue_inc_tax += Number(row.revenue_ex_tax) + Number(row.tax) || 0
    acc[key].footfall += Number(row.footfall) || 0
    acc[key].transactions += Number(row.transactions) || 0
    acc[key].discounts += Number(row.discounts) || 0
    acc[key].count += 1
    
    return acc
  }, {} as Record<string, any>)
  
  // Convert back to array and add calculated fields
  return Object.values(aggregated).map((item: any) => ({
    ...item,
    average_transaction_value: item.transactions > 0 
      ? item.revenue_ex_tax / item.transactions 
      : 0,
    conversion_rate: item.footfall > 0 
      ? (item.transactions / item.footfall) * 100 
      : 0,
    discount_rate: item.revenue_ex_tax > 0 
      ? (item.discounts / item.revenue_ex_tax) * 100 
      : 0\n  }))
}

/**
 * Get optimized master data with long-term caching
 */
export async function getOptimizedMasterData(
  supabase: ReturnType<typeof createClient>
) {
  const cacheKey = 'master_data_all'
  
  const cached = masterDataCache.get(cacheKey)
  if (cached) {
    console.log('[CACHE HIT] Master data')
    return cached
  }
  
  console.log('[CACHE MISS] Master data')
  
  try {
    // Parallel fetch of all master data
    const [stores, departments, categories] = await Promise.all([
      supabase.from('dim_store').select('*').order('name'),
      supabase.from('dim_department').select('*').order('name'),
      supabase.from('dim_product_category').select('*').order('name')
    ])
    
    if (stores.error) throw stores.error
    if (departments.error) throw departments.error
    if (categories.error) throw categories.error
    
    const result = {
      stores: stores.data || [],
      departments: departments.data || [],
      productCategories: categories.data || [],
      lastUpdated: new Date().toISOString()
    }
    
    masterDataCache.set(cacheKey, result)
    return result
    
  } catch (error) {
    console.error('Master data fetch failed:', error)
    throw error
  }
}

/**
 * Optimized sales aggregation for KPI cards
 */
export async function getOptimizedSalesAggregation(
  supabase: ReturnType<typeof createClient>,
  filters: DashboardFilters
) {
  const cacheKey = `aggregation:${JSON.stringify(filters)}`
  
  const cached = aggregationCache.get(cacheKey)
  if (cached) return cached
  
  try {
    // Use database function for efficient aggregation
    const { data, error } = await supabase.rpc('get_sales_summary_optimized', {
      start_date: filters.dateRange.start,
      end_date: filters.dateRange.end,
      store_ids: filters.storeIds || null,
      departments: filters.departments || null,
      categories: filters.productCategories || null
    })
    
    if (error) {
      // Fallback to manual aggregation if function doesn't exist
      console.warn('Database function not available, using fallback aggregation')
      return await fallbackSalesAggregation(supabase, filters)
    }
    
    const processedData = processSalesAggregation(data || [])
    aggregationCache.set(cacheKey, processedData)
    
    return processedData
    
  } catch (error) {
    console.error('Sales aggregation failed:', error)
    // Return fallback aggregation
    return await fallbackSalesAggregation(supabase, filters)
  }
}

/**
 * Fallback sales aggregation when optimized function is not available
 */
async function fallbackSalesAggregation(
  supabase: ReturnType<typeof createClient>,
  filters: DashboardFilters
) {
  console.log('Using fallback sales aggregation')
  
  let query = supabase
    .from('sales')
    .select('date, revenue_ex_tax, footfall, transactions, discounts, tax')
    .gte('date', filters.dateRange.start)
    .lte('date', filters.dateRange.end)
  
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
  
  if (error) throw error
  
  return processSalesAggregation(data || [])
}

/**
 * Process sales aggregation data
 */
function processSalesAggregation(data: any[]) {
  if (!data.length) {
    return {
      totalRevenue: 0,
      totalFootfall: 0,
      totalTransactions: 0,
      averageTransactionValue: 0,
      conversionRate: 0,
      totalDiscounts: 0,
      recordCount: 0
    }
  }
  
  const totals = data.reduce((acc, row) => ({
    revenue: acc.revenue + (Number(row.revenue_ex_tax) || Number(row.total_revenue) || 0),
    footfall: acc.footfall + (Number(row.footfall) || Number(row.total_footfall) || 0),
    transactions: acc.transactions + (Number(row.transactions) || Number(row.total_transactions) || 0),
    discounts: acc.discounts + (Number(row.discounts) || 0)
  }), { revenue: 0, footfall: 0, transactions: 0, discounts: 0 })
  
  return {
    totalRevenue: totals.revenue,
    totalFootfall: totals.footfall,
    totalTransactions: totals.transactions,
    averageTransactionValue: totals.transactions > 0 ? totals.revenue / totals.transactions : 0,
    conversionRate: totals.footfall > 0 ? (totals.transactions / totals.footfall) * 100 : 0,
    totalDiscounts: totals.discounts,
    recordCount: data.length
  }
}

/**
 * Clear caches for specific operations
 */
export function clearOptimizedCaches(pattern?: string) {
  if (!pattern) {
    queryCache.clear()
    aggregationCache.clear()
    console.log('All caches cleared')
    return
  }
  
  // Clear specific cache entries by pattern
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key)
    }
  }
  
  for (const key of aggregationCache.keys()) {
    if (key.includes(pattern)) {
      aggregationCache.delete(key)
    }
  }
  
  console.log(`Caches cleared for pattern: ${pattern}`)
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats() {
  return {
    queryCache: {
      size: queryCache.size,
      maxSize: queryCache.max,
      hitRatio: queryCache.calculatedSize > 0 ? queryCache.hits / (queryCache.hits + queryCache.misses) : 0
    },
    masterDataCache: {
      size: masterDataCache.size,
      maxSize: masterDataCache.max,
      hitRatio: masterDataCache.calculatedSize > 0 ? masterDataCache.hits / (masterDataCache.hits + masterDataCache.misses) : 0
    },
    aggregationCache: {
      size: aggregationCache.size,
      maxSize: aggregationCache.max,
      hitRatio: aggregationCache.calculatedSize > 0 ? aggregationCache.hits / (aggregationCache.hits + aggregationCache.misses) : 0
    }
  }
}

/**
 * Warm up caches with common queries
 */
export async function warmUpCaches(supabase: ReturnType<typeof createClient>) {
  console.log('🔥 Warming up caches...')
  
  try {
    // Warm up master data
    await getOptimizedMasterData(supabase)
    
    // Warm up common date ranges
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const commonFilters = [
      // Last 7 days
      { dateRange: { start: weekAgo.toISOString().split('T')[0], end: today.toISOString().split('T')[0] } },
      // Last 30 days
      { dateRange: { start: monthAgo.toISOString().split('T')[0], end: today.toISOString().split('T')[0] } }
    ]
    
    for (const filters of commonFilters) {
      await getOptimizedAnalyticsData(supabase, filters)
      await getOptimizedSalesAggregation(supabase, filters)
    }
    
    console.log('✅ Cache warm-up completed')
    
  } catch (error) {
    console.error('❌ Cache warm-up failed:', error)
  }
}
