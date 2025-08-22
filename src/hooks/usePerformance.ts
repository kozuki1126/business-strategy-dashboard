/**
 * Dashboard Performance Hooks
 * Task #006: ダッシュボードUI（α版）実装 - パフォーマンス最適化
 * Created: 2025-08-19
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAnalyticsData, logAuditEvent } from '@/lib/database/helpers'
import { DashboardFilters, AnalyticsData } from '@/types/database.types'

// Performance monitoring hook
export function usePerformanceMonitor() {
  const [metrics, setMetrics] = useState<{
    responseTime: number
    cacheHitRatio: number
    queryCount: number
    memoryUsage: number
  }>({
    responseTime: 0,
    cacheHitRatio: 0,
    queryCount: 0,
    memoryUsage: 0
  })

  const startTime = useRef<number>(0)

  const startMeasuring = useCallback(() => {
    startTime.current = performance.now()
  }, [])

  const endMeasuring = useCallback((label: string = 'operation') => {
    const endTime = performance.now()
    const duration = endTime - startTime.current
    
    setMetrics(prev => ({
      ...prev,
      responseTime: duration,
      queryCount: prev.queryCount + 1
    }))

    // Log performance metrics only in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Performance [${label}]: ${duration.toFixed(2)}ms`)
    }
    
    // Warn if over target
    if (duration > 1500) {
      console.warn(`Performance warning [${label}]: ${duration.toFixed(2)}ms > 1500ms target`)
    }

    return duration
  }, [])

  const measureAsync = useCallback(async <T>(
    operation: () => Promise<T>,
    label: string = 'async_operation'
  ): Promise<T> => {
    startMeasuring()
    try {
      const result = await operation()
      endMeasuring(label)
      return result
    } catch (error) {
      endMeasuring(`${label}_error`)
      throw error
    }
  }, [startMeasuring, endMeasuring])

  return {
    metrics,
    startMeasuring,
    endMeasuring,
    measureAsync
  }
}

// Analytics data fetching hook with caching and performance optimization
export function useAnalyticsData(filters: DashboardFilters) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)
  
  const { measureAsync } = usePerformanceMonitor()
  const supabase = createClient()
  const cacheRef = useRef(new Map<string, { data: AnalyticsData; timestamp: number }>())
  
  // Cache timeout: 5 minutes
  const CACHE_TIMEOUT = 5 * 60 * 1000

  // Generate cache key from filters
  const cacheKey = useMemo(() => {
    return JSON.stringify({
      dateRange: filters.dateRange,
      storeIds: filters.storeIds?.sort(),
      departments: filters.departments?.sort(),
      productCategories: filters.productCategories?.sort()
    })
  }, [filters])

  const fetchData = useCallback(async () => {
    // Check cache first
    const cached = cacheRef.current.get(cacheKey)
    const now = Date.now()
    
    if (cached && (now - cached.timestamp < CACHE_TIMEOUT)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Using cached analytics data')
      }
      setData(cached.data)
      return cached.data
    }

    setLoading(true)
    setError(null)

    try {
      const result = await measureAsync(
        () => getAnalyticsData(supabase, filters),
        'analytics_data_fetch'
      )

      // Update cache
      cacheRef.current.set(cacheKey, {
        data: result,
        timestamp: now
      })

      // Clean old cache entries (keep only last 10)
      if (cacheRef.current.size > 10) {
        const entries = Array.from(cacheRef.current.entries())
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
        cacheRef.current.clear()
        entries.slice(0, 10).forEach(([key, value]) => {
          cacheRef.current.set(key, value)
        })
      }

      setData(result)
      setLastFetch(now)
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data'
      setError(errorMessage)
      console.error('Analytics data fetch error:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [cacheKey, filters, measureAsync, supabase])

  // Auto-fetch when filters change, with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData()
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [fetchData])

  // Manual refresh function
  const refresh = useCallback(() => {
    // Clear cache for this key to force fresh fetch
    cacheRef.current.delete(cacheKey)
    return fetchData()
  }, [cacheKey, fetchData])

  // Get cache stats
  const cacheStats = useMemo(() => {
    const totalEntries = cacheRef.current.size
    const now = Date.now()
    const validEntries = Array.from(cacheRef.current.values())
      .filter(entry => now - entry.timestamp < CACHE_TIMEOUT).length
    
    return {
      totalEntries,
      validEntries,
      hitRatio: totalEntries > 0 ? validEntries / totalEntries : 0
    }
  }, [lastFetch])

  return {
    data,
    loading,
    error,
    refresh,
    cacheStats,
    lastFetch: new Date(lastFetch).toISOString()
  }
}

// Debounced filter change hook
export function useDebouncedFilters(initialFilters: DashboardFilters, delay: number = 300) {
  const [filters, setFilters] = useState(initialFilters)
  const [debouncedFilters, setDebouncedFilters] = useState(initialFilters)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const updateFilters = useCallback((newFilters: DashboardFilters) => {
    setFilters(newFilters)
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedFilters(newFilters)
    }, delay)
  }, [delay])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    filters,
    debouncedFilters,
    updateFilters,
    isDebouncing: JSON.stringify(filters) !== JSON.stringify(debouncedFilters)
  }
}

// Memory usage monitoring hook
export function useMemoryMonitor() {
  const [memoryUsage, setMemoryUsage] = useState<{
    used: number
    total: number
    percentage: number
  }>({ used: 0, total: 0, percentage: 0 })

  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        setMemoryUsage({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        })
      }
    }

    // Check memory usage every 30 seconds
    const interval = setInterval(checkMemory, 30000)
    checkMemory() // Initial check

    return () => clearInterval(interval)
  }, [])

  return memoryUsage
}

// Network status and retry hook
export function useNetworkRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [lastError, setLastError] = useState<Error | null>(null)

  const executeWithRetry = useCallback(async (): Promise<T> => {
    let currentRetry = 0
    setIsRetrying(false)
    setRetryCount(0)
    setLastError(null)

    while (currentRetry <= maxRetries) {
      try {
        const result = await operation()
        setRetryCount(currentRetry)
        return result
      } catch (error) {
        setLastError(error instanceof Error ? error : new Error('Unknown error'))
        
        if (currentRetry === maxRetries) {
          throw error
        }

        setIsRetrying(true)
        setRetryCount(currentRetry + 1)
        
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, currentRetry)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        currentRetry++
      }
    }

    throw lastError
  }, [operation, maxRetries, retryDelay, lastError])

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    lastError
  }
}

// Chart data optimization hook
export function useChartDataOptimization<T>(
  data: T[],
  maxDataPoints: number = 100
): T[] {
  return useMemo(() => {
    if (!data || data.length <= maxDataPoints) {
      return data
    }

    // Sample data points evenly if we have too many
    const step = Math.ceil(data.length / maxDataPoints)
    return data.filter((_, index) => index % step === 0)
  }, [data, maxDataPoints])
}

// Auto-refresh hook for real-time data
export function useAutoRefresh(
  refreshFunction: () => Promise<any>,
  intervalMs: number = 300000 // 5 minutes default
) {
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!isAutoRefreshEnabled) return

    const doRefresh = async () => {
      try {
        await refreshFunction()
        setLastRefresh(new Date())
      } catch (error) {
        console.error('Auto-refresh failed:', error)
      }
    }

    intervalRef.current = setInterval(doRefresh, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshFunction, intervalMs, isAutoRefreshEnabled])

  const toggleAutoRefresh = useCallback(() => {
    setIsAutoRefreshEnabled(prev => !prev)
  }, [])

  const manualRefresh = useCallback(async () => {
    try {
      await refreshFunction()
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Manual refresh failed:', error)
      throw error
    }
  }, [refreshFunction])

  return {
    isAutoRefreshEnabled,
    lastRefresh,
    toggleAutoRefresh,
    manualRefresh
  }
}

// Error boundary hook for component-level error handling
export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null)
  const [errorInfo, setErrorInfo] = useState<string | null>(null)

  const handleError = useCallback((error: Error, errorInfo?: string) => {
    setError(error)
    setErrorInfo(errorInfo || null)
    
    // Log error for monitoring
    console.error('Component error:', error, errorInfo)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
    setErrorInfo(null)
  }, [])

  const resetErrorBoundary = useCallback(() => {
    clearError()
  }, [clearError])

  return {
    error,
    errorInfo,
    handleError,
    clearError,
    resetErrorBoundary,
    hasError: error !== null
  }
}
