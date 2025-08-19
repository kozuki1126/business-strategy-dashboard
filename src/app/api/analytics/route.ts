import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalyticsData, logAuditEvent } from '@/lib/database/helpers'
import { DashboardFilters } from '@/types/database.types'

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  
  try {
    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')
    const storeIds = searchParams.get('storeIds')?.split(',').filter(Boolean)
    const departments = searchParams.get('departments')?.split(',').filter(Boolean)
    const productCategories = searchParams.get('productCategories')?.split(',').filter(Boolean)

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const filters: DashboardFilters = {
      dateRange: { start: startDate, end: endDate },
      storeIds: storeIds?.length ? storeIds : undefined,
      departments: departments?.length ? departments : undefined,
      productCategories: productCategories?.length ? productCategories : undefined
    }

    // Get analytics data
    const analyticsData = await getAnalyticsData(supabase, filters)

    // Log API access
    await logAuditEvent(
      supabase,
      'view_dashboard',
      'analytics_api',
      { 
        filters,
        response_time_ms: performance.now() - startTime
      },
      user.id,
      request.ip,
      request.headers.get('user-agent') || undefined
    )

    const endTime = performance.now()
    const responseTime = endTime - startTime

    return NextResponse.json({
      data: analyticsData,
      meta: {
        response_time_ms: Math.round(responseTime),
        user_id: user.id,
        timestamp: new Date().toISOString(),
        filters_applied: filters
      }
    })

  } catch (error) {
    console.error('Analytics API error:', error)
    
    const endTime = performance.now()
    const responseTime = endTime - startTime

    // Log error
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        await logAuditEvent(
          supabase,
          'view_dashboard',
          'analytics_api_error',
          { 
            error: error instanceof Error ? error.message : 'Unknown error',
            response_time_ms: responseTime
          },
          user.id,
          request.ip,
          request.headers.get('user-agent') || undefined
        )
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { filters } = body as { filters: DashboardFilters }

    if (!filters?.dateRange?.start || !filters?.dateRange?.end) {
      return NextResponse.json(
        { error: 'Invalid filters: dateRange is required' },
        { status: 400 }
      )
    }

    const startTime = performance.now()

    // Get analytics data
    const analyticsData = await getAnalyticsData(supabase, filters)

    // Log API access
    await logAuditEvent(
      supabase,
      'view_dashboard',
      'analytics_api_post',
      { 
        filters,
        response_time_ms: performance.now() - startTime
      },
      user.id,
      request.ip,
      request.headers.get('user-agent') || undefined
    )

    const endTime = performance.now()
    const responseTime = endTime - startTime

    return NextResponse.json({
      data: analyticsData,
      meta: {
        response_time_ms: Math.round(responseTime),
        user_id: user.id,
        timestamp: new Date().toISOString(),
        filters_applied: filters
      }
    })

  } catch (error) {
    console.error('Analytics API POST error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Something went wrong'
      },
      { status: 500 }
    )
  }
}