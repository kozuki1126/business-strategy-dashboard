// Database Helper Functions for Business Strategy Dashboard
// Task #004: データベーススキーマ作成 - データアクセスヘルパー
// Created: 2025-08-19

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

type SupabaseClient = ReturnType<typeof createClient>

// ========================================
// SALES DATA FUNCTIONS
// ========================================

export async function getSalesData(
  supabase: SupabaseClient, 
  filters: DashboardFilters
): Promise<SalesWithCalculated[]> {
  let query = supabase
    .from('sales')
    .select(`
      *,
      dim_store!inner (
        name,
        area
      )
    `)
    .gte('date', filters.dateRange.start)
    .lte('date', filters.dateRange.end)
    .order('date', { ascending: false })

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
    throw new Error(`Failed to fetch sales data: ${error.message}`)
  }

  // Calculate additional fields
  return data.map(sale => ({
    ...sale,
    total_revenue: (sale.revenue_ex_tax || 0) + (sale.tax || 0),
    average_transaction_value: sale.transactions ? 
      (sale.revenue_ex_tax || 0) / sale.transactions : null,
    conversion_rate: (sale.footfall && sale.transactions) ? 
      sale.transactions / sale.footfall : null,
    store_name: sale.dim_store?.name,
    area: sale.dim_store?.area
  }))
}

export async function getStoreSalesSummary(
  supabase: SupabaseClient,
  storeId: string,
  dateRange: { start: string; end: string }
) {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('store_id', storeId)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)

  if (error) {
    throw new Error(`Failed to fetch store sales summary: ${error.message}`)
  }

  const summary = data.reduce((acc, sale) => {
    acc.totalRevenue += sale.revenue_ex_tax || 0
    acc.totalFootfall += sale.footfall || 0
    acc.totalTransactions += sale.transactions || 0
    acc.totalDiscounts += sale.discounts || 0
    acc.recordCount += 1
    return acc
  }, {
    totalRevenue: 0,
    totalFootfall: 0,
    totalTransactions: 0,
    totalDiscounts: 0,
    recordCount: 0
  })

  return {
    ...summary,
    averageRevenue: summary.recordCount > 0 ? summary.totalRevenue / summary.recordCount : 0,
    averageFootfall: summary.recordCount > 0 ? summary.totalFootfall / summary.recordCount : 0,
    conversionRate: summary.totalFootfall > 0 ? summary.totalTransactions / summary.totalFootfall : 0
  }
}

// ========================================
// EXTERNAL DATA FUNCTIONS
// ========================================

export async function getMarketData(
  supabase: SupabaseClient,
  symbols: string[],
  dateRange: { start: string; end: string }
) {
  const { data, error } = await supabase
    .from('ext_market_index')
    .select('*')
    .in('symbol', symbols)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch market data: ${error.message}`)
  }

  return data
}

export async function getFXRates(
  supabase: SupabaseClient,
  pairs: string[],
  dateRange: { start: string; end: string }
) {
  const { data, error } = await supabase
    .from('ext_fx_rate')
    .select('*')
    .in('pair', pairs)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch FX rates: ${error.message}`)
  }

  return data
}

export async function getWeatherData(
  supabase: SupabaseClient,
  locations: string[],
  dateRange: { start: string; end: string }
) {
  const { data, error } = await supabase
    .from('ext_weather_daily')
    .select('*')
    .in('location', locations)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)
    .order('date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch weather data: ${error.message}`)
  }

  return data
}

export async function getNearbyEvents(
  supabase: SupabaseClient,
  storeId: string,
  date: string,
  radiusKm: number = 5
) {
  // First get store coordinates
  const { data: store, error: storeError } = await supabase
    .from('dim_store')
    .select('lat, lng')
    .eq('id', storeId)
    .single()

  if (storeError || !store.lat || !store.lng) {
    throw new Error('Store coordinates not found')
  }

  // Use the get_nearby_events function
  const { data, error } = await supabase
    .rpc('get_nearby_events', {
      store_lat: store.lat,
      store_lng: store.lng,
      event_date: date,
      radius_km: radiusKm
    })

  if (error) {
    throw new Error(`Failed to fetch nearby events: ${error.message}`)
  }

  return data
}

