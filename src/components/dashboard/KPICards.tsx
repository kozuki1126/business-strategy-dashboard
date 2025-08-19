'use client'

import { useMemo } from 'react'
import { SalesWithCalculated } from '@/types/database.types'
import { TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign } from 'lucide-react'

interface KPICardsProps {
  salesData: SalesWithCalculated[]
  loading?: boolean
}

export function KPICards({ salesData, loading }: KPICardsProps) {
  const kpiData = useMemo(() => {
    if (!salesData || salesData.length === 0) {
      return {
        totalRevenue: 0,
        totalFootfall: 0,
        totalTransactions: 0,
        averageTransactionValue: 0,
        conversionRate: 0
      }
    }

    const totals = salesData.reduce((acc, sale) => {
      acc.revenue += sale.revenue_ex_tax || 0
      acc.footfall += sale.footfall || 0
      acc.transactions += sale.transactions || 0
      return acc
    }, {
      revenue: 0,
      footfall: 0,
      transactions: 0
    })

    return {
      totalRevenue: totals.revenue,
      totalFootfall: totals.footfall,
      totalTransactions: totals.transactions,
      averageTransactionValue: totals.transactions > 0 ? 
        totals.revenue / totals.transactions : 0,
      conversionRate: totals.footfall > 0 ? 
        (totals.transactions / totals.footfall) * 100 : 0
    }
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

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  // Mock previous period data for comparison (in real app, this would come from props or API)
  const mockPreviousData = {
    totalRevenue: kpiData.totalRevenue * 0.95, // -5%
    totalFootfall: kpiData.totalFootfall * 1.02, // +2%
    totalTransactions: kpiData.totalTransactions * 0.98, // -2%
    averageTransactionValue: kpiData.averageTransactionValue * 1.07, // +7%
    conversionRate: kpiData.conversionRate * 0.96 // -4%
  }

  const getChangeData = (current: number, previous: number) => {
    if (!previous || previous === 0) {
      return { percentage: 0, isPositive: true, isNeutral: true }
    }
    
    const change = ((current - previous) / previous) * 100
    return {
      percentage: Math.abs(change),
      isPositive: change >= 0,
      isNeutral: Math.abs(change) < 0.1
    }
  }

  const TrendIcon = ({ isPositive, isNeutral }: { isPositive: boolean; isNeutral: boolean }) => {
    if (isNeutral) return null
    return isPositive ? 
      <TrendingUp className="h-4 w-4 text-green-500" /> : 
      <TrendingDown className="h-4 w-4 text-red-500" />
  }

  const getTrendColor = (isPositive: boolean, isNeutral: boolean) => {
    if (isNeutral) return 'text-gray-600'
    return isPositive ? 'text-green-600' : 'text-red-600'
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const revenueChange = getChangeData(kpiData.totalRevenue, mockPreviousData.totalRevenue)
  const footfallChange = getChangeData(kpiData.totalFootfall, mockPreviousData.totalFootfall)
  const transactionChange = getChangeData(kpiData.totalTransactions, mockPreviousData.totalTransactions)
  const avgTransactionChange = getChangeData(kpiData.averageTransactionValue, mockPreviousData.averageTransactionValue)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Revenue */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">
            売上（税抜）
          </h3>
          <DollarSign className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(kpiData.totalRevenue)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendIcon 
                isPositive={revenueChange.isPositive} 
                isNeutral={revenueChange.isNeutral} 
              />
              <p className={`text-sm ${getTrendColor(revenueChange.isPositive, revenueChange.isNeutral)}`}>
                {!revenueChange.isNeutral && (revenueChange.isPositive ? '+' : '-')}
                {revenueChange.percentage.toFixed(1)}% vs 前期
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Total Footfall */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">客数</h3>
          <Users className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(kpiData.totalFootfall)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendIcon 
                isPositive={footfallChange.isPositive} 
                isNeutral={footfallChange.isNeutral} 
              />
              <p className={`text-sm ${getTrendColor(footfallChange.isPositive, footfallChange.isNeutral)}`}>
                {!footfallChange.isNeutral && (footfallChange.isPositive ? '+' : '-')}
                {footfallChange.percentage.toFixed(1)}% vs 前期
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Total Transactions */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">取引数</h3>
          <ShoppingCart className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(kpiData.totalTransactions)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendIcon 
                isPositive={transactionChange.isPositive} 
                isNeutral={transactionChange.isNeutral} 
              />
              <p className={`text-sm ${getTrendColor(transactionChange.isPositive, transactionChange.isNeutral)}`}>
                {!transactionChange.isNeutral && (transactionChange.isPositive ? '+' : '-')}
                {transactionChange.percentage.toFixed(1)}% vs 前期
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Average Transaction Value */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">客単価</h3>
          <div className="h-5 w-5 text-gray-400 flex items-center justify-center text-xs font-bold">
            ¥
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(kpiData.averageTransactionValue)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendIcon 
                isPositive={avgTransactionChange.isPositive} 
                isNeutral={avgTransactionChange.isNeutral} 
              />
              <p className={`text-sm ${getTrendColor(avgTransactionChange.isPositive, avgTransactionChange.isNeutral)}`}>
                {!avgTransactionChange.isNeutral && (avgTransactionChange.isPositive ? '+' : '-')}
                {avgTransactionChange.percentage.toFixed(1)}% vs 前期
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional KPI Row - Conversion Rate & Days Tracked */}
      <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Conversion Rate */}
        <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-700">転換率</h3>
            <div className="text-blue-500 text-sm font-semibold">%</div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {formatPercent(kpiData.conversionRate)}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {kpiData.totalFootfall > 0 ? 
                  `${formatNumber(kpiData.totalTransactions)} / ${formatNumber(kpiData.totalFootfall)}` : 
                  'データなし'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Period Summary */}
        <div className="card bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">集計期間</h3>
            <div className="text-gray-500 text-sm">📊</div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {salesData.length}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                データポイント数
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}