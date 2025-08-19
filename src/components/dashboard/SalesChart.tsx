'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from 'recharts'
import { SalesWithCalculated } from '@/types/database.types'
import { format } from 'date-fns'

interface SalesChartProps {
  salesData: SalesWithCalculated[]
  loading?: boolean
}

export function SalesChart({ salesData, loading }: SalesChartProps) {
  const chartData = useMemo(() => {
    if (!salesData || salesData.length === 0) return []

    // Group by date and sum revenue
    const groupedData = salesData.reduce((acc, sale) => {
      const date = sale.date
      if (!acc[date]) {
        acc[date] = {
          date,
          revenue: 0,
          footfall: 0,
          transactions: 0,
          stores: new Set<string>()
        }
      }
      
      acc[date].revenue += sale.revenue_ex_tax || 0
      acc[date].footfall += sale.footfall || 0
      acc[date].transactions += sale.transactions || 0
      if (sale.store_id) {
        acc[date].stores.add(sale.store_id)
      }
      
      return acc
    }, {} as Record<string, any>)

    // Convert to array and format
    return Object.values(groupedData)
      .map((item: any) => ({
        date: format(new Date(item.date), 'MM/dd'),
        revenue: Math.round(item.revenue),
        footfall: item.footfall,
        transactions: item.transactions,
        storeCount: item.stores.size,
        conversionRate: item.footfall > 0 ? 
          Math.round((item.transactions / item.footfall) * 100 * 10) / 10 : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [salesData])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ja-JP').format(value)
  }

  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">売上推移</h3>
        <div className="h-64 bg-gray-100 rounded flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">売上推移</h3>
        <div className="h-64 bg-gray-50 rounded flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p>表示するデータがありません</p>
            <p className="text-sm mt-2">期間や店舗フィルタを変更してください</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">売上推移</h3>
      
      {/* Revenue Trend */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">売上金額（税抜）</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              tickFormatter={formatCurrency}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [
                formatCurrency(value), 
                '売上'
              ]}
              labelFormatter={(label) => `日付: ${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#4f46e5" 
              strokeWidth={2}
              dot={{ fill: '#4f46e5', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#4f46e5', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Customer Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Footfall vs Transactions */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">客数・取引数</h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                tickFormatter={formatNumber}
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  formatNumber(value), 
                  name === 'footfall' ? '客数' : '取引数'
                ]}
                labelFormatter={(label) => `日付: ${label}`}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
                iconType="rect"
              />
              <Bar 
                dataKey="footfall" 
                name="客数"
                fill="#10b981" 
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="transactions" 
                name="取引数"
                fill="#3b82f6" 
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Rate */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">転換率 (%)</h4>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                stroke="#6b7280"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={(value: any) => [`${value}%`, '転換率']}
                labelFormatter={(label) => `日付: ${label}`}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="conversionRate" 
                stroke="#f59e0b" 
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#f59e0b', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Summary */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">総売上:</span>
            <span className="ml-2 font-medium">
              {formatCurrency(chartData.reduce((sum, item) => sum + item.revenue, 0))}
            </span>
          </div>
          <div>
            <span className="text-gray-600">総客数:</span>
            <span className="ml-2 font-medium">
              {formatNumber(chartData.reduce((sum, item) => sum + item.footfall, 0))}
            </span>
          </div>
          <div>
            <span className="text-gray-600">総取引:</span>
            <span className="ml-2 font-medium">
              {formatNumber(chartData.reduce((sum, item) => sum + item.transactions, 0))}
            </span>
          </div>
          <div>
            <span className="text-gray-600">期間:</span>
            <span className="ml-2 font-medium">{chartData.length}日間</span>
          </div>
        </div>
      </div>
    </div>
  )
}