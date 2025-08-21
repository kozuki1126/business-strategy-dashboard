/**
 * Advanced Performance Cache Configuration
 * Task #014: 性能・p95最適化実装 - キャッシュ戦略強化
 */

import { LRUCache } from 'lru-cache'

// Enhanced cache configuration for p95 optimization
export const performanceCache = new LRUCache({
  max: 1000,
  maxAge: 1000 * 60 * 15, // 15 minutes
  updateAgeOnGet: true,
  allowStale: true,
  staleWhileRevalidate: true
})

// Specialized caches for different data types
export const dashboardCache = new LRUCache({
  max: 100,
  maxAge: 1000 * 60 * 5, // 5 minutes for real-time data
  updateAgeOnGet: true
})

export const analyticsCache = new LRUCache({
  max: 500,
  maxAge: 1000 * 60 * 30, // 30 minutes for analytics
  updateAgeOnGet: true
})

export const masterDataCache = new LRUCache({
  max: 50,
  maxAge: 1000 * 60 * 60, // 1 hour for master data
  updateAgeOnGet: true
})

export const apiResponseCache = new LRUCache({
  max: 1000,
  maxAge: 1000 * 60 * 10, // 10 minutes for API responses
  updateAgeOnGet: true,
  allowStale: true
})

// Cache key generators for consistent keys
export const generateCacheKey = {
  dashboard: (filters: any) => `dashboard:${JSON.stringify(filters)}`,
  analytics: (params: any) => `analytics:${JSON.stringify(params)}`,
  sales: (dateRange: any) => `sales:${dateRange.start}-${dateRange.end}`,
  masterData: (type: string) => `master:${type}`,
  correlation: (params: any) => `correlation:${JSON.stringify(params)}`,
  export: (params: any) => `export:${JSON.stringify(params)}`,
  user: (userId: string) => `user:${userId}`,
  rbac: (userId: string, resource: string) => `rbac:${userId}:${resource}`
}

// Cache warming functions
export async function warmCache() {
  console.log('🔥 Warming performance caches...')
  
  try {
    // Pre-load frequently accessed master data
    await warmMasterDataCache()
    
    // Pre-load common dashboard configurations
    await warmDashboardCache()
    
    // Pre-load analytics data for common date ranges
    await warmAnalyticsCache()
    
    console.log('✅ Cache warming completed')
  } catch (error) {
    console.error('❌ Cache warming failed:', error)
  }
}

async function warmMasterDataCache() {
  const masterDataTypes = ['stores', 'departments', 'categories', 'users']
  
  for (const type of masterDataTypes) {
    const key = generateCacheKey.masterData(type)
    
    if (!masterDataCache.has(key)) {
      try {
        // This would fetch the actual data in a real implementation
        const data = await fetchMasterData(type)
        masterDataCache.set(key, data)
        console.log(`🔥 Warmed master data cache: ${type}`)
      } catch (error) {
        console.warn(`⚠️  Failed to warm ${type} cache:`, error)
      }
    }
  }
}

async function warmDashboardCache() {
  const commonFilters = [
    { dateRange: { start: '2025-08-01', end: '2025-08-21' }, store: 'all' },
    { dateRange: { start: '2025-08-21', end: '2025-08-21' }, store: 'all' },
    { dateRange: { start: '2025-08-14', end: '2025-08-21' }, store: 'all' }
  ]
  
  for (const filters of commonFilters) {
    const key = generateCacheKey.dashboard(filters)
    
    if (!dashboardCache.has(key)) {
      try {
        // This would fetch the actual dashboard data
        const data = await fetchDashboardData(filters)
        dashboardCache.set(key, data)
        console.log(`🔥 Warmed dashboard cache: ${JSON.stringify(filters)}`)
      } catch (error) {
        console.warn(`⚠️  Failed to warm dashboard cache:`, error)
      }
    }
  }
}

async function warmAnalyticsCache() {
  const commonAnalytics = [
    { type: 'correlation', period: '30days' },
    { type: 'trends', period: '7days' },
    { type: 'comparison', period: 'month' }
  ]
  
  for (const params of commonAnalytics) {
    const key = generateCacheKey.analytics(params)
    
    if (!analyticsCache.has(key)) {
      try {
        // This would fetch the actual analytics data
        const data = await fetchAnalyticsData(params)
        analyticsCache.set(key, data)
        console.log(`🔥 Warmed analytics cache: ${JSON.stringify(params)}`)
      } catch (error) {
        console.warn(`⚠️  Failed to warm analytics cache:`, error)
      }
    }
  }
}

