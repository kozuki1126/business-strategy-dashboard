// Database Schema Integration Tests for #004
// Task #004: データベーススキーマ作成 - 統合テスト
// Created: 2025-08-19

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { 
  getSalesData,
  getMarketData,
  getNearbyEvents,
  logAuditEvent,
  validateSalesInput,
  getAllStores
} from '@/lib/database/helpers'

// Test database client setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

describe('Database Schema Integration Tests', () => {
  
  // ========================================
  // BASIC CONNECTIVITY TESTS
  // ========================================
  
  describe('Database Connectivity', () => {
    test('should connect to Supabase successfully', async () => {
      const { data, error } = await supabase
        .from('dim_store')
        .select('count', { count: 'exact', head: true })
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    test('should have all required tables', async () => {
      const expectedTables = [
        'dim_store',
        'dim_department', 
        'sales',
        'ext_market_index',
        'ext_fx_rate',
        'ext_weather_daily',
        'ext_events',
        'ext_inbound',
        'ext_stem_news',
        'audit_log'
      ]

      for (const table of expectedTables) {
        const { error } = await supabase
          .from(table)
          .select('*', { head: true, count: 'exact' })
        
        expect(error).toBeNull()
      }
    })
  })

  // ========================================
  // CONSTRAINT VALIDATION TESTS
  // ========================================

  describe('Data Constraints', () => {
    test('should enforce sales revenue constraints', async () => {
      // Try to insert negative revenue (should fail)
      const { error } = await supabase
        .from('sales')
        .insert({
          date: '2025-08-19',
          store_id: '11111111-1111-1111-1111-111111111111',
          department: 'test',
          product_category: 'test',
          revenue_ex_tax: -100 // This should fail
        })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('sales_revenue_positive')
    })

    test('should enforce store coordinate constraints', async () => {
      const { error } = await supabase
        .from('dim_store')
        .insert({
          name: 'Test Store',
          lat: 200, // Invalid latitude (should fail)
          lng: 0
        })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('dim_store_lat_range')
    })

    test('should enforce weather humidity constraints', async () => {
      const { error } = await supabase
        .from('ext_weather_daily')
        .insert({
          date: '2025-08-19',
          location: 'Test Location',
          humidity_percent: 150 // Invalid humidity (should fail)
        })

      expect(error).not.toBeNull()
      expect(error?.message).toContain('ext_weather_humidity_range')
    })
  })

  // ========================================
  // INDEX PERFORMANCE TESTS
  // ========================================

  describe('Query Performance', () => {
    test('should use indexes for sales date queries', async () => {
      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .gte('date', '2025-08-01')
        .lte('date', '2025-08-19')
        .limit(100)

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(queryTime).toBeLessThan(1000) // Should complete within 1 second
    })

    test('should efficiently query sales by store and date', async () => {
      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('store_id', '11111111-1111-1111-1111-111111111111')
        .gte('date', '2025-08-01')
        .limit(50)

      const endTime = Date.now()
      const queryTime = endTime - startTime

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(queryTime).toBeLessThan(500) // Should be fast with index
    })
  })

  // ========================================
  // HELPER FUNCTION TESTS
  // ========================================

  describe('Database Helper Functions', () => {
    test('should get sales data with calculated fields', async () => {
      const filters = {
        dateRange: {
          start: '2025-08-01',
          end: '2025-08-19'
        },
        storeIds: ['11111111-1111-1111-1111-111111111111']
      }

      const salesData = await getSalesData(supabase, filters)
      
      expect(salesData).toBeInstanceOf(Array)
      if (salesData.length > 0) {
        const sale = salesData[0]
        expect(sale).toHaveProperty('total_revenue')
        expect(sale).toHaveProperty('store_name')
        expect(sale).toHaveProperty('area')
        
        if (sale.revenue_ex_tax && sale.tax) {
          expect(sale.total_revenue).toBe(sale.revenue_ex_tax + sale.tax)
        }
      }
    })

    test('should get market data with filtering', async () => {
      const marketData = await getMarketData(
        supabase,
        ['TOPIX', 'NIKKEI225'],
        { start: '2025-08-01', end: '2025-08-19' }
      )

      expect(marketData).toBeInstanceOf(Array)
      if (marketData.length > 0) {
        const dataPoint = marketData[0]
        expect(dataPoint).toHaveProperty('symbol')
        expect(dataPoint).toHaveProperty('value')
        expect(['TOPIX', 'NIKKEI225']).toContain(dataPoint.symbol)
      }
    })

    test('should get all stores', async () => {
      const stores = await getAllStores(supabase)
      
      expect(stores).toBeInstanceOf(Array)
      expect(stores.length).toBeGreaterThan(0)
      
      const store = stores[0]
      expect(store).toHaveProperty('id')
      expect(store).toHaveProperty('name')
      expect(store.name).toBeTruthy()
    })
  })

  // ========================================
  // UTILITY FUNCTION TESTS
  // ========================================

  describe('Utility Functions', () => {
    test('should calculate distance between coordinates', async () => {
      // Test the calculate_distance function
      const { data, error } = await supabase
        .rpc('calculate_distance', {
          lat1: 35.6762, // Tokyo Station
          lng1: 139.6503,
          lat2: 35.6896, // Shinjuku
          lng2: 139.7006
        })

      expect(error).toBeNull()
      expect(data).toBeGreaterThan(0)
      expect(data).toBeLessThan(10) // Should be within 10km
    })

    test('should get nearby events', async () => {
      // Assuming we have store data with coordinates
      const { data: stores } = await supabase
        .from('dim_store')
        .select('id, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(1)

      if (stores && stores.length > 0) {
        const store = stores[0]
        const nearbyEvents = await getNearbyEvents(
          supabase,
          store.id,
          '2025-08-19',
          10 // 10km radius
        )

        expect(nearbyEvents).toBeInstanceOf(Array)
        // Events array can be empty, which is valid
      }
    })
  })

  // ========================================
  // AUDIT LOGGING TESTS
  // ========================================

  describe('Audit Logging', () => {
    test('should log audit events', async () => {
      const testAction = 'test_action'
      const testTarget = 'test_target'
      const testMeta = { test: 'data', timestamp: new Date().toISOString() }

      await logAuditEvent(
        supabase,
        testAction as any,
        testTarget,
        testMeta
      )

      // Verify the audit log was created
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('action', testAction)
        .eq('target', testTarget)
        .order('at', { ascending: false })
        .limit(1)

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data[0].meta).toEqual(testMeta)
    })
  })

  // ========================================
  // DATA VALIDATION TESTS
  // ========================================

  describe('Data Validation', () => {
    test('should validate sales input correctly', async () => {
      const validSalesData = {
        date: '2025-08-19',
        store_id: '11111111-1111-1111-1111-111111111111',
        department: 'test',
        product_category: 'test',
        revenue_ex_tax: 1000,
        footfall: 100,
        transactions: 50,
        discounts: 50
      }

      const errors = await validateSalesInput(supabase, validSalesData)
      expect(errors).toHaveLength(0)
    })

    test('should catch validation errors', async () => {
      const invalidSalesData = {
        date: '2025-08-19',
        store_id: 'invalid-store-id',
        department: 'test',
        product_category: 'test',
        revenue_ex_tax: -100, // Invalid negative revenue
        footfall: 50,
        transactions: 100, // Invalid: more transactions than footfall
        discounts: 200 // Invalid: discounts exceed revenue
      }

      const errors = await validateSalesInput(supabase, invalidSalesData)
      expect(errors.length).toBeGreaterThan(0)
      
      // Check for specific validation errors
      const errorFields = errors.map(e => e.field)
      expect(errorFields).toContain('store_id')
      expect(errorFields).toContain('revenue_ex_tax')
      expect(errorFields).toContain('footfall')
      expect(errorFields).toContain('discounts')
    })
  })

  // ========================================
  // VIEWS AND MONITORING TESTS
  // ========================================

  describe('Monitoring Views', () => {
    test('should access table statistics view', async () => {
      const { data, error } = await supabase
        .from('v_table_stats')
        .select('*')
        .limit(10)

      expect(error).toBeNull()
      expect(data).toBeInstanceOf(Array)
    })

    test('should access slow queries view if pg_stat_statements is enabled', async () => {
      // This might not work in all environments
      const { data, error } = await supabase
        .from('v_slow_queries')
        .select('*')
        .limit(5)

      // Don't fail the test if pg_stat_statements is not available
      if (error && error.message.includes('pg_stat_statements')) {
        console.warn('pg_stat_statements not available, skipping slow queries test')
        return
      }
      
      expect(error).toBeNull()
      expect(data).toBeInstanceOf(Array)
    })
  })

  // ========================================
  // SEED DATA VERIFICATION TESTS
  // ========================================

  describe('Seed Data Verification', () => {
    test('should have basic seed data', async () => {
      // Check stores
      const { data: stores } = await supabase
        .from('dim_store')
        .select('count', { count: 'exact', head: true })
      expect(stores).toBeTruthy()

      // Check departments
      const { data: departments } = await supabase
        .from('dim_department')
        .select('count', { count: 'exact', head: true })
      expect(departments).toBeTruthy()

      // Check sales data
      const { data: sales } = await supabase
        .from('sales')
        .select('count', { count: 'exact', head: true })
      expect(sales).toBeTruthy()
    })

    test('should have external data', async () => {
      // Check market data
      const { data: marketData, error: marketError } = await supabase
        .from('ext_market_index')
        .select('*')
        .limit(1)
      
      expect(marketError).toBeNull()
      expect(marketData).toBeInstanceOf(Array)

      // Check weather data
      const { data: weatherData, error: weatherError } = await supabase
        .from('ext_weather_daily')
        .select('*')
        .limit(1)
      
      expect(weatherError).toBeNull()
      expect(weatherData).toBeInstanceOf(Array)
    })
  })

  // ========================================
  // CLEAN UP
  // ========================================

  afterAll(async () => {
    // Clean up any test data
    await supabase
      .from('audit_log')
      .delete()
      .eq('action', 'test_action')

    // Note: Don't delete actual seed data, only test-specific data
  })
})
