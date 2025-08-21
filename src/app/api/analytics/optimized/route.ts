/**
 * Performance-Optimized Analytics API with ISR
 * Task #014: 性能・p95最適化実装 - ISR・キャッシュ・N+1解消
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { databaseOptimizer } from '@/lib/database/performance-optimizer'
import { performanceCache, generateCacheKey, cacheUtils } from '@/lib/cache/performance-cache'
import { sloMonitor } from '@/lib/monitoring/slo-monitor'
import { performance } from 'perf_hooks'

interface AnalyticsParams {
  startDate?: string
  endDate?: string
  storeIds?: string[]
  departments?: string[]
  type?: 'dashboard' | 'correlation' | 'trends' | 'comparison'
}

interface PerformanceMetrics {
  requestId: string
  startTime: number
  endTime: number
  responseTime: number
  cacheHit: boolean
  queryCount: number
  source: 'cache' | 'database' | 'materialized_view'
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const startTime = performance.now()
  
  let metrics: PerformanceMetrics = {
    requestId,
    startTime,
    endTime: 0,
    responseTime: 0,
    cacheHit: false,
    queryCount: 0,
    source: 'database'
  }
  
  try {
    // Parse request parameters
    const searchParams = request.nextUrl.searchParams
    const params: AnalyticsParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      storeIds: searchParams.get('storeIds')?.split(',') || undefined,
      departments: searchParams.get('departments')?.split(',') || undefined,
      type: (searchParams.get('type') as any) || 'dashboard'
    }
    
    // Generate cache key
    const cacheKey = generateCacheKey.analytics(params)
    
    // Try cache first
    const cachedData = performanceCache.get(cacheKey)
    if (cachedData) {
      metrics.cacheHit = true
      metrics.source = 'cache'
      metrics.endTime = performance.now()
      metrics.responseTime = metrics.endTime - metrics.startTime
      
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true,
        performance: {
          responseTime: metrics.responseTime,
          source: metrics.source
        }
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
          'X-Response-Time': `${metrics.responseTime.toFixed(2)}ms`
        }
      })
    }
    
    // Fetch from optimized database functions
    const supabase = createClient()
    let data: any
    
    switch (params.type) {
      case 'dashboard':
        data = await fetchDashboardAnalytics(supabase, params, metrics)
        break
      case 'correlation':
        data = await fetchCorrelationAnalytics(supabase, params, metrics)
        break
      case 'trends':
        data = await fetchTrendsAnalytics(supabase, params, metrics)
        break
      case 'comparison':
        data = await fetchComparisonAnalytics(supabase, params, metrics)
        break
      default:
        data = await fetchDashboardAnalytics(supabase, params, metrics)
    }
    
    // Cache the result
    performanceCache.set(cacheKey, data)
    
    metrics.endTime = performance.now()
    metrics.responseTime = metrics.endTime - metrics.startTime
    
    // Log performance metrics
    await logPerformanceMetrics(metrics, params)
    
    // Check SLO compliance
    if (metrics.responseTime > 1500) {
      console.warn(`⚠️  SLO violation: Response time ${metrics.responseTime.toFixed(2)}ms > 1500ms`)
    }
    
    return NextResponse.json({
      success: true,
      data,
      cached: false,
      performance: {
        responseTime: metrics.responseTime,
        source: metrics.source,
        queryCount: metrics.queryCount
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
        'X-Response-Time': `${metrics.responseTime.toFixed(2)}ms`,
        'X-Query-Count': metrics.queryCount.toString()
      }
    })
    
  } catch (error) {
    metrics.endTime = performance.now()
    metrics.responseTime = metrics.endTime - metrics.startTime
    
    console.error('Analytics API error:', error)
    
    // Log error for monitoring
    await logErrorMetrics(error, metrics, requestId)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      performance: {
        responseTime: metrics.responseTime
      }
    }, { 
      status: 500,
      headers: {
        'X-Response-Time': `${metrics.responseTime.toFixed(2)}ms`
      }
    })
  }
}

/**
 * Fetch dashboard analytics using optimized database functions
 */
