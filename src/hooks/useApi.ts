import { useState, useEffect, useCallback } from 'react'
import type { SalesResponse } from '@/app/api/sales/route'
import type { ExternalDataResponse } from '@/app/api/external/route'

interface UseApiDataOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useSalesData(
  period: string = 'current-month',
  storeId: string = 'all',
  options: UseApiDataOptions = {}
) {
  const { autoRefresh = false, refreshInterval = 300000 } = options // 5 minutes default
  const [state, setState] = useState<ApiState<SalesResponse>>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null
  })

  const fetchData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const params = new URLSearchParams({
        period,
        store: storeId
      })
      
      const response = await fetch(`/api/sales?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      setState({
        data,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })
    } catch (error) {
      console.error('Failed to fetch sales data:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [period, storeId])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchData])

  return {
    ...state,
    refetch: fetchData
  }
}

export function useExternalData(
  days: number = 30,
  category?: string,
  options: UseApiDataOptions = {}
) {
  const { autoRefresh = false, refreshInterval = 600000 } = options // 10 minutes default
  const [state, setState] = useState<ApiState<ExternalDataResponse>>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null
  })

  const fetchData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const params = new URLSearchParams({
        days: days.toString()
      })
      
      if (category) {
        params.append('category', category)
      }
      
      const response = await fetch(`/api/external?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      setState({
        data,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })
    } catch (error) {
      console.error('Failed to fetch external data:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [days, category])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchData])

  return {
    ...state,
    refetch: fetchData
  }
}

// Custom hook for dashboard health check
export function useDashboardHealth() {
  const [state, setState] = useState<ApiState<{ status: string; checks: any[] }>>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null
  })

  const fetchHealth = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const response = await fetch('/api/health/database')
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      setState({
        data,
        loading: false,
        error: null,
        lastUpdated: new Date()
      })
    } catch (error) {
      console.error('Health check failed:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      }))
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  return {
    ...state,
    refetch: fetchHealth
  }
}

// Utility hook for formatting currency
export function useFormatCurrency() {
  return useCallback((amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }, [])
}

// Utility hook for formatting numbers
export function useFormatNumber() {
  return useCallback((value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options
    }).format(value)
  }, [])
}

// Utility hook for formatting percentages
export function useFormatPercentage() {
  return useCallback((value: number, decimals: number = 1) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value / 100)
  }, [])
}

// Hook for managing dashboard filters
export function useDashboardFilters() {
  const [period, setPeriod] = useState('current-month')
  const [storeId, setStoreId] = useState('all')
  const [dateRange, setDateRange] = useState(30)

  const resetFilters = useCallback(() => {
    setPeriod('current-month')
    setStoreId('all')
    setDateRange(30)
  }, [])

  return {
    period,
    setPeriod,
    storeId,
    setStoreId,
    dateRange,
    setDateRange,
    resetFilters
  }
}

// Hook for managing data refresh state
export function useDataRefresh() {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = useCallback(async (refreshFunctions: (() => Promise<void>)[]) => {
    setIsRefreshing(true)
    
    try {
      await Promise.all(refreshFunctions.map(fn => fn()))
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  return {
    lastRefresh,
    isRefreshing,
    refresh
  }
}