export async function getSTEMNews(
  supabase: SupabaseClient,
  categories: STEMCategory[],
  dateRange: { start: string; end: string },
  limit: number = 50
) {
  const { data, error } = await supabase
    .from('ext_stem_news')
    .select('*')
    .in('category', categories)
    .gte('published_date', dateRange.start)
    .lte('published_date', dateRange.end)
    .order('published_date', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch STEM news: ${error.message}`)
  }

  return data
}

// ========================================
// ANALYTICS FUNCTIONS
// ========================================

export async function getAnalyticsData(
  supabase: SupabaseClient,
  filters: DashboardFilters
): Promise<AnalyticsData> {
  // Get all required data in parallel
  const [salesData, marketData, weatherData, eventsData] = await Promise.all([
    getSalesData(supabase, filters),
    getMarketData(supabase, ['TOPIX', 'NIKKEI225'], filters.dateRange),
    getWeatherData(supabase, ['東京', '大阪'], filters.dateRange),
    supabase
      .from('ext_events')
      .select('*')
      .gte('date', filters.dateRange.start)
      .lte('date', filters.dateRange.end)
      .then(({ data, error }) => {
        if (error) throw new Error(`Failed to fetch events: ${error.message}`)
        return data
      })
  ])

  // Calculate basic correlations (simplified)
  const correlations = {
    weather_sales: 0.0, // TODO: Implement actual correlation calculation
    events_sales: 0.0,
    market_sales: 0.0
  }

  return {
    sales: salesData,
    marketData,
    weatherData,
    events: eventsData,
    correlations
  }
}

export async function getStorePerformanceComparison(
  supabase: SupabaseClient,
  dateRange: { start: string; end: string }
) {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      store_id,
      dim_store!inner (name, area),
      revenue_ex_tax,
      footfall,
      transactions
    `)
    .gte('date', dateRange.start)
    .lte('date', dateRange.end)

  if (error) {
    throw new Error(`Failed to fetch store performance data: ${error.message}`)
  }

  // Group by store and calculate metrics
  const storeMetrics = data.reduce((acc, sale) => {
    const storeId = sale.store_id
    if (!acc[storeId]) {
      acc[storeId] = {
        store_id: storeId,
        store_name: sale.dim_store?.name || 'Unknown',
        area: sale.dim_store?.area || 'Unknown',
        total_revenue: 0,
        total_footfall: 0,
        total_transactions: 0,
        sale_count: 0
      }
    }
    
    acc[storeId].total_revenue += sale.revenue_ex_tax || 0
    acc[storeId].total_footfall += sale.footfall || 0
    acc[storeId].total_transactions += sale.transactions || 0
    acc[storeId].sale_count += 1
    
    return acc
  }, {} as Record<string, any>)

  return Object.values(storeMetrics).map(store => ({
    ...store,
    average_revenue: store.sale_count > 0 ? store.total_revenue / store.sale_count : 0,
    conversion_rate: store.total_footfall > 0 ? store.total_transactions / store.total_footfall : 0
  }))
}

// ========================================
// AUDIT FUNCTIONS
// ========================================

export async function logAuditEvent(
  supabase: SupabaseClient,
  action: AuditAction,
  target?: string,
  meta?: Record<string, any>,
  actorId?: string,
  ip?: string,
  userAgent?: string
) {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      actor_id: actorId || null,
      action,
      target: target || null,
      ip: ip || null,
      ua: userAgent || null,
      meta: meta || null
    })

  if (error) {
    console.error('Failed to log audit event:', error)
    // Don't throw here to avoid breaking main functionality
  }
}