// Cache utility functions
export const cacheUtils = {
  /**
   * Get data from cache or fetch if missing
   */
  async getOrFetch<T>(
    cache: LRUCache<string, T>,
    key: string,
    fetchFn: () => Promise<T>,
    options?: { forceRefresh?: boolean }
  ): Promise<T> {
    if (!options?.forceRefresh && cache.has(key)) {
      const cached = cache.get(key)
      if (cached !== undefined) {
        return cached
      }
    }
    
    const data = await fetchFn()
    cache.set(key, data)
    return data
  },
  
  /**
   * Invalidate cache entries by pattern
   */
  invalidatePattern(cache: LRUCache<string, any>, pattern: string) {
    const keys = Array.from(cache.keys())
    const regex = new RegExp(pattern)
    
    keys.forEach(key => {
      if (regex.test(key)) {
        cache.delete(key)
      }
    })
  },
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      performance: {
        size: performanceCache.size,
        max: performanceCache.max,
        hits: 0, // Would be tracked in real implementation
        misses: 0
      },
      dashboard: {
        size: dashboardCache.size,
        max: dashboardCache.max
      },
      analytics: {
        size: analyticsCache.size,
        max: analyticsCache.max
      },
      masterData: {
        size: masterDataCache.size,
        max: masterDataCache.max
      },
      apiResponse: {
        size: apiResponseCache.size,
        max: apiResponseCache.max
      }
    }
  },
  
  /**
   * Clear all caches
   */
  clearAll() {
    performanceCache.clear()
    dashboardCache.clear()
    analyticsCache.clear()
    masterDataCache.clear()
    apiResponseCache.clear()
    console.log('🧹 All caches cleared')
  }
}

// Cache middleware for API routes
export function withCache<T>(
  cache: LRUCache<string, T>,
  keyGenerator: (params: any) => string,
  ttl?: number
) {
  return function cacheMiddleware(
    fetchFn: (params: any) => Promise<T>
  ) {
    return async function cachedFetch(params: any): Promise<T> {
      const key = keyGenerator(params)
      
      // Check cache first
      const cached = cache.get(key)
      if (cached !== undefined) {
        return cached
      }
      
      // Fetch and cache
      const data = await fetchFn(params)
      cache.set(key, data, ttl ? { ttl } : undefined)
      
      return data
    }
  }
}

// Response compression utilities
export const compressionUtils = {
  /**
   * Compress large responses
   */
  async compressResponse(data: any): Promise<string> {
    // In a real implementation, this would use gzip or brotli
    return JSON.stringify(data)
  },
  
  /**
   * Decompress responses
   */
  async decompressResponse(compressed: string): Promise<any> {
    return JSON.parse(compressed)
  }
}

// Stale-while-revalidate pattern implementation
export class StaleWhileRevalidateCache<T> {
  private cache: LRUCache<string, { data: T; timestamp: number }>
  private refreshPromises = new Map<string, Promise<T>>()
  
  constructor(options: { max: number; maxAge: number }) {
    this.cache = new LRUCache({
      max: options.max,
      maxAge: options.maxAge
    })
  }
  
  async get(
    key: string,
    fetchFn: () => Promise<T>,
    staleTime: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<T> {
    const cached = this.cache.get(key)
    const now = Date.now()
    
    // Return fresh data immediately
    if (cached && (now - cached.timestamp) < staleTime) {
      return cached.data
    }
    
    // Return stale data while revalidating in background
    if (cached) {
      // Start background refresh if not already in progress
      if (!this.refreshPromises.has(key)) {
        const refreshPromise = fetchFn()
          .then(data => {
            this.cache.set(key, { data, timestamp: now })
            this.refreshPromises.delete(key)
            return data
          })
          .catch(error => {
            this.refreshPromises.delete(key)
            throw error
          })
        
        this.refreshPromises.set(key, refreshPromise)
      }
      
      return cached.data
    }
    
    // No cached data, fetch synchronously
    const data = await fetchFn()
    this.cache.set(key, { data, timestamp: now })
    return data
  }
}

// Placeholder functions for cache warming (would be implemented with actual data fetching)
async function fetchMasterData(type: string): Promise<any> {
  // Placeholder - would fetch from database
  return { type, data: `master_${type}_data`, timestamp: new Date() }
}

async function fetchDashboardData(filters: any): Promise<any> {
  // Placeholder - would fetch from database
  return { filters, data: 'dashboard_data', timestamp: new Date() }
}

async function fetchAnalyticsData(params: any): Promise<any> {
  // Placeholder - would fetch from database
  return { params, data: 'analytics_data', timestamp: new Date() }
}

// Export stale-while-revalidate cache instance for common use
export const swrCache = new StaleWhileRevalidateCache<any>({
  max: 500,
  maxAge: 1000 * 60 * 30 // 30 minutes
})
