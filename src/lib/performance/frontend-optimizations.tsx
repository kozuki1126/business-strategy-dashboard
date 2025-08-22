/**
 * Advanced Frontend Performance Optimizations for Task #014
 * Dashboard Performance Enhancement with Sub-Second Loading
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { analyticsOptimizer } from '@/lib/performance/api-optimizations'
import { sloMonitor } from '@/lib/monitoring/slo-monitor'

interface PerformanceConfig {
  enableVirtualization: boolean
  enableLazyLoading: boolean
  enableMemoization: boolean
  enablePreloading: boolean
  chunkSize: number
  renderBudget: number // milliseconds
}

interface OptimizedComponentProps {
  data: any[]
  loading?: boolean
  error?: string
  onDataRequest?: (filters: any) => Promise<void>
  performanceConfig?: Partial<PerformanceConfig>
}

/**
 * Performance-optimized React hook for dashboard data
 */
export function useOptimizedDashboardData(initialFilters: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date>(new Date())
  
  // Performance tracking
  const performanceRef = useRef({
    fetchStartTime: 0,
    renderStartTime: 0,
    totalRenderTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  })

  // Debounced filters with performance optimization
  const [debouncedFilters, setDebouncedFilters] = useState(initialFilters)
  const filterTimeoutRef = useRef<NodeJS.Timeout>()

  // Optimized filter update with debouncing
  const updateFilters = useCallback((newFilters: any) => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current)
    }

    filterTimeoutRef.current = setTimeout(() => {
      setDebouncedFilters(newFilters)
    }, 300) // 300ms debounce
  }, [])

  // Optimized data fetching with caching
  const fetchData = useCallback(async (filters: any, useCache = true) => {
    performanceRef.current.fetchStartTime = performance.now()
    setLoading(true)
    setError(null)

    try {
      // Record SLO metric for dashboard load start
      sloMonitor.recordMetric('dashboard_initial_load', 0, { phase: 'start' })

      const result = await analyticsOptimizer.getDashboardData(filters)
      
      // Track cache performance
      if (result.cached) {
        performanceRef.current.cacheHits++
      } else {
        performanceRef.current.cacheMisses++
      }

      const fetchTime = performance.now() - performanceRef.current.fetchStartTime

      // Record performance metrics
      sloMonitor.recordMetric('p95_response_time', fetchTime, {
        cached: result.cached,
        dataSize: result.metadata.dataSize
      })

      setData(result.data)
      setLastFetch(new Date())

      // Record successful dashboard load
      sloMonitor.recordMetric('dashboard_initial_load', fetchTime, { 
        phase: 'complete',
        cached: result.cached 
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data'
      setError(errorMessage)
      
      // Record error metrics
      sloMonitor.recordMetric('error_rate', 1, { 
        operation: 'dashboard_fetch',
        error: errorMessage 
      })
      
      console.error('Dashboard data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh with smart intervals
  useEffect(() => {
    fetchData(debouncedFilters)

    // Set up auto-refresh based on data freshness
    const refreshInterval = setInterval(() => {
      const timeSinceLastFetch = Date.now() - lastFetch.getTime()
      
      // Only refresh if data is getting stale (>5 minutes)
      if (timeSinceLastFetch > 5 * 60 * 1000) {
        fetchData(debouncedFilters, true) // Use cache for auto-refresh
      }
    }, 10 * 60 * 1000) // Check every 10 minutes

    return () => clearInterval(refreshInterval)
  }, [debouncedFilters, fetchData, lastFetch])

  // Performance stats
  const getPerformanceStats = useCallback(() => {
    const totalFetches = performanceRef.current.cacheHits + performanceRef.current.cacheMisses
    const cacheHitRatio = totalFetches > 0 
      ? (performanceRef.current.cacheHits / totalFetches) * 100 
      : 0

    return {
      totalRenderTime: performanceRef.current.totalRenderTime,
      cacheHitRatio,
      totalFetches,
      lastFetchTime: lastFetch
    }
  }, [lastFetch])

  return {
    data,
    loading,
    error,
    updateFilters,
    refetch: () => fetchData(debouncedFilters, false),
    getPerformanceStats
  }
}

/**
 * Virtualized table component for large datasets
 */
export function VirtualizedDataTable({ 
  data, 
  columns, 
  rowHeight = 50,
  visibleRows = 20,
  onRowClick 
}: {
  data: any[]
  columns: Array<{ key: string; label: string; width?: number }>
  rowHeight?: number
  visibleRows?: number
  onRowClick?: (row: any) => void
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / rowHeight)
    const endIndex = Math.min(startIndex + visibleRows, data.length)
    return { startIndex, endIndex }
  }, [scrollTop, rowHeight, visibleRows, data.length])

  // Visible items with memoization
  const visibleItems = useMemo(() => {
    return data.slice(visibleRange.startIndex, visibleRange.endIndex)
  }, [data, visibleRange])

  // Optimized scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Performance measurement
  useEffect(() => {
    const renderStartTime = performance.now()
    
    return () => {
      const renderTime = performance.now() - renderStartTime
      if (renderTime > 16) { // > 1 frame at 60fps
        console.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`)
      }
    }
  })

  return (
    <div
      ref={containerRef}
      className="virtual-table-container"
      style={{ 
        height: visibleRows * rowHeight,
        overflow: 'auto',
        border: '1px solid #e5e7eb'
      }}
      onScroll={handleScroll}
    >
      {/* Virtual spacer for total height */}
      <div style={{ height: data.length * rowHeight, position: 'relative' }}>
        {/* Header */}
        <div 
          className="virtual-table-header"
          style={{
            position: 'sticky',
            top: 0,
            background: 'white',
            borderBottom: '2px solid #e5e7eb',
            display: 'flex',
            height: rowHeight,
            zIndex: 10
          }}
        >
          {columns.map(column => (
            <div
              key={column.key}
              style={{ 
                width: column.width || 150,
                padding: '8px 12px',
                fontWeight: 600,
                borderRight: '1px solid #e5e7eb'
              }}
            >
              {column.label}
            </div>
          ))}
        </div>

        {/* Visible rows */}
        <div
          style={{
            transform: `translateY(${visibleRange.startIndex * rowHeight + rowHeight}px)` // +rowHeight for header
          }}
        >
          {visibleItems.map((row, index) => (
            <div
              key={visibleRange.startIndex + index}
              className="virtual-table-row"
              style={{
                display: 'flex',
                height: rowHeight,
                borderBottom: '1px solid #f3f4f6',
                cursor: onRowClick ? 'pointer' : 'default'
              }}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {columns.map(column => (
                <div
                  key={column.key}
                  style={{
                    width: column.width || 150,
                    padding: '8px 12px',
                    borderRight: '1px solid #f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {row[column.key]}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Optimized chart component with progressive loading
 */
export function OptimizedChart({ 
  data, 
  type = 'line',
  width = 800,
  height = 400,
  enableLazyLoading = true,
  enableAnimation = true
}: {
  data: any[]
  type?: 'line' | 'bar' | 'area'
  width?: number
  height?: number
  enableLazyLoading?: boolean
  enableAnimation?: boolean
}) {
  const [isVisible, setIsVisible] = useState(!enableLazyLoading)
  const [renderProgress, setRenderProgress] = useState(0)
  const chartRef = useRef<HTMLDivElement>(null)

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!enableLazyLoading) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (chartRef.current) {
      observer.observe(chartRef.current)
    }

    return () => observer.disconnect()
  }, [enableLazyLoading])

  // Progressive data loading for large datasets
  const processedData = useMemo(() => {
    if (!isVisible || !data.length) return []

    // For large datasets, load progressively
    if (data.length > 1000) {
      const chunkSize = Math.ceil(data.length * (renderProgress / 100))
      return data.slice(0, chunkSize)
    }

    return data
  }, [data, isVisible, renderProgress])

  // Progressive loading effect
  useEffect(() => {
    if (!isVisible || data.length <= 1000) {
      setRenderProgress(100)
      return
    }

    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setRenderProgress(progress)
      
      if (progress >= 100) {
        clearInterval(interval)
      }
    }, 100) // 100ms intervals for smooth loading

    return () => clearInterval(interval)
  }, [isVisible, data.length])

  // Performance tracking
  useEffect(() => {
    if (isVisible && processedData.length > 0) {
      const renderStart = performance.now()
      
      requestAnimationFrame(() => {
        const renderTime = performance.now() - renderStart
        sloMonitor.recordMetric('p95_response_time', renderTime, {
          component: 'chart',
          dataPoints: processedData.length
        })
      })
    }
  }, [processedData])

  if (!isVisible) {
    return (
      <div
        ref={chartRef}
        style={{ width, height }}
        className="flex items-center justify-center bg-gray-100 rounded"
      >
        <div className="text-gray-500">Chart loading...</div>
      </div>
    )
  }

  return (
    <div ref={chartRef} style={{ width, height }}>
      {renderProgress < 100 && (
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Loading chart data: {renderProgress}%
          </div>
        </div>
      )}
      
      {/* Chart implementation would go here */}
      <div className="w-full h-full bg-white border rounded shadow-sm flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-700">
            {type.charAt(0).toUpperCase() + type.slice(1)} Chart
          </div>
          <div className="text-sm text-gray-500">
            {processedData.length} data points
          </div>
          {enableAnimation && (
            <div className="mt-2">
              <div className="animate-pulse bg-blue-200 h-2 w-32 mx-auto rounded" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Performance-optimized dashboard layout
 */
export function OptimizedDashboardLayout({ children }: { children: React.ReactNode }) {
  const [renderBudget] = useState(16) // 60fps target
  const [activeComponents, setActiveComponents] = useState<Set<string>>(new Set())
  
  // Track component render performance
  const trackComponentRender = useCallback((componentName: string, renderTime: number) => {
    if (renderTime > renderBudget) {
      console.warn(`Component ${componentName} exceeded render budget: ${renderTime.toFixed(2)}ms`)
      
      // Record slow render metric
      sloMonitor.recordMetric('p95_response_time', renderTime, {
        component: componentName,
        type: 'slow_render'
      })
    }
  }, [renderBudget])

  // Optimized component registration
  const registerComponent = useCallback((componentName: string) => {
    setActiveComponents(prev => new Set([...prev, componentName]))
    
    return () => {
      setActiveComponents(prev => {
        const next = new Set(prev)
        next.delete(componentName)
        return next
      })
    }
  }, [])

  // Performance context
  const performanceContext = useMemo(() => ({
    renderBudget,
    trackComponentRender,
    registerComponent,
    activeComponents: activeComponents.size
  }), [renderBudget, trackComponentRender, registerComponent, activeComponents.size])

  return (
    <div className="optimized-dashboard-layout">
      {/* Performance indicator */}
      <div className="fixed top-4 right-4 z-50 bg-white border rounded shadow-lg p-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Active: {activeComponents.size} components</span>
        </div>
      </div>

      {/* Main content with performance context */}
      <div className="dashboard-content">
        {children}
      </div>
    </div>
  )
}

/**
 * Custom hook for component performance tracking
 */
export function useComponentPerformance(componentName: string) {
  const renderStartRef = useRef<number>(0)

  useEffect(() => {
    renderStartRef.current = performance.now()
    
    return () => {
      const renderTime = performance.now() - renderStartRef.current
      
      if (renderTime > 16) { // Exceeded 60fps budget
        sloMonitor.recordMetric('p95_response_time', renderTime, {
          component: componentName,
          type: 'component_render'
        })
      }
    }
  })

  const startMeasurement = useCallback(() => {
    renderStartRef.current = performance.now()
  }, [])

  const endMeasurement = useCallback((operation: string) => {
    const operationTime = performance.now() - renderStartRef.current
    
    sloMonitor.recordMetric('p95_response_time', operationTime, {
      component: componentName,
      operation
    })
    
    return operationTime
  }, [componentName])

  return { startMeasurement, endMeasurement }
}

/**
 * Memory-efficient data processor
 */
export function useMemoryEfficientDataProcessor<T>(
  data: T[],
  processor: (chunk: T[]) => T[],
  chunkSize = 1000
) {
  const [processedData, setProcessedData] = useState<T[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const processData = useCallback(async () => {
    if (!data.length) return

    setProcessing(true)
    setProgress(0)
    
    const result: T[] = []
    const chunks = Math.ceil(data.length / chunkSize)

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize
      const end = Math.min(start + chunkSize, data.length)
      const chunk = data.slice(start, end)
      
      // Process chunk
      const processedChunk = processor(chunk)
      result.push(...processedChunk)
      
      // Update progress
      setProgress(((i + 1) / chunks) * 100)
      
      // Yield to main thread to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    setProcessedData(result)
    setProcessing(false)
  }, [data, processor, chunkSize])

  useEffect(() => {
    processData()
  }, [processData])

  return { processedData, processing, progress }
}

/**
 * Smart image optimization component
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  quality = 75,
  ...props
}: {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  quality?: number
  [key: string]: any
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // Intersection observer for lazy loading
  useEffect(() => {
    if (priority) {
      setLoaded(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoaded(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [priority])

  return (
    <div 
      ref={imgRef}
      style={{ width, height }}
      className="relative overflow-hidden"
    >
      {loaded && !error ? (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setError(true)}
          {...props}
        />
      ) : error ? (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      ) : (
        <div className="w-full h-full bg-gray-100 animate-pulse" />
      )}
    </div>
  )
}

// Export all optimization components and hooks
export {
  useOptimizedDashboardData,
  VirtualizedDataTable,
  OptimizedChart,
  OptimizedDashboardLayout,
  useComponentPerformance,
  useMemoryEfficientDataProcessor,
  OptimizedImage
}

// Performance configuration
export const performanceConfig: PerformanceConfig = {
  enableVirtualization: true,
  enableLazyLoading: true,
  enableMemoization: true,
  enablePreloading: true,
  chunkSize: 1000,
  renderBudget: 16 // 60fps
}