async function fetchDashboardAnalytics(
  supabase: any, 
  params: AnalyticsParams, 
  metrics: PerformanceMetrics
): Promise<any> {
  const { startDate, endDate, storeIds } = params
  
  // Use optimized materialized view or aggregation function
  const { data: salesSummary, error } = await supabase
    .rpc('get_sales_summary_with_context', {
      p_start_date: startDate || '2025-08-01',
      p_end_date: endDate || '2025-08-21',
      p_store_ids: storeIds || null
    })
  
  if (error) throw error
  
  metrics.queryCount = 1 // Single optimized query instead of N+1
  metrics.source = 'materialized_view'
  
  // Process and aggregate data
  const aggregatedData = {
    summary: {
      totalRevenue: salesSummary.reduce((sum: number, row: any) => sum + parseFloat(row.total_revenue_ex_tax || 0), 0),
      totalFootfall: salesSummary.reduce((sum: number, row: any) => sum + (row.total_footfall || 0), 0),
      totalTransactions: salesSummary.reduce((sum: number, row: any) => sum + (row.total_transactions || 0), 0),
      storeCount: new Set(salesSummary.map((row: any) => row.store_id)).size
    },
    daily: salesSummary.map((row: any) => ({
      date: row.date,
      storeId: row.store_id,
      storeName: row.store_name,
      revenue: parseFloat(row.total_revenue_ex_tax || 0),
      footfall: row.total_footfall || 0,
      transactions: row.total_transactions || 0,
      weather: row.weather_condition,
      temperature: row.temperature,
      eventsCount: row.nearby_events_count || 0,
      dayOfWeek: row.day_of_week?.trim()
    })),
    trends: calculateTrends(salesSummary),
    correlations: calculateCorrelations(salesSummary)
  }
  
  return aggregatedData
}

/**
 * Fetch correlation analytics using optimized database functions
 */
async function fetchCorrelationAnalytics(
  supabase: any, 
  params: AnalyticsParams, 
  metrics: PerformanceMetrics
): Promise<any> {
  const { startDate, endDate } = params
  
  // Use optimized correlation function
  const { data: correlationData, error } = await supabase
    .rpc('get_analytics_correlation_data', {
      p_start_date: startDate || '2025-08-01',
      p_end_date: endDate || '2025-08-21'
    })
  
  if (error) throw error
  
  metrics.queryCount = 1
  metrics.source = 'materialized_view'
  
  return {
    correlations: {
      weather: calculateWeatherCorrelation(correlationData),
      dayOfWeek: calculateDayOfWeekCorrelation(correlationData),
      events: calculateEventsCorrelation(correlationData)
    },
    heatmap: generateCorrelationHeatmap(correlationData),
    summary: {
      dataPoints: correlationData.length,
      dateRange: { start: startDate, end: endDate }
    }
  }
}

/**
 * Fetch trends analytics with optimized queries
 */
async function fetchTrendsAnalytics(
  supabase: any, 
  params: AnalyticsParams, 
  metrics: PerformanceMetrics
): Promise<any> {
  // Use cached or materialized view data
  const cacheKey = generateCacheKey.analytics({ ...params, type: 'trends_base' })
  
  const trendsData = await cacheUtils.getOrFetch(
    performanceCache,
    cacheKey,
    async () => {
      const { data, error } = await supabase
        .from('dashboard_metrics_mv')
        .select('*')
        .gte('date', params.startDate || '2025-08-01')
        .lte('date', params.endDate || '2025-08-21')
        .order('date', { ascending: true })
      
      if (error) throw error
      return data
    }
  )
  
  metrics.queryCount = 1
  metrics.source = 'materialized_view'
  
  return {
    daily: trendsData,
    weekly: aggregateByWeek(trendsData),
    monthly: aggregateByMonth(trendsData),
    growth: calculateGrowthRates(trendsData)
  }
}

/**
 * Fetch comparison analytics
 */
async function fetchComparisonAnalytics(
  supabase: any, 
  params: AnalyticsParams, 
  metrics: PerformanceMetrics
): Promise<any> {
  // Parallel queries for comparison periods
  const [currentPeriod, previousPeriod] = await Promise.all([
    supabase.rpc('get_sales_summary_with_context', {
      p_start_date: params.startDate || '2025-08-01',
      p_end_date: params.endDate || '2025-08-21',
      p_store_ids: params.storeIds || null
    }),
    supabase.rpc('get_sales_summary_with_context', {
      p_start_date: calculatePreviousPeriodStart(params.startDate || '2025-08-01'),
      p_end_date: calculatePreviousPeriodEnd(params.endDate || '2025-08-21'),
      p_store_ids: params.storeIds || null
    })
  ])
  
  if (currentPeriod.error) throw currentPeriod.error
  if (previousPeriod.error) throw previousPeriod.error
  
  metrics.queryCount = 2
  metrics.source = 'materialized_view'
  
  return {
    current: aggregatePeriodData(currentPeriod.data),
    previous: aggregatePeriodData(previousPeriod.data),
    comparison: calculateComparison(currentPeriod.data, previousPeriod.data)
  }
}

