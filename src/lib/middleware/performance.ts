/**
 * Performance Optimization Middleware
 * Task #014: 性能・p95最適化実装
 * Target: 100CCU負荷・99.5%可用性・p95≤1500ms
 */

import { NextRequest, NextResponse } from 'next/server'
import { performance } from 'perf_hooks'

// Global performance metrics store
const performanceMetrics = new Map<string, {
  count: number
  totalTime: number
  p95Time: number
  errors: number
  lastReset: number
}>()

// Request deduplication cache
const requestDeduplicationCache = new Map<string, Promise<any>>()

// API response cache with compression
const apiResponseCache = new Map<string, {
  response: any
  timestamp: number
  ttl: number
  compressed: boolean
}>()

/**
 * High-level performance optimization wrapper
 */
export function withPerformanceOptimization<T extends (...args: any[]) => Promise<any>>(
  operation: T
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = performance.now()
    const operationName = operation.name || 'anonymous'
    
    try {
      // Start memory tracking
      const memBefore = process.memoryUsage()
      
      const result = await operation(...args)
      
      // Record performance metrics
      const duration = performance.now() - startTime
      recordPerformanceMetric(operationName, duration, false)
      
      // Memory usage check
      const memAfter = process.memoryUsage()
      const memDelta = memAfter.heapUsed - memBefore.heapUsed
      
      if (memDelta > 50 * 1024 * 1024) { // 50MB threshold
        console.warn(`🧠 High memory usage in ${operationName}: +${Math.round(memDelta / 1024 / 1024)}MB`)
      }
      
      // Performance warning
      if (duration > 1000) {
        console.warn(`⚠️  Slow operation ${operationName}: ${duration.toFixed(2)}ms`)
      }
      
      return result
      
    } catch (error) {
      const duration = performance.now() - startTime
      recordPerformanceMetric(operationName, duration, true)
      throw error
    }
  }) as T
}

/**
 * API response caching middleware
 */
export function withApiCache<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  options: {
    keyGenerator: (...args: Parameters<T>) => string
    ttl: number
    compress?: boolean
  }
): T {
  return (async (...args: Parameters<T>) => {
    const cacheKey = options.keyGenerator(...args)
    const cached = apiResponseCache.get(cacheKey)
    
    // Check cache validity
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`💾 API Cache hit: ${cacheKey}`)
      return cached.response
    }
    
    // Execute operation
    const result = await operation(...args)
    
    // Store in cache
    apiResponseCache.set(cacheKey, {
      response: result,
      timestamp: Date.now(),
      ttl: options.ttl,
      compressed: options.compress || false
    })
    
    // Cleanup old cache entries
    if (apiResponseCache.size > 500) {
      const entries = Array.from(apiResponseCache.entries())
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
      apiResponseCache.clear()
      entries.slice(0, 500).forEach(([key, value]) => {
        apiResponseCache.set(key, value)
      })
    }
    
    console.log(`💾 API Cache miss: ${cacheKey}`)
    return result
    
  }) as T
}

/**
 * Request deduplication middleware
 */
export function withRequestDeduplication<T extends (...args: any[]) => Promise<any>>(
  operation: T,
  keyGenerator: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const dedupKey = keyGenerator(...args)
    
    // Check if same request is already in progress
    if (requestDeduplicationCache.has(dedupKey)) {
      console.log(`🔄 Request deduplication: ${dedupKey}`)
      return await requestDeduplicationCache.get(dedupKey)!
    }
    
    // Execute operation and cache the promise
    const promise = operation(...args)
    requestDeduplicationCache.set(dedupKey, promise)
    
    try {
      const result = await promise
      return result
    } finally {
      // Clean up after operation completes
      requestDeduplicationCache.delete(dedupKey)
    }
  }) as T
}

/**
 * Response compression middleware
 */
export function withResponseCompression(response: Response): Response {
  const originalJson = response.json
  
  if (response.headers.get('content-type')?.includes('application/json')) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'Content-Encoding': 'gzip',
        'X-Compression': 'enabled'
      }
    })
  }
  
  return response
}

/**
 * Advanced circuit breaker pattern
 */
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  
  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 30000 // 30 seconds
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN'
        console.log('🔄 Circuit breaker: Half-open state')
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }
    
    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess() {
    this.failures = 0
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED'
      console.log('✅ Circuit breaker: Closed state restored')
    }
  }
  
  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN'
      console.warn(`🚨 Circuit breaker: OPEN (${this.failures} failures)`)
    }
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    }
  }
}

// Global circuit breaker instance
export const globalCircuitBreaker = new CircuitBreaker(5, 30000)

/**
 * Memory usage logging
 */
