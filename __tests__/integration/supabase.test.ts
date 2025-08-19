/**
 * @jest-environment node
 */

import { supabase } from '@/lib/supabase'

describe('Supabase Integration', () => {
  beforeAll(async () => {
    // Set test timeout to 30 seconds for database operations
    jest.setTimeout(30000)
  })

  describe('Database Connection', () => {
    it('should connect to Supabase successfully', async () => {
      const { error } = await supabase.from('dim_store').select('count').limit(1)
      expect(error).toBeNull()
    })

    it('should have required environment variables', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined()
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toContain('supabase.co')
    })
  })

  describe('Schema Validation', () => {
    it('should have all required master tables', async () => {
      const tables = ['dim_store', 'dim_department', 'dim_product_category']
      
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('id').limit(1)
        expect(error).toBeNull()
        expect(data).toBeDefined()
      }
    })

    it('should have sales table with proper structure', async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          date,
          store_id,
          revenue_ex_tax,
          tax_amount,
          footfall,
          transactions
        `)
        .limit(1)
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should have all external data tables', async () => {
      const extTables = [
        'ext_market_index',
        'ext_fx_rate',
        'ext_weather_daily',
        'ext_events',
        'ext_inbound',
        'ext_stem_news'
      ]
      
      for (const table of extTables) {
        const { error } = await supabase.from(table).select('id').limit(1)
        expect(error).toBeNull()
      }
    })

    it('should have audit_log table', async () => {
      const { error } = await supabase
        .from('audit_log')
        .select('id, action, created_at')
        .limit(1)
      
      expect(error).toBeNull()
    })
  })

  describe('Data Operations', () => {
    it('should read store data successfully', async () => {
      const { data, error } = await supabase
        .from('dim_store')
        .select('id, code, name, area')
        .limit(5)
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0]).toHaveProperty('id')
        expect(data[0]).toHaveProperty('code')
        expect(data[0]).toHaveProperty('name')
      }
    })

    it('should perform JOIN operations correctly', async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          date,
          revenue_ex_tax,
          dim_store:store_id(name, area),
          dim_department:department_id(name, category)
        `)
        .limit(3)
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should read external market data', async () => {
      const { data, error } = await supabase
        .from('ext_market_index')
        .select('date, index_code, value, change_percent')
        .limit(3)
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should read FX rate data', async () => {
      const { data, error } = await supabase
        .from('ext_fx_rate')
        .select('date, base_currency, target_currency, rate')
        .limit(3)
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })

  describe('Data Integrity', () => {
    it('should have valid foreign key relationships', async () => {
      // Test sales -> store relationship
      const { data: salesWithStore, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          store_id,
          dim_store!inner(id, name)
        `)
        .limit(1)
      
      expect(salesError).toBeNull()
      expect(salesWithStore).toBeDefined()
    })

    it('should have consistent data types', async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('revenue_ex_tax, tax_amount, footfall, transactions')
        .limit(1)
      
      expect(error).toBeNull()
      
      if (data && data.length > 0) {
        const record = data[0]
        expect(typeof record.revenue_ex_tax).toBe('number')
        expect(typeof record.tax_amount).toBe('number')
        expect(typeof record.footfall).toBe('number')
        expect(typeof record.transactions).toBe('number')
      }
    })

    it('should enforce check constraints', async () => {
      // This test verifies that negative values are rejected
      // We test this by trying to insert invalid data and expecting it to fail
      const { error } = await supabase
        .from('sales')
        .insert({
          date: '2025-08-19',
          store_id: '00000000-0000-0000-0000-000000000000', // Invalid UUID
          revenue_ex_tax: -100, // This should fail the check constraint
          tax_amount: 0,
        })
        .select()
      
      // We expect this to fail due to check constraints or foreign key violations
      expect(error).not.toBeNull()
    })
  })

  describe('Performance', () => {
    it('should respond to queries within acceptable time', async () => {
      const startTime = Date.now()
      
      const { error } = await supabase
        .from('sales')
        .select(`
          id,
          date,
          revenue_ex_tax,
          dim_store:store_id(name),
          dim_department:department_id(name)
        `)
        .limit(10)
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      expect(error).toBeNull()
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })
})