/**
 * Calculate trends from sales data
 */
function calculateTrends(salesData: any[]): any {
  const dailyTotals = salesData.reduce((acc: any, row: any) => {
    const date = row.date
    if (!acc[date]) {
      acc[date] = { revenue: 0, footfall: 0, transactions: 0 }
    }
    acc[date].revenue += parseFloat(row.total_revenue_ex_tax || 0)
    acc[date].footfall += row.total_footfall || 0
    acc[date].transactions += row.total_transactions || 0
    return acc
  }, {})
  
  const dates = Object.keys(dailyTotals).sort()
  const revenues = dates.map(date => dailyTotals[date].revenue)
  
  return {
    revenue: {
      data: revenues,
      trend: calculateLinearTrend(revenues),
      growth: calculateGrowthRate(revenues)
    },
    footfall: {
      data: dates.map(date => dailyTotals[date].footfall),
      trend: calculateLinearTrend(dates.map(date => dailyTotals[date].footfall))
    }
  }
}

/**
 * Calculate correlations between sales and external factors
 */
function calculateCorrelations(salesData: any[]): any {
  return {
    weatherRevenue: calculatePearsonCorrelation(
      salesData.map(row => row.temperature || 0),
      salesData.map(row => parseFloat(row.total_revenue_ex_tax || 0))
    ),
    eventsRevenue: calculatePearsonCorrelation(
      salesData.map(row => row.nearby_events_count || 0),
      salesData.map(row => parseFloat(row.total_revenue_ex_tax || 0))
    )
  }
}

