import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'

export interface SalesKPI {
  period: string
  totalRevenue: number
  totalFootfall: number
  totalTransactions: number
  averageOrderValue: number
  revenueGrowth: number
  footfallGrowth: number
  aovGrowth: number
}

export interface SalesTrend {
  date: string
  revenue: number
  footfall: number
  transactions: number
  aov: number
}

export interface SalesResponse {
  kpis: SalesKPI
  trends: SalesTrend[]
  stores: {
    id: string
    name: string
    revenue: number
    footfall: number
    transactions: number
  }[]
  departments: {
    id: string
    name: string
    revenue: number
    transactions: number
  }[]
}

function getPeriodDates(period: string, customDate?: Date) {
  const now = customDate || new Date()
  
  switch (period) {
    case 'current-month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
        compareStart: startOfMonth(subMonths(now, 1)),
        compareEnd: endOfMonth(subMonths(now, 1))
      }
    case 'last-month':
      const lastMonth = subMonths(now, 1)
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
        compareStart: startOfMonth(subMonths(lastMonth, 1)),
        compareEnd: endOfMonth(subMonths(lastMonth, 1))
      }
    case 'current-year':
      return {
        start: startOfYear(now),
        end: endOfYear(now),
        compareStart: startOfYear(subMonths(now, 12)),
        compareEnd: endOfYear(subMonths(now, 12))
      }
    default:
      throw new Error(`Unsupported period: ${period}`)
  }
}

async function calculateKPIs(
  period: string,
  storeId?: string
): Promise<SalesKPI> {
  const { start, end, compareStart, compareEnd } = getPeriodDates(period)
  
  // Build query with optional store filter
  let currentQuery = supabase
    .from('sales')
    .select(`
      revenue_ex_tax,
      footfall,
      transactions
    `)
    .gte('date', format(start, 'yyyy-MM-dd'))
    .lte('date', format(end, 'yyyy-MM-dd'))

  let compareQuery = supabase
    .from('sales')
    .select(`
      revenue_ex_tax,
      footfall,
      transactions
    `)
    .gte('date', format(compareStart, 'yyyy-MM-dd'))
    .lte('date', format(compareEnd, 'yyyy-MM-dd'))

  if (storeId && storeId !== 'all') {
    currentQuery = currentQuery.eq('store_id', storeId)
    compareQuery = compareQuery.eq('store_id', storeId)
  }

  const [{ data: currentData, error: currentError }, { data: compareData, error: compareError }] = 
    await Promise.all([currentQuery, compareQuery])

  if (currentError) throw currentError
  if (compareError) throw compareError

  // Calculate current period metrics
  const currentRevenue = currentData?.reduce((sum, row) => sum + (row.revenue_ex_tax || 0), 0) || 0
  const currentFootfall = currentData?.reduce((sum, row) => sum + (row.footfall || 0), 0) || 0
  const currentTransactions = currentData?.reduce((sum, row) => sum + (row.transactions || 0), 0) || 0
  const currentAOV = currentTransactions > 0 ? currentRevenue / currentTransactions : 0

  // Calculate comparison period metrics
  const compareRevenue = compareData?.reduce((sum, row) => sum + (row.revenue_ex_tax || 0), 0) || 0
  const compareFootfall = compareData?.reduce((sum, row) => sum + (row.footfall || 0), 0) || 0
  const compareTransactions = compareData?.reduce((sum, row) => sum + (row.transactions || 0), 0) || 0
  const compareAOV = compareTransactions > 0 ? compareRevenue / compareTransactions : 0

  // Calculate growth rates
  const revenueGrowth = compareRevenue > 0 ? ((currentRevenue - compareRevenue) / compareRevenue) * 100 : 0
  const footfallGrowth = compareFootfall > 0 ? ((currentFootfall - compareFootfall) / compareFootfall) * 100 : 0
  const aovGrowth = compareAOV > 0 ? ((currentAOV - compareAOV) / compareAOV) * 100 : 0

  return {
    period,
    totalRevenue: currentRevenue,
    totalFootfall: currentFootfall,
    totalTransactions: currentTransactions,
    averageOrderValue: currentAOV,
    revenueGrowth,
    footfallGrowth,
    aovGrowth
  }
}