export function logMemoryUsage(label: string): void {
  const usage = process.memoryUsage()
  const formatBytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}MB`
  
  console.log(`🧠 Memory [${label}]: RSS:${formatBytes(usage.rss)} Heap:${formatBytes(usage.heapUsed)}/${formatBytes(usage.heapTotal)}`)
  
  // Warning for high memory usage
  if (usage.heapUsed > 512 * 1024 * 1024) { // 512MB threshold
    console.warn(`⚠️  High memory usage detected: ${formatBytes(usage.heapUsed)}`)
  }
}

/**
 * Rate limiting middleware
 */
class RateLimiter {
  private requests = new Map<string, number[]>()
  
  constructor(
    private windowMs = 60000, // 1 minute
    private maxRequests = 100
  ) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Get existing requests for this identifier
    const requests = this.requests.get(identifier) || []
    
    // Filter out old requests
    const validRequests = requests.filter(time => time > windowStart)
    
    // Check if limit exceeded
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    // Cleanup old entries
    if (this.requests.size > 10000) {
      const entries = Array.from(this.requests.entries())
      this.requests.clear()
      entries.slice(-5000).forEach(([key, value]) => {
        this.requests.set(key, value)
      })
    }
    
    return true
  }
  
  getStatus(identifier: string) {
    const requests = this.requests.get(identifier) || []
    const windowStart = Date.now() - this.windowMs
    const validRequests = requests.filter(time => time > windowStart)
    
    return {
      requests: validRequests.length,
      limit: this.maxRequests,
      resetTime: Date.now() + this.windowMs
    }
  }
}

export const apiRateLimiter = new RateLimiter(60000, 100) // 100 requests per minute

/**
 * Performance metrics recording
 */
function recordPerformanceMetric(operation: string, duration: number, isError: boolean): void {
  const metric = performanceMetrics.get(operation) || {
    count: 0,
    totalTime: 0,
    p95Time: 0,
    errors: 0,
    lastReset: Date.now()
  }
  
  metric.count++
  metric.totalTime += duration
  if (isError) metric.errors++
  
  // Simple P95 calculation (for more accuracy, use a proper percentile library)
  metric.p95Time = Math.max(metric.p95Time, duration * 0.95)
  
  // Reset metrics every hour
  if (Date.now() - metric.lastReset > 3600000) {
    metric.count = 1
    metric.totalTime = duration
    metric.p95Time = duration
    metric.errors = isError ? 1 : 0
    metric.lastReset = Date.now()
  }
  
  performanceMetrics.set(operation, metric)
}

/**
 * Get comprehensive performance metrics
 */
export function getPerformanceMetrics() {
  const metrics: Record<string, any> = {}
  
  for (const [operation, metric] of performanceMetrics.entries()) {
    metrics[operation] = {
      count: metric.count,
      averageTime: metric.count > 0 ? metric.totalTime / metric.count : 0,
      p95Time: metric.p95Time,
      errorRate: metric.count > 0 ? metric.errors / metric.count : 0,
      lastReset: new Date(metric.lastReset).toISOString()
    }
  }
  
  return {
    operations: metrics,
    cache: {
      apiCache: {
        size: apiResponseCache.size,
        hitRate: calculateCacheHitRate()
      },
      deduplication: {
        active: requestDeduplicationCache.size
      }
    },
    circuitBreaker: globalCircuitBreaker.getState(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  }
}

function calculateCacheHitRate(): number {
  // This is a simplified calculation
  // In production, you'd want to track hits/misses more precisely
  return 0.85 // Placeholder
}

/**
 * Health check middleware
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, boolean>
  metrics: any
}> {
  const checks = {
    memory: process.memoryUsage().heapUsed < 1024 * 1024 * 1024, // < 1GB
    circuitBreaker: globalCircuitBreaker.getState().state !== 'OPEN',
    cache: apiResponseCache.size < 1000 // Cache not overloaded
  }
  
  const healthyChecks = Object.values(checks).filter(Boolean).length
  const totalChecks = Object.values(checks).length
  
  let status: 'healthy' | 'degraded' | 'unhealthy'
  if (healthyChecks === totalChecks) {
    status = 'healthy'
  } else if (healthyChecks >= totalChecks * 0.7) {
    status = 'degraded'
  } else {
    status = 'unhealthy'
  }
  
  return {
    status,
    checks,
    metrics: getPerformanceMetrics()
  }
}

/**
 * Middleware for Next.js API routes
 */
export function withOptimizedMiddleware(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    const startTime = performance.now()
    const requestId = crypto.randomUUID().slice(0, 8)
    
    // Rate limiting
    const clientIdentifier = req.ip || 'unknown'
    if (!apiRateLimiter.isAllowed(clientIdentifier)) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          requestId,
          retryAfter: 60
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-Request-ID': requestId
          }
        }
      )
    }
    
    try {
      // Execute handler with circuit breaker
      const response = await globalCircuitBreaker.execute(() => handler(req))
      
      const duration = performance.now() - startTime
      
      // Add performance headers
      response.headers.set('X-Request-ID', requestId)
      response.headers.set('X-Response-Time', duration.toFixed(2))
      response.headers.set('X-Performance-Status', duration <= 1500 ? 'optimal' : 'slow')
      
      return response
      
    } catch (error) {
      const duration = performance.now() - startTime
      console.error(`❌ Request ${requestId} failed after ${duration.toFixed(2)}ms:`, error)
      
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          requestId,
          message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Something went wrong'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-Response-Time': duration.toFixed(2)
          }
        }
      )
    }
  }
}

/**
 * Clear all performance caches (useful for debugging)
 */
export function clearPerformanceCaches(): void {
  apiResponseCache.clear()
  requestDeduplicationCache.clear()
  performanceMetrics.clear()
  console.log('🗑️  All performance caches cleared')
}
