import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const tests = []
    
    // Test 1: Basic connectivity
    const { data: healthCheck, error: healthError } = await supabase
      .from('dim_store')
      .select('count')
      .limit(1)
    
    tests.push({
      name: 'Database Connectivity',
      status: healthError ? 'FAIL' : 'PASS',
      details: healthError ? healthError.message : 'Connection successful',
    })

    // Test 2: Read stores data
    const { data: stores, error: storesError } = await supabase
      .from('dim_store')
      .select('id, code, name, area')
      .limit(3)
    
    tests.push({
      name: 'Read Stores Data',
      status: storesError ? 'FAIL' : 'PASS',
      details: storesError 
        ? storesError.message 
        : `Found ${stores?.length || 0} stores`,
      data: stores?.slice(0, 2), // Return sample data
    })

    // Test 3: Read sales data with joins
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        date,
        revenue_ex_tax,
        footfall,
        dim_store:store_id(name, area),
        dim_department:department_id(name, category)
      `)
      .limit(3)
    
    tests.push({
      name: 'Read Sales Data with Joins',
      status: salesError ? 'FAIL' : 'PASS',
      details: salesError 
        ? salesError.message 
        : `Found ${salesData?.length || 0} sales records`,
      data: salesData?.slice(0, 1), // Return sample data
    })

    // Test 4: Read external data
    const { data: marketData, error: marketError } = await supabase
      .from('ext_market_index')
      .select('date, index_code, value, change_percent')
      .order('date', { ascending: false })
      .limit(2)
    
    tests.push({
      name: 'Read External Market Data',
      status: marketError ? 'FAIL' : 'PASS',
      details: marketError 
        ? marketError.message 
        : `Found ${marketData?.length || 0} market records`,
      data: marketData,
    })

    // Test 5: Read FX rates
    const { data: fxData, error: fxError } = await supabase
      .from('ext_fx_rate')
      .select('date, base_currency, target_currency, rate')
      .order('date', { ascending: false })
      .limit(3)
    
    tests.push({
      name: 'Read FX Rates',
      status: fxError ? 'FAIL' : 'PASS',
      details: fxError 
        ? fxError.message 
        : `Found ${fxData?.length || 0} FX records`,
      data: fxData,
    })

    // Summary
    const passedTests = tests.filter(t => t.status === 'PASS').length
    const totalTests = tests.length
    const allPassed = passedTests === totalTests

    return NextResponse.json({
      success: allPassed,
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        status: allPassed ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED',
      },
      tests,
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0] + '...[masked]',
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
    }, {
      status: allPassed ? 200 : 500,
    })

  } catch (error) {
    console.error('Database connection test failed:', error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      summary: {
        total: 0,
        passed: 0,
        failed: 1,
        status: 'CRITICAL_FAILURE',
      },
      tests: [{
        name: 'Critical Error',
        status: 'FAIL',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      }],
    }, {
      status: 500,
    })
  }
}
