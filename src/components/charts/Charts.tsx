'use client'

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts'
import { format } from 'date-fns'
import type { SalesTrend } from '@/app/api/sales/route'
import type { MarketIndex, FxRate } from '@/app/api/external/route'

interface SalesChartProps {
  data: SalesTrend[]
  height?: number
  showRevenue?: boolean
  showFootfall?: boolean
  showAOV?: boolean
}

export function SalesChart({ 
  data, 
  height = 400, 
  showRevenue = true, 
  showFootfall = true, 
  showAOV = false 
}: SalesChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ja-JP').format(value)
  }

  const formatDate = (value: string) => {
    return format(new Date(value), 'MM/dd')
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          fontSize={12}
        />
        <YAxis 
          yAxisId="revenue"
          orientation="left"
          tickFormatter={formatCurrency}
          fontSize={12}
        />
        <YAxis 
          yAxisId="footfall"
          orientation="right"
          tickFormatter={formatNumber}
          fontSize={12}
        />
        <Tooltip
          formatter={(value: number, name: string) => {
            if (name === 'revenue') return [formatCurrency(value), '売上']
            if (name === 'footfall') return [formatNumber(value), '客数']
            if (name === 'aov') return [formatCurrency(value), '客単価']
            return [value, name]
          }}
          labelFormatter={(label: string) => `日付: ${format(new Date(label), 'yyyy/MM/dd')}`}
        />
        <Legend />
        
        {showRevenue && (
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="売上"
            fill="#3b82f6"
            fillOpacity={0.3}
            stroke="#3b82f6"
            strokeWidth={2}
          />
        )}
        
        {showFootfall && (
          <Line
            yAxisId="footfall"
            type="monotone"
            dataKey="footfall"
            name="客数"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        )}
        
        {showAOV && (
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="aov"
            name="客単価"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

interface StorePerformanceChartProps {
  data: { name: string; revenue: number; footfall: number }[]
  height?: number
}

export function StorePerformanceChart({ data, height = 300 }: StorePerformanceChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis tickFormatter={formatCurrency} fontSize={12} />
        <Tooltip formatter={(value: number) => [formatCurrency(value), '売上']} />
        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface MarketIndexChartProps {
  data: MarketIndex[]
  height?: number
}

export function MarketIndexChart({ data, height = 300 }: MarketIndexChartProps) {
  // Group data by index_code
  const groupedData = data.reduce((acc, item) => {
    const key = item.index_code
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {} as Record<string, MarketIndex[]>)

  // Get colors for different indices
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
  const indices = Object.keys(groupedData)

  // Merge all data points by date
  const mergedData = data.reduce((acc, item) => {
    const existing = acc.find(d => d.date === item.date)
    if (existing) {
      existing[item.index_code] = item.value
    } else {
      acc.push({
        date: item.date,
        [item.index_code]: item.value
      })
    }
    return acc
  }, [] as any[])

  const formatDate = (value: string) => {
    return format(new Date(value), 'MM/dd')
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          fontSize={12}
        />
        <YAxis tickFormatter={formatNumber} fontSize={12} />
        <Tooltip
          formatter={(value: number, name: string) => [formatNumber(value), name]}
          labelFormatter={(label: string) => `日付: ${format(new Date(label), 'yyyy/MM/dd')}`}
        />
        <Legend />
        
        {indices.map((index, i) => (
          <Line
            key={index}
            type="monotone"
            dataKey={index}
            name={index}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

interface FxRateChartProps {
  data: FxRate[]
  height?: number
}

export function FxRateChart({ data, height = 300 }: FxRateChartProps) {
  // Filter for major currency pairs
  const majorPairs = ['USD/JPY', 'EUR/JPY', 'GBP/JPY']
  const filteredData = data.filter(item => 
    majorPairs.includes(`${item.base_currency}/${item.target_currency}`)
  )

  // Group and merge like market index chart
  const mergedData = filteredData.reduce((acc, item) => {
    const pair = `${item.base_currency}/${item.target_currency}`
    const existing = acc.find(d => d.date === item.date)
    if (existing) {
      existing[pair] = item.rate
    } else {
      acc.push({
        date: item.date,
        [pair]: item.rate
      })
    }
    return acc
  }, [] as any[])

  const formatDate = (value: string) => {
    return format(new Date(value), 'MM/dd')
  }

  const formatRate = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const colors = ['#3b82f6', '#ef4444', '#10b981']

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          fontSize={12}
        />
        <YAxis tickFormatter={formatRate} fontSize={12} />
        <Tooltip
          formatter={(value: number, name: string) => [formatRate(value), name]}
          labelFormatter={(label: string) => `日付: ${format(new Date(label), 'yyyy/MM/dd')}`}
        />
        <Legend />
        
        {majorPairs.map((pair, i) => (
          <Line
            key={pair}
            type="monotone"
            dataKey={pair}
            name={pair}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

interface DepartmentPieChartProps {
  data: { name: string; revenue: number }[]
  height?: number
}

export function DepartmentPieChart({ data, height = 300 }: DepartmentPieChartProps) {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const total = data.reduce((sum, item) => sum + item.revenue, 0)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="revenue"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [formatCurrency(value), '売上']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Loading skeleton component
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div 
      className="animate-pulse bg-gray-200 rounded-lg flex items-center justify-center"
      style={{ height }}
    >
      <div className="text-gray-400 text-sm">チャート読み込み中...</div>
    </div>
  )
}

// Error component for charts
export function ChartError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-center p-4">
      <div className="text-red-600 mb-2">
        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-red-600 text-sm mb-3">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
        >
          再試行
        </button>
      )}
    </div>
  )
}
