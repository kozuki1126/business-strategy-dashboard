/**
 * Performance Cache System for High-Load Dashboard
 * Task #014: 性能・p95最適化実装
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { LRUCache } from 'lru-cache'
import { unstable_cache } from 'next/cache'
import { getCachedMasterData as getMasterDataFromDB } from './master-data-cache'

// 型定義
interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum cache entries
  staleWhileRevalidate?: number // Background refresh period
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  hits: number
  etag: string
}

interface CacheStats {
  hits: number
  misses: number
  hitRatio: number
  size: number
  maxSize: number
  evictions: number
}

// ========================================
// SERVER-SIDE CACHE IMPLEMENTATION
// ========================================

class ServerSideCache {
  private cache: LRUCache<string, CacheEntry<any>>
  private stats: CacheStats

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache({
      max: maxSize,
      ttl: 5 * 60 * 1000, // 5 minutes default
      updateAgeOnGet: true,
      allowStale: true
    })

    this.stats = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      size: 0,
      maxSize,
      evictions: 0
    }

    // Update stats on cache operations
    this.cache.on('evict', () => {
      this.stats.evictions++
      this.updateStats()
    })
  }

  // Generate cache key from parameters
  private generateKey(namespace: string, params: Record<string, any>): string {
    const sorted = JSON.stringify(params, Object.keys(params).sort())
    return `${namespace}:${Buffer.from(sorted).toString('base64')}`
  }

  // Generate ETag for cache validation
  private generateETag(data: any): string {
    return Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 16)
  }

  // Update cache statistics
  private updateStats(): void {
    this.stats.size = this.cache.size
    this.stats.hitRatio = this.stats.hits + this.stats.misses > 0 
      ? this.stats.hits / (this.stats.hits + this.stats.misses) 
      : 0
  }

  // Get data from cache
  async get<T>(
    namespace: string, 
    params: Record<string, any>,
    ifNoneMatch?: string
  ): Promise<{ data: T | null; etag?: string; stale?: boolean }> {
    const key = this.generateKey(namespace, params)
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      this.updateStats()
      return { data: null }
    }

    // Check ETag for conditional requests
    if (ifNoneMatch && entry.etag === ifNoneMatch) {
      return { data: null, etag: entry.etag }
    }

    // Update hit count
    entry.hits++
    this.stats.hits++
    this.updateStats()

    // Check if stale
    const isStale = Date.now() - entry.timestamp > this.cache.ttl
    
    return { 
      data: entry.data, 
      etag: entry.etag,
      stale: isStale
    }
  }

  // Set data in cache
  set<T>(
    namespace: string, 
    params: Record<string, any>, 
    data: T,
    config?: Partial<CacheConfig>
  ): string {
    const key = this.generateKey(namespace, params)
    const etag = this.generateETag(data)
    const timestamp = Date.now()

    const entry: CacheEntry<T> = {
      data,
      timestamp,
      hits: 0,
      etag
    }

    // Apply custom TTL if provided
    const options = config?.ttl ? { ttl: config.ttl } : undefined
    this.cache.set(key, entry, options)

    return etag
  }

  // Invalidate cache entries by namespace pattern
  invalidate(namespacePattern: string): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(namespacePattern)) {
        this.cache.delete(key)
        count++
      }
    }
    this.updateStats()
    return count
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
    this.stats = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      size: 0,
      maxSize: this.stats.maxSize,
      evictions: 0
    }
  }

  // Get cache statistics
  getStats(): CacheStats {
    this.updateStats()
    return { ...this.stats }
  }

  // Get detailed cache info for debugging
  getDebugInfo(): Record<string, any> {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.split(':')[0], // Only show namespace for privacy
      timestamp: new Date(entry.timestamp).toISOString(),
      hits: entry.hits,
      etag: entry.etag
    }))

    return {
      stats: this.getStats(),
      entries: entries.slice(0, 10), // Show only first 10 for brevity
      totalEntries: entries.length
    }
  }
}

// Singleton cache instance
const serverCache = new ServerSideCache(2000) // 2000 entries max

// ========================================
// NEXT.JS ISR CACHE WRAPPERS
// ========================================

// Master data cache (stores, departments) - longer TTL
export const getCachedMasterData = unstable_cache(
  async (type: 'stores' | 'departments' | 'categories') => {
    return await getMasterDataFromDB(type)
  },
  ['master-data'],
  {
    revalidate: 3600, // 1 hour
    tags: ['master-data']
  }
)

// External data cache (market, weather) - medium TTL
export const getCachedExternalData = unstable_cache(
  async (type: string, params: any) => {
    const { getCachedExternalData: getExternalData } = await import('./master-data-cache')
    return await getExternalData(type as any, params)
  },
  ['external-data'],
  {
    revalidate: 600, // 10 minutes
    tags: ['external-data']
  }
)

// ========================================
// CACHE STRATEGIES
// ========================================

// Cache-aside pattern for high-frequency data
export class CacheAsideStrategy {
  static async get<T>(
    namespace: string,
    params: Record<string, any>,
    fetcher: () => Promise<T>,
    config?: Partial<CacheConfig>
  ): Promise<T> {
    const cached = await serverCache.get<T>(namespace, params)
    
    if (cached.data && !cached.stale) {
      return cached.data
    }

    // Cache miss or stale data - fetch fresh data
    const freshData = await fetcher()
    serverCache.set(namespace, params, freshData, config)

    return freshData
  }

  static async invalidate(namespacePattern: string): Promise<number> {
    return serverCache.invalidate(namespacePattern)
  }
}

// Write-through pattern for critical data
export class WriteThroughStrategy {
  static async set<T>(
    namespace: string,
    params: Record<string, any>,
    data: T,
    persister: (data: T) => Promise<void>,
    config?: Partial<CacheConfig>
  ): Promise<void> {
    // Write to database first
    await persister(data)
    
    // Then update cache
    serverCache.set(namespace, params, data, config)
  }
}

// Stale-while-revalidate pattern for background updates
export class StaleWhileRevalidateStrategy {
  private static revalidationPromises = new Map<string, Promise<any>>()

  static async get<T>(
    namespace: string,
    params: Record<string, any>,
    fetcher: () => Promise<T>,
    config?: Partial<CacheConfig>
  ): Promise<T> {
    const key = `${namespace}:${JSON.stringify(params)}`
    const cached = await serverCache.get<T>(namespace, params)
    
    if (cached.data) {
      // If stale, start background revalidation
      if (cached.stale && !this.revalidationPromises.has(key)) {
        const revalidationPromise = fetcher()
          .then(freshData => {
            serverCache.set(namespace, params, freshData, config)
            this.revalidationPromises.delete(key)
            return freshData
          })
          .catch(error => {
            console.error(`Background revalidation failed for ${key}:`, error)
            this.revalidationPromises.delete(key)
            throw error
          })
        
        this.revalidationPromises.set(key, revalidationPromise)
      }
      
      return cached.data
    }

    // No cached data - fetch synchronously
    const freshData = await fetcher()
    serverCache.set(namespace, params, freshData, config)
    return freshData
  }
}

// ========================================
// CACHE MONITORING & HEALTH
// ========================================

export class CacheHealthMonitor {
  // Get comprehensive cache health metrics
  static getHealthMetrics(): {
    overall: 'healthy' | 'warning' | 'critical'
    hitRatio: number
    responseTime: number
    memoryUsage: number
    errorRate: number
    recommendations: string[]
  } {
    const stats = serverCache.getStats()
    const recommendations: string[] = []
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Analyze hit ratio
    if (stats.hitRatio < 0.5) {
      overall = 'warning'
      recommendations.push('低いヒット率です。キャッシュ戦略の見直しを検討してください。')
    } else if (stats.hitRatio < 0.3) {
      overall = 'critical'
      recommendations.push('非常に低いヒット率です。キャッシュキーの設計を見直してください。')
    }

    // Analyze cache size
    const utilization = stats.size / stats.maxSize
    if (utilization > 0.9) {
      overall = overall === 'healthy' ? 'warning' : 'critical'
      recommendations.push('キャッシュ使用率が高いです。キャッシュサイズの拡張を検討してください。')
    }

    // High eviction rate
    if (stats.evictions > stats.maxSize * 0.1) {
      recommendations.push('高い退避率です。TTLまたはキャッシュサイズの調整が必要です。')
    }

    return {
      overall,
      hitRatio: stats.hitRatio,
      responseTime: stats.hits > 0 ? 50 : 1000, // Estimated
      memoryUsage: utilization * 100,
      errorRate: 0, // Would be calculated from actual error metrics
      recommendations
    }
  }

  // Performance recommendations based on metrics
  static getPerformanceRecommendations(): string[] {
    const health = this.getHealthMetrics()
    const recommendations: string[] = []

    if (health.hitRatio < 0.7) {
      recommendations.push('キャッシュ戦略の最適化が必要です')
    }

    if (health.memoryUsage > 80) {
      recommendations.push('キャッシュサイズの拡張を検討してください')
    }

    if (health.responseTime > 1000) {
      recommendations.push('キャッシュミス時の処理時間を最適化してください')
    }

    return recommendations
  }
}

// Export main cache instance and utilities
export {
  serverCache,
  type CacheConfig,
  type CacheStats,
  type CacheEntry
}

// ========================================
// CACHE WARMING UTILITIES
// ========================================

export class CacheWarmer {
  // Warm frequently accessed data on application startup
  static async warmCriticalData(): Promise<void> {
    console.log('Starting cache warming...')
    
    try {
      // Pre-load master data
      await Promise.all([
        getCachedMasterData('stores'),
        getCachedMasterData('departments'),
        getCachedMasterData('categories')
      ])
      
      console.log('Cache warming completed successfully')
    } catch (error) {
      console.error('Cache warming failed:', error)
    }
  }

  // Scheduled cache refresh for critical paths
  static async scheduledRefresh(): Promise<void> {
    // This would be called by a cron job or similar scheduler
    console.log('Running scheduled cache refresh...')
    
    try {
      // Refresh critical data paths
      serverCache.invalidate('analytics')
      serverCache.invalidate('external-data')
      
      console.log('Scheduled cache refresh completed')
    } catch (error) {
      console.error('Scheduled cache refresh failed:', error)
    }
  }
}