export async function getAuditLogs(
  supabase: SupabaseClient,
  filters: {
    actorId?: string
    actions?: AuditAction[]
    dateRange?: { start: string; end: string }
    limit?: number
  } = {}
) {
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('at', { ascending: false })

  if (filters.actorId) {
    query = query.eq('actor_id', filters.actorId)
  }

  if (filters.actions?.length) {
    query = query.in('action', filters.actions)
  }

  if (filters.dateRange) {
    query = query
      .gte('at', filters.dateRange.start)
      .lte('at', filters.dateRange.end)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`)
  }

  return data
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export async function getAllStores(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('dim_store')
    .select('*')
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch stores: ${error.message}`)
  }

  return data
}

export async function getAllDepartments(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('dim_department')
    .select('*')
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch departments: ${error.message}`)
  }

  return data
}

export async function getDistinctProductCategories(
  supabase: SupabaseClient,
  storeId?: string
) {
  let query = supabase
    .from('sales')
    .select('product_category')

  if (storeId) {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch product categories: ${error.message}`)
  }

  // Get unique categories
  const categories = [...new Set(
    data
      .map(item => item.product_category)
      .filter(Boolean)
  )].sort()

  return categories
}

// ========================================
// DATA VALIDATION FUNCTIONS
// ========================================

export async function validateSalesInput(
  supabase: SupabaseClient,
  salesData: Database['public']['Tables']['sales']['Insert']
) {
  const errors: { field: string; message: string }[] = []

  // Check if store exists
  const { data: store, error: storeError } = await supabase
    .from('dim_store')
    .select('id')
    .eq('id', salesData.store_id)
    .single()

  if (storeError || !store) {
    errors.push({ field: 'store_id', message: 'Store not found' })
  }

  // Check for duplicate entry
  const { data: existing, error: duplicateError } = await supabase
    .from('sales')
    .select('id')
    .eq('store_id', salesData.store_id)
    .eq('date', salesData.date)
    .eq('department', salesData.department || '')
    .eq('product_category', salesData.product_category || '')

  if (!duplicateError && existing && existing.length > 0) {
    errors.push({ 
      field: 'date', 
      message: 'Sales record already exists for this store, date, department, and category' 
    })
  }

  // Validate business logic
  if (salesData.revenue_ex_tax < 0) {
    errors.push({ field: 'revenue_ex_tax', message: 'Revenue cannot be negative' })
  }

  if (salesData.footfall && salesData.transactions && salesData.footfall < salesData.transactions) {
    errors.push({ 
      field: 'footfall', 
      message: 'Footfall cannot be less than number of transactions' 
    })
  }

  if (salesData.discounts && salesData.discounts > salesData.revenue_ex_tax) {
    errors.push({ 
      field: 'discounts', 
      message: 'Discounts cannot exceed revenue' 
    })
  }

  return errors
}

// ========================================
// EXPORT FUNCTIONS
// ========================================

export async function prepareSalesExportData(
  supabase: SupabaseClient,
  filters: DashboardFilters
) {
  const salesData = await getSalesData(supabase, filters)
  
  // Format data for export
  return salesData.map(sale => ({
    '日付': sale.date,
    '店舗名': sale.store_name || 'Unknown',
    'エリア': sale.area || 'Unknown',
    '部門': sale.department || '',
    '商品カテゴリ': sale.product_category || '',
    '税抜売上': sale.revenue_ex_tax,
    '客数': sale.footfall || 0,
    '取引数': sale.transactions || 0,
    '割引': sale.discounts || 0,
    '税額': sale.tax || 0,
    '総売上': sale.total_revenue,
    '平均単価': sale.average_transaction_value?.toFixed(2) || '',
    '転換率': sale.conversion_rate ? `${(sale.conversion_rate * 100).toFixed(2)}%` : '',
    '備考': sale.notes || ''
  }))
}