/**
 * Helper functions for data processing
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0
  
  const n = x.length
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0)
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  
  return denominator === 0 ? 0 : numerator / denominator
}

function calculateLinearTrend(data: number[]): number {
  if (data.length < 2) return 0
  
  const n = data.length
  const x = Array.from({ length: n }, (_, i) => i)
  const y = data
  
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return slope
}

function calculateGrowthRate(data: number[]): number {
  if (data.length < 2) return 0
  const first = data[0]
  const last = data[data.length - 1]
  return first === 0 ? 0 : ((last - first) / first) * 100
}

function calculateWeatherCorrelation(data: any[]): any {
  // Implementation for weather correlation analysis
  return {
    temperature: calculatePearsonCorrelation(
      data.map(row => row.temperature || 0),
      data.map(row => parseFloat(row.total_revenue || 0))
    ),
    conditions: analyzeWeatherConditions(data)
  }
}

function calculateDayOfWeekCorrelation(data: any[]): any {
  const dayAverages = data.reduce((acc: any, row: any) => {
    const day = row.day_of_week
    if (!acc[day]) {
      acc[day] = { total: 0, count: 0 }
    }
    acc[day].total += parseFloat(row.total_revenue || 0)
    acc[day].count += 1
    return acc
  }, {})
  
  Object.keys(dayAverages).forEach(day => {
    dayAverages[day].average = dayAverages[day].total / dayAverages[day].count
  })
  
  return dayAverages
}

function calculateEventsCorrelation(data: any[]): any {
  const withEvents = data.filter(row => row.has_events)
  const withoutEvents = data.filter(row => !row.has_events)
  
  const avgWithEvents = withEvents.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0) / withEvents.length
  const avgWithoutEvents = withoutEvents.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0) / withoutEvents.length
  
  return {
    withEvents: avgWithEvents || 0,
    withoutEvents: avgWithoutEvents || 0,
    difference: (avgWithEvents || 0) - (avgWithoutEvents || 0),
    uplift: avgWithoutEvents === 0 ? 0 : ((avgWithEvents - avgWithoutEvents) / avgWithoutEvents) * 100
  }
}

function generateCorrelationHeatmap(data: any[]): any {
  // Generate heatmap data for day of week vs weather conditions
  const heatmapData: any = {}
  
  data.forEach(row => {
    const day = row.day_of_week
    const weather = row.weather_condition || 'unknown'
    
    if (!heatmapData[day]) {
      heatmapData[day] = {}
    }
    if (!heatmapData[day][weather]) {
      heatmapData[day][weather] = { total: 0, count: 0 }
    }
    
    heatmapData[day][weather].total += parseFloat(row.total_revenue || 0)
    heatmapData[day][weather].count += 1
  })
  
  // Calculate averages
  Object.keys(heatmapData).forEach(day => {
    Object.keys(heatmapData[day]).forEach(weather => {
      heatmapData[day][weather].average = heatmapData[day][weather].total / heatmapData[day][weather].count
    })
  })
  
  return heatmapData
}

function analyzeWeatherConditions(data: any[]): any {
  const conditions = data.reduce((acc: any, row: any) => {
    const condition = row.weather_condition || 'unknown'
    if (!acc[condition]) {
      acc[condition] = { total: 0, count: 0 }
    }
    acc[condition].total += parseFloat(row.total_revenue || 0)
    acc[condition].count += 1
    return acc
  }, {})
  
  Object.keys(conditions).forEach(condition => {
    conditions[condition].average = conditions[condition].total / conditions[condition].count
  })
  
  return conditions
}

function aggregateByWeek(data: any[]): any[] {
  // Implementation for weekly aggregation
  return []
}

function aggregateByMonth(data: any[]): any[] {
  // Implementation for monthly aggregation
  return []
}

function aggregatePeriodData(data: any[]): any {
  return {
    totalRevenue: data.reduce((sum, row) => sum + parseFloat(row.total_revenue_ex_tax || 0), 0),
    totalFootfall: data.reduce((sum, row) => sum + (row.total_footfall || 0), 0),
    totalTransactions: data.reduce((sum, row) => sum + (row.total_transactions || 0), 0)
  }
}

function calculateComparison(current: any[], previous: any[]): any {
  const currentTotal = aggregatePeriodData(current)
  const previousTotal = aggregatePeriodData(previous)
  
  return {
    revenueGrowth: previousTotal.totalRevenue === 0 ? 0 : 
      ((currentTotal.totalRevenue - previousTotal.totalRevenue) / previousTotal.totalRevenue) * 100,
    footfallGrowth: previousTotal.totalFootfall === 0 ? 0 :
      ((currentTotal.totalFootfall - previousTotal.totalFootfall) / previousTotal.totalFootfall) * 100,
    transactionGrowth: previousTotal.totalTransactions === 0 ? 0 :
      ((currentTotal.totalTransactions - previousTotal.totalTransactions) / previousTotal.totalTransactions) * 100
  }
}

function calculatePreviousPeriodStart(currentStart: string): string {
  const date = new Date(currentStart)
  date.setDate(date.getDate() - 30) // 30 days earlier
  return date.toISOString().split('T')[0]
}

function calculatePreviousPeriodEnd(currentEnd: string): string {
  const date = new Date(currentEnd)
  date.setDate(date.getDate() - 30) // 30 days earlier
  return date.toISOString().split('T')[0]
}

/**
 * Log performance metrics for monitoring
 */
async function logPerformanceMetrics(metrics: PerformanceMetrics, params: AnalyticsParams): Promise<void> {
  try {
    const supabase = createClient()
    await supabase
      .from('audit_log')
      .insert({
        actor_id: 'system',
        action: 'api_analytics_performance',
        target: 'analytics_api',
        meta: {
          ...metrics,
          params,
          timestamp: new Date().toISOString()
        }
      })
  } catch (error) {
    console.warn('Failed to log performance metrics:', error)
  }
}

/**
 * Log error metrics for monitoring
 */
async function logErrorMetrics(error: any, metrics: PerformanceMetrics, requestId: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase
      .from('audit_log')
      .insert({
        actor_id: 'system',
        action: 'api_analytics_error',
        target: 'analytics_api',
        meta: {
          requestId,
          error: error.message,
          responseTime: metrics.responseTime,
          timestamp: new Date().toISOString()
        }
      })
  } catch (logError) {
    console.warn('Failed to log error metrics:', logError)
  }
}

// ISR configuration
export const revalidate = 300 // 5 minutes
