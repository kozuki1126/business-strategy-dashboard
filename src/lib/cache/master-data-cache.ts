/**
 * Master Data Cache Implementation
 * Task #014: 性能・p95最適化実装 - マスターデータキャッシュ
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CacheAsideStrategy, StaleWhileRevalidateStrategy } from './server-cache'

// 型定義
interface Store {
  id: string
  name: string
  area: string
  lat: number
  lng: number
  active: boolean
}

interface Department {
  id: string
  name: string
  description?: string
  active: boolean
}

interface ProductCategory {
  id: string
  name: string
  department_id?: string
  active: boolean
}

// ========================================
// MASTER DATA CACHE FUNCTIONS
// ========================================

/**
 * Cached Stores Data with 1-hour TTL
 */
export const getCachedStores = async (): Promise<Store[]> => {
  return await StaleWhileRevalidateStrategy.get(
    'master-stores',
    {},
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('dim_store')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) {
        console.error('Failed to fetch stores:', error)
        throw new Error(`Store fetch failed: ${error.message}`)
      }

      return data as Store[]
    },
    { ttl: 60 * 60 * 1000 } // 1 hour
  )
}

/**
 * Cached Departments Data with 1-hour TTL
 */
export const getCachedDepartments = async (): Promise<Department[]> => {
  return await StaleWhileRevalidateStrategy.get(
    'master-departments',
    {},
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('dim_department')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) {
        console.error('Failed to fetch departments:', error)
        throw new Error(`Department fetch failed: ${error.message}`)
      }

      return data as Department[]
    },
    { ttl: 60 * 60 * 1000 } // 1 hour
  )
}

/**
 * Cached Product Categories Data with 1-hour TTL
 */
export const getCachedProductCategories = async (): Promise<ProductCategory[]> => {
  return await StaleWhileRevalidateStrategy.get(
    'master-categories',
    {},
    async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('dim_product_category')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) {
        console.error('Failed to fetch product categories:', error)
        throw new Error(`Product category fetch failed: ${error.message}`)
      }

      return data as ProductCategory[]
    },
    { ttl: 60 * 60 * 1000 } // 1 hour
  )
}

/**
 * Generic Master Data Cache Function
 */
export const getCachedMasterData = async (
  type: 'stores' | 'departments' | 'categories'
): Promise<Store[] | Department[] | ProductCategory[]> => {
  switch (type) {
    case 'stores':
      return getCachedStores()
    case 'departments':
      return getCachedDepartments()
    case 'categories':
      return getCachedProductCategories()
    default:
      throw new Error(`Unknown master data type: ${type}`)
  }
}

// ========================================
// EXTERNAL DATA CACHE FUNCTIONS
// ========================================

/**
 * Cached External Data with Variable TTL
 */
export const getCachedExternalData = async (
  type: 'market' | 'weather' | 'events' | 'news',
  params: Record<string, any>
): Promise<any[]> => {
  const ttlMap = {
    market: 10 * 60 * 1000,  // 10 minutes
    weather: 15 * 60 * 1000, // 15 minutes
    events: 30 * 60 * 1000,  // 30 minutes
    news: 20 * 60 * 1000     // 20 minutes
  }

  const tableMap = {
    market: 'ext_market_index',
    weather: 'ext_weather_daily',
    events: 'ext_events',
    news: 'ext_stem_news'
  }

  return await CacheAsideStrategy.get(
    `external-${type}`,
    params,
    async () => {
      const supabase = createClient()
      let query = supabase.from(tableMap[type]).select('*')

      // Apply common filters
      if (params.dateRange?.start) {
        query = query.gte('date', params.dateRange.start)
      }
      if (params.dateRange?.end) {
        query = query.lte('date', params.dateRange.end)
      }

      // Type-specific filters
      if (type === 'market' && params.symbols) {
        query = query.in('symbol', params.symbols)
      }
      if (type === 'weather' && params.locations) {
        query = query.in('location', params.locations)
      }

      query = query.order('date', { ascending: false }).limit(1000)

      const { data, error } = await query

      if (error) {
        console.error(`Failed to fetch ${type} data:`, error)
        throw new Error(`${type} data fetch failed: ${error.message}`)
      }

      return data || []
    },
    { ttl: ttlMap[type] }
  )
}