async function getSalesTrends(
  period: string,
  storeId?: string
): Promise<SalesTrend[]> {
  const { start, end } = getPeriodDates(period)
  
  let query = supabase
    .from('sales')
    .select(`
      date,
      revenue_ex_tax,
      footfall,
      transactions
    `)
    .gte('date', format(start, 'yyyy-MM-dd'))
    .lte('date', format(end, 'yyyy-MM-dd'))
    .order('date', { ascending: true })

  if (storeId && storeId !== 'all') {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query

  if (error) throw error

  // Group by date and aggregate
  const groupedData = (data || []).reduce((acc, row) => {
    const date = row.date
    if (!acc[date]) {
      acc[date] = {
        date,
        revenue: 0,
        footfall: 0,
        transactions: 0
      }
    }
    acc[date].revenue += row.revenue_ex_tax || 0
    acc[date].footfall += row.footfall || 0
    acc[date].transactions += row.transactions || 0
    return acc
  }, {} as Record<string, { date: string; revenue: number; footfall: number; transactions: number }>)

  return Object.values(groupedData).map(item => ({
    ...item,
    aov: item.transactions > 0 ? item.revenue / item.transactions : 0
  }))
}

async function getStorePerformance(
  period: string
): Promise<SalesResponse['stores']> {
  const { start, end } = getPeriodDates(period)
  
  const { data, error } = await supabase
    .from('sales')
    .select(`
      store_id,
      revenue_ex_tax,
      footfall,
      transactions,
      dim_store:store_id(id, name)
    `)
    .gte('date', format(start, 'yyyy-MM-dd'))
    .lte('date', format(end, 'yyyy-MM-dd'))

  if (error) throw error

  // Group by store
  const storeData = (data || []).reduce((acc, row) => {
    const storeId = row.store_id
    const storeName = (row.dim_store as any)?.name || 'Unknown Store'
    
    if (!acc[storeId]) {
      acc[storeId] = {
        id: storeId,
        name: storeName,
        revenue: 0,
        footfall: 0,
        transactions: 0
      }
    }
    acc[storeId].revenue += row.revenue_ex_tax || 0
    acc[storeId].footfall += row.footfall || 0
    acc[storeId].transactions += row.transactions || 0
    return acc
  }, {} as Record<string, { id: string; name: string; revenue: number; footfall: number; transactions: number }>)

  return Object.values(storeData).sort((a, b) => b.revenue - a.revenue)
}

async function getDepartmentPerformance(
  period: string,
  storeId?: string
): Promise<SalesResponse['departments']> {
  const { start, end } = getPeriodDates(period)
  
  let query = supabase
    .from('sales')
    .select(`
      department_id,
      revenue_ex_tax,
      transactions,
      dim_department:department_id(id, name)
    `)
    .gte('date', format(start, 'yyyy-MM-dd'))
    .lte('date', format(end, 'yyyy-MM-dd'))

  if (storeId && storeId !== 'all') {
    query = query.eq('store_id', storeId)
  }

  const { data, error } = await query

  if (error) throw error

  // Group by department
  const deptData = (data || []).reduce((acc, row) => {
    const deptId = row.department_id
    const deptName = (row.dim_department as any)?.name || 'Unknown Department'
    
    if (!acc[deptId]) {
      acc[deptId] = {
        id: deptId,
        name: deptName,
        revenue: 0,
        transactions: 0
      }
    }
    acc[deptId].revenue += row.revenue_ex_tax || 0
    acc[deptId].transactions += row.transactions || 0
    return acc
  }, {} as Record<string, { id: string; name: string; revenue: number; transactions: number }>)

  return Object.values(deptData).sort((a, b) => b.revenue - a.revenue)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'current-month'
    const storeId = searchParams.get('store') || 'all'

    // Validate period
    if (!['current-month', 'last-month', 'current-year'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be current-month, last-month, or current-year' },
        { status: 400 }
      )
    }

    // Fetch all data in parallel
    const [kpis, trends, stores, departments] = await Promise.all([
      calculateKPIs(period, storeId),
      getSalesTrends(period, storeId),
      getStorePerformance(period),
      getDepartmentPerformance(period, storeId)
    ])

    const response: SalesResponse = {
      kpis,
      trends,
      stores,
      departments
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' // 5min cache, 10min stale
      }
    })

  } catch (error) {
    console.error('Sales API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch sales data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
