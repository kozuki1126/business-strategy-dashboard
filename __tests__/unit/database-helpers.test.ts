// Database Helper Functions Unit Tests for #004
// Task #004: データベーススキーマ作成 - ユニットテスト
// Created: 2025-08-19

import { jest } from '@jest/globals'

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn()
}

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  then: jest.fn()
}

// Mock the database helpers
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

import {
  getSalesData,
  getMarketData,
  getStoreSalesSummary,
  logAuditEvent,
  validateSalesInput,
  prepareSalesExportData
} from '@/lib/database/helpers'

describe('Database Helper Functions Unit Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseClient.from.mockReturnValue(mockQuery)
    mockSupabaseClient.rpc.mockReturnValue(mockQuery)
  })

  // ========================================
  // SALES DATA FUNCTIONS TESTS
  // ========================================

  describe('getSalesData', () => {
    test('should construct correct query with basic filters', async () => {
      const mockSalesData = [
        {
          id: '1',
          date: '2025-08-19',
          store_id: 'store1',
          revenue_ex_tax: 1000,
          tax: 100,
          footfall: 50,
          transactions: 25,
          dim_store: { name: 'Test Store', area: 'Tokyo' }
        }
      ]

      mockQuery.then.mockResolvedValue({ data: mockSalesData, error: null })

      const filters = {
        dateRange: { start: '2025-08-01', end: '2025-08-19' },
        storeIds: ['store1', 'store2']
      }

      const result = await getSalesData(mockSupabaseClient as any, filters)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sales')
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('dim_store'))
      expect(mockQuery.gte).toHaveBeenCalledWith('date', '2025-08-01')
      expect(mockQuery.lte).toHaveBeenCalledWith('date', '2025-08-19')
      expect(mockQuery.in).toHaveBeenCalledWith('store_id', ['store1', 'store2'])
      expect(mockQuery.order).toHaveBeenCalledWith('date', { ascending: false })

      // Check calculated fields
      expect(result[0]).toHaveProperty('total_revenue', 1100)
      expect(result[0]).toHaveProperty('average_transaction_value', 40)
      expect(result[0]).toHaveProperty('conversion_rate', 0.5)
      expect(result[0]).toHaveProperty('store_name', 'Test Store')
    })

    test('should handle department and category filters', async () => {
      mockQuery.then.mockResolvedValue({ data: [], error: null })

      const filters = {
        dateRange: { start: '2025-08-01', end: '2025-08-19' },
        departments: ['食品', '雑貨'],
        productCategories: ['おにぎり', '文具']
      }

      await getSalesData(mockSupabaseClient as any, filters)

      expect(mockQuery.in).toHaveBeenCalledWith('department', ['食品', '雑貨'])
      expect(mockQuery.in).toHaveBeenCalledWith('product_category', ['おにぎり', '文具'])
    })

    test('should handle database errors', async () => {
      const mockError = { message: 'Database connection failed' }
      mockQuery.then.mockResolvedValue({ data: null, error: mockError })

      const filters = {
        dateRange: { start: '2025-08-01', end: '2025-08-19' }
      }

      await expect(getSalesData(mockSupabaseClient as any, filters))
        .rejects.toThrow('Failed to fetch sales data: Database connection failed')
    })
  })

  describe('getStoreSalesSummary', () => {
    test('should calculate summary statistics correctly', async () => {
      const mockSalesData = [
        { revenue_ex_tax: 1000, footfall: 100, transactions: 50, discounts: 50 },
        { revenue_ex_tax: 2000, footfall: 200, transactions: 100, discounts: 100 },
        { revenue_ex_tax: 1500, footfall: 150, transactions: 75, discounts: 75 }
      ]

      mockQuery.then.mockResolvedValue({ data: mockSalesData, error: null })

      const result = await getStoreSalesSummary(
        mockSupabaseClient as any,
        'store1',
        { start: '2025-08-01', end: '2025-08-19' }
      )

      expect(result.totalRevenue).toBe(4500)
      expect(result.totalFootfall).toBe(450)
      expect(result.totalTransactions).toBe(225)
      expect(result.totalDiscounts).toBe(225)
      expect(result.recordCount).toBe(3)
      expect(result.averageRevenue).toBe(1500)
      expect(result.conversionRate).toBe(0.5)
    })
  })

  // ========================================
  // EXTERNAL DATA FUNCTIONS TESTS
  // ========================================

  describe('getMarketData', () => {
    test('should filter by symbols and date range', async () => {
      const mockMarketData = [
        { symbol: 'TOPIX', value: 2450, date: '2025-08-19' }
      ]

      mockQuery.then.mockResolvedValue({ data: mockMarketData, error: null })

      await getMarketData(
        mockSupabaseClient as any,
        ['TOPIX', 'NIKKEI225'],
        { start: '2025-08-01', end: '2025-08-19' }
      )

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('ext_market_index')
      expect(mockQuery.in).toHaveBeenCalledWith('symbol', ['TOPIX', 'NIKKEI225'])
      expect(mockQuery.gte).toHaveBeenCalledWith('date', '2025-08-01')
      expect(mockQuery.lte).toHaveBeenCalledWith('date', '2025-08-19')
    })
  })

  // ========================================
  // VALIDATION FUNCTIONS TESTS
  // ========================================

  describe('validateSalesInput', () => {
    test('should return no errors for valid data', async () => {
      // Mock store exists
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockQuery,
        then: jest.fn().mockResolvedValue({ 
          data: { id: 'store1' }, 
          error: null 
        })
      })

      // Mock no duplicate exists
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockQuery,
        then: jest.fn().mockResolvedValue({ 
          data: [], 
          error: null 
        })
      })

      const validSalesData = {
        date: '2025-08-19',
        store_id: 'store1',
        department: '食品',
        product_category: 'おにぎり',
        revenue_ex_tax: 1000,
        footfall: 100,
        transactions: 50,
        discounts: 50
      }

      const errors = await validateSalesInput(mockSupabaseClient as any, validSalesData)
      expect(errors).toHaveLength(0)
    })

    test('should return errors for invalid data', async () => {
      // Mock store doesn't exist
      mockSupabaseClient.from.mockReturnValueOnce({
        ...mockQuery,
        then: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Not found' }
        })
      })

      const invalidSalesData = {
        date: '2025-08-19',
        store_id: 'invalid-store',
        department: '食品',
        product_category: 'おにぎり',
        revenue_ex_tax: -100, // Invalid negative
        footfall: 50,
        transactions: 100, // More than footfall
        discounts: 200 // More than revenue
      }

      const errors = await validateSalesInput(mockSupabaseClient as any, invalidSalesData)
      
      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some(e => e.field === 'store_id')).toBeTruthy()
      expect(errors.some(e => e.field === 'revenue_ex_tax')).toBeTruthy()
      expect(errors.some(e => e.field === 'footfall')).toBeTruthy()
      expect(errors.some(e => e.field === 'discounts')).toBeTruthy()
    })
  })

  // ========================================
  // AUDIT LOGGING TESTS
  // ========================================

  describe('logAuditEvent', () => {
    test('should insert audit log correctly', async () => {
      mockQuery.then.mockResolvedValue({ error: null })

      await logAuditEvent(
        mockSupabaseClient as any,
        'test_action',
        'test_target',
        { key: 'value' },
        'user123',
        '192.168.1.1',
        'Mozilla/5.0'
      )

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('audit_log')
      expect(mockQuery.insert).toHaveBeenCalledWith({
        actor_id: 'user123',
        action: 'test_action',
        target: 'test_target',
        ip: '192.168.1.1',
        ua: 'Mozilla/5.0',
        meta: { key: 'value' }
      })
    })

    test('should handle null values in audit log', async () => {
      mockQuery.then.mockResolvedValue({ error: null })

      await logAuditEvent(
        mockSupabaseClient as any,
        'test_action'
      )

      expect(mockQuery.insert).toHaveBeenCalledWith({
        actor_id: null,
        action: 'test_action',
        target: null,
        ip: null,
        ua: null,
        meta: null
      })
    })

    test('should not throw errors if audit logging fails', async () => {
      const mockError = { message: 'Audit log failed' }
      mockQuery.then.mockResolvedValue({ error: mockError })

      // Should not throw, just log to console
      expect(async () => {
        await logAuditEvent(mockSupabaseClient as any, 'test_action')
      }).not.toThrow()
    })
  })

  // ========================================
  // EXPORT FUNCTIONS TESTS
  // ========================================

  describe('prepareSalesExportData', () => {
    test('should format sales data for export correctly', async () => {
      const mockSalesData = [
        {
          id: '1',
          date: '2025-08-19',
          store_id: 'store1',
          department: '食品',
          product_category: 'おにぎり',
          revenue_ex_tax: 1000,
          footfall: 100,
          transactions: 50,
          discounts: 50,
          tax: 100,
          notes: 'テストデータ',
          total_revenue: 1100,
          average_transaction_value: 20,
          conversion_rate: 0.5,
          store_name: 'テスト店舗',
          area: '東京'
        }
      ]

      // Mock getSalesData function call
      mockQuery.then.mockResolvedValue({ data: mockSalesData, error: null })

      const filters = {
        dateRange: { start: '2025-08-01', end: '2025-08-19' }
      }

      const exportData = await prepareSalesExportData(mockSupabaseClient as any, filters)

      expect(exportData).toHaveLength(1)
      
      const row = exportData[0]
      expect(row['日付']).toBe('2025-08-19')
      expect(row['店舗名']).toBe('テスト店舗')
      expect(row['エリア']).toBe('東京')
      expect(row['部門']).toBe('食品')
      expect(row['商品カテゴリ']).toBe('おにぎり')
      expect(row['税抜売上']).toBe(1000)
      expect(row['総売上']).toBe(1100)
      expect(row['平均単価']).toBe('20.00')
      expect(row['転換率']).toBe('50.00%')
      expect(row['備考']).toBe('テストデータ')
    })

    test('should handle null values in export data', async () => {
      const mockSalesData = [
        {
          id: '1',
          date: '2025-08-19',
          store_id: 'store1',
          department: null,
          product_category: null,
          revenue_ex_tax: 1000,
          footfall: null,
          transactions: null,
          discounts: null,
          tax: null,
          notes: null,
          total_revenue: null,
          average_transaction_value: null,
          conversion_rate: null,
          store_name: null,
          area: null
        }
      ]

      mockQuery.then.mockResolvedValue({ data: mockSalesData, error: null })

      const filters = {
        dateRange: { start: '2025-08-01', end: '2025-08-19' }
      }

      const exportData = await prepareSalesExportData(mockSupabaseClient as any, filters)

      const row = exportData[0]
      expect(row['店舗名']).toBe('Unknown')
      expect(row['エリア']).toBe('Unknown')
      expect(row['部門']).toBe('')
      expect(row['商品カテゴリ']).toBe('')
      expect(row['客数']).toBe(0)
      expect(row['平均単価']).toBe('')
      expect(row['転換率']).toBe('')
      expect(row['備考']).toBe('')
    })
  })

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    test('should propagate database errors correctly', async () => {
      const mockError = { message: 'Connection timeout' }
      mockQuery.then.mockResolvedValue({ data: null, error: mockError })

      await expect(getSalesData(mockSupabaseClient as any, {
        dateRange: { start: '2025-08-01', end: '2025-08-19' }
      })).rejects.toThrow('Failed to fetch sales data: Connection timeout')
    })

    test('should handle network errors gracefully', async () => {
      mockQuery.then.mockRejectedValue(new Error('Network error'))

      await expect(getSalesData(mockSupabaseClient as any, {
        dateRange: { start: '2025-08-01', end: '2025-08-19' }
      })).rejects.toThrow('Network error')
    })
  })

  // ========================================
  // EDGE CASES TESTS
  // ========================================

  describe('Edge Cases', () => {
    test('should handle empty result sets', async () => {
      mockQuery.then.mockResolvedValue({ data: [], error: null })

      const result = await getSalesData(mockSupabaseClient as any, {
        dateRange: { start: '2025-08-01', end: '2025-08-19' }
      })

      expect(result).toEqual([])
    })

    test('should handle null/undefined values in calculations', async () => {
      const mockSalesData = [
        {
          id: '1',
          revenue_ex_tax: null,
          tax: null,
          footfall: null,
          transactions: null,
          dim_store: null
        }
      ]

      mockQuery.then.mockResolvedValue({ data: mockSalesData, error: null })

      const result = await getSalesData(mockSupabaseClient as any, {
        dateRange: { start: '2025-08-01', end: '2025-08-19' }
      })

      expect(result[0].total_revenue).toBe(0)
      expect(result[0].average_transaction_value).toBeNull()
      expect(result[0].conversion_rate).toBeNull()
      expect(result[0].store_name).toBeUndefined()
    })
  })
})