// ========================================
// CACHE MANAGEMENT FUNCTIONS
// ========================================

/**
 * Invalidate Master Data Cache
 */
export const invalidateMasterDataCache = async (): Promise<void> => {
  await Promise.all([
    CacheAsideStrategy.invalidate('master-stores'),
    CacheAsideStrategy.invalidate('master-departments'),
    CacheAsideStrategy.invalidate('master-categories')
  ])
  
  console.log('Master data cache invalidated')
}

/**
 * Invalidate External Data Cache
 */
export const invalidateExternalDataCache = async (): Promise<void> => {
  await Promise.all([
    CacheAsideStrategy.invalidate('external-market'),
    CacheAsideStrategy.invalidate('external-weather'),
    CacheAsideStrategy.invalidate('external-events'),
    CacheAsideStrategy.invalidate('external-news')
  ])
  
  console.log('External data cache invalidated')
}

/**
 * Warm Master Data Cache
 */
export const warmMasterDataCache = async (): Promise<void> => {
  console.log('Warming master data cache...')
  
  try {
    await Promise.all([
      getCachedStores(),
      getCachedDepartments(),
      getCachedProductCategories()
    ])
    
    console.log('✅ Master data cache warmed successfully')
  } catch (error) {
    console.error('❌ Failed to warm master data cache:', error)
    throw error
  }
}

/**
 * Refresh All Cache Data
 */
export const refreshAllCache = async (): Promise<void> => {
  console.log('Refreshing all cache data...')
  
  try {
    // Invalidate all cache
    await Promise.all([
      invalidateMasterDataCache(),
      invalidateExternalDataCache()
    ])
    
    // Warm critical data
    await warmMasterDataCache()
    
    console.log('✅ All cache data refreshed successfully')
  } catch (error) {
    console.error('❌ Failed to refresh cache:', error)
    throw error
  }
}

// ========================================
// NEXT.JS ISR INTEGRATION
// ========================================

/**
 * Next.js ISR Cached Functions
 */
export const getISRStores = unstable_cache(
  async () => getCachedStores(),
  ['stores-isr'],
  { revalidate: 3600, tags: ['stores'] }
)

export const getISRDepartments = unstable_cache(
  async () => getCachedDepartments(),
  ['departments-isr'],
  { revalidate: 3600, tags: ['departments'] }
)

export const getISRProductCategories = unstable_cache(
  async () => getCachedProductCategories(),
  ['categories-isr'],
  { revalidate: 3600, tags: ['categories'] }
)

// ========================================
// CACHE HEALTH MONITORING
// ========================================

/**
 * Get Master Data Cache Health
 */
export const getMasterDataCacheHealth = async () => {
  const startTime = performance.now()
  
  try {
    const [stores, departments, categories] = await Promise.all([
      getCachedStores(),
      getCachedDepartments(),
      getCachedProductCategories()
    ])
    
    const responseTime = performance.now() - startTime
    
    return {
      status: 'healthy',
      responseTime: Math.round(responseTime),
      storeCount: stores.length,
      departmentCount: departments.length,
      categoryCount: categories.length,
      lastCheck: new Date().toISOString()
    }
  } catch (error) {
    const responseTime = performance.now() - startTime
    
    return {
      status: 'unhealthy',
      responseTime: Math.round(responseTime),
      error: error instanceof Error ? error.message : 'Unknown error',
      lastCheck: new Date().toISOString()
    }
  }
}

// ========================================
// EXPORTS
// ========================================

export {
  type Store,
  type Department,
  type ProductCategory
}
