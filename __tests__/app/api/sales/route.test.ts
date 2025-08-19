import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/sales/route'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// Mock dependencies
jest.mock('@/lib/auth')
jest.mock('@/lib/supabase/server')

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
}

// Helper function to create mock request
function createMockRequest(
  method: string, 
  url: string, 
  body?: any,
  headers?: Record<string, string>
): NextRequest {
  const request = new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  }) as any

  // Add mock properties
  request.ip = '127.0.0.1'
  request.headers.get = jest.fn((name: string) => {
    const headerMap: Record<string, string> = {
      'user-agent': 'Jest Test Agent',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    }
    return headerMap[name.toLowerCase()] || null
  })

  return request
}

describe('/api/sales', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockReturnValue(mockSupabaseClient as any)
  })

  describe('POST /api/sales', () => {
    const validSalesData = {
      date: '2025-08-19',
      store_id: 'store-123',
      department: 'food',
      product_category: 'daily_goods',
      revenue_ex_tax: 120000,
      footfall: 250,
      transactions: 180,
      discounts: 5000,
      notes: 'テストデータ'
    }

    describe('Authentication', () => {
      it('認証されていない場合、401エラーを返す', async () => {
        mockGetCurrentUser.mockResolvedValue(null)

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', validSalesData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.success).toBe(false)
        expect(data.message).toBe('認証が必要です')
      })

      it('認証済みユーザーの場合、処理が継続される', async () => {
        mockGetCurrentUser.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com'
        })

        // Mock store validation success
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'dim_store') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'store-123', name: '東京店' },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  maybeSingle: () => Promise.resolve({ data: null, error: null })
                })
              }),
              insert: () => ({
                ...mockSupabaseClient,
                select: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'sales-123', ...validSalesData, tax: 12000 },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'audit_log') {
            return {
              ...mockSupabaseClient,
              insert: () => Promise.resolve({ error: null })
            }
          }
          return mockSupabaseClient
        })

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', validSalesData)
        const response = await POST(request)

        expect(response.status).toBe(200)
      })
    })

    describe('Request Validation', () => {
      beforeEach(() => {
        mockGetCurrentUser.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com'
        })
      })

      it('不正なJSONの場合、400エラーを返す', async () => {
        const request = createMockRequest('POST', 'http://localhost:3000/api/sales')
        // Override json method to throw error
        request.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'))

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.message).toBe('リクエストデータの形式が正しくありません')
      })

      it('必須フィールドが不足している場合、400エラーを返す', async () => {
        const invalidData = { ...validSalesData }
        delete invalidData.date
        delete invalidData.store_id

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', invalidData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.message).toBe('バリデーションエラー')
        expect(data.errors).toContain('日付は必須です')
        expect(data.errors).toContain('店舗IDは必須です')
      })

      it('税抜売上が0以下の場合、400エラーを返す', async () => {
        const invalidData = { ...validSalesData, revenue_ex_tax: -1000 }

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', invalidData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.errors).toContain('税抜売上は1円以上で入力してください')
      })

      it('客数が負の値の場合、400エラーを返す', async () => {
        const invalidData = { ...validSalesData, footfall: -10 }

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', invalidData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.errors).toContain('客数は0以上で入力してください')
      })

      it('取引数が負の値の場合、400エラーを返す', async () => {
        const invalidData = { ...validSalesData, transactions: -5 }

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', invalidData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.errors).toContain('取引数は0以上で入力してください')
      })

      it('割引額が負の値の場合、400エラーを返す', async () => {
        const invalidData = { ...validSalesData, discounts: -1000 }

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', invalidData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.errors).toContain('割引額は0以上で入力してください')
      })

      it('日付形式が不正な場合、400エラーを返す', async () => {
        const invalidData = { ...validSalesData, date: '2025/08/19' }

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', invalidData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.errors).toContain('日付の形式が正しくありません (YYYY-MM-DD)')
      })
    })

    describe('Business Logic', () => {
      beforeEach(() => {
        mockGetCurrentUser.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com'
        })
      })

      it('存在しない店舗IDの場合、400エラーを返す', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'dim_store') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({ data: null, error: { message: 'Store not found' } })
                })
              })
            }
          }
          return mockSupabaseClient
        })

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', validSalesData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.success).toBe(false)
        expect(data.message).toBe('指定された店舗が見つかりません')
      })

      it('重複データが存在する場合、409エラーを返す', async () => {
        // Mock store exists
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'dim_store') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'store-123', name: '東京店' },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  maybeSingle: () => Promise.resolve({
                    data: { id: 'existing-sales' },
                    error: null
                  })
                })
              })
            }
          }
          return mockSupabaseClient
        })

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', validSalesData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(409)
        expect(data.success).toBe(false)
        expect(data.message).toBe('同じ日付・店舗・部門・カテゴリの売上データが既に存在します')
      })

      it('正常なデータの場合、売上データが保存される', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'dim_store') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'store-123', name: '東京店' },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  maybeSingle: () => Promise.resolve({ data: null, error: null })
                })
              }),
              insert: () => ({
                ...mockSupabaseClient,
                select: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { 
                      id: 'sales-123', 
                      ...validSalesData, 
                      tax: 12000,
                      created_by: 'user-123',
                      created_at: '2025-08-19T12:00:00Z',
                      updated_at: '2025-08-19T12:00:00Z'
                    },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'audit_log') {
            return {
              ...mockSupabaseClient,
              insert: () => Promise.resolve({ error: null })
            }
          }
          return mockSupabaseClient
        })

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', validSalesData)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.message).toBe('売上データを保存しました')
        expect(data.data.id).toBe('sales-123')
        expect(data.data.revenue_ex_tax).toBe(120000)
        expect(data.data.tax).toBe(12000)
        expect(data.data.total_revenue).toBe(132000) // 120000 + 12000
      })

      it('税額が正しく計算される', async () => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'dim_store') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'store-123', name: '東京店' },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  maybeSingle: () => Promise.resolve({ data: null, error: null })
                })
              }),
              insert: (data: any) => {
                // Check if tax calculation is correct
                expect(data.tax).toBe(Math.round(data.revenue_ex_tax * 0.1))
                return {
                  ...mockSupabaseClient,
                  select: () => ({
                    ...mockSupabaseClient,
                    single: () => Promise.resolve({
                      data: { id: 'sales-123', ...data },
                      error: null
                    })
                  })
                }
              }
            }
          }
          if (table === 'audit_log') {
            return {
              ...mockSupabaseClient,
              insert: () => Promise.resolve({ error: null })
            }
          }
          return mockSupabaseClient
        })

        const testData = { ...validSalesData, revenue_ex_tax: 123456 }
        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', testData)
        const response = await POST(request)

        expect(response.status).toBe(200)
      })
    })

    describe('Audit Logging', () => {
      beforeEach(() => {
        mockGetCurrentUser.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com'
        })
      })

      it('成功時に監査ログが記録される', async () => {
        const insertAuditMock = jest.fn(() => Promise.resolve({ error: null }))
        
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'dim_store') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'store-123', name: '東京店' },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  maybeSingle: () => Promise.resolve({ data: null, error: null })
                })
              }),
              insert: () => ({
                ...mockSupabaseClient,
                select: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'sales-123', ...validSalesData, tax: 12000 },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'audit_log') {
            return {
              ...mockSupabaseClient,
              insert: insertAuditMock
            }
          }
          return mockSupabaseClient
        })

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', validSalesData)
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(insertAuditMock).toHaveBeenCalledWith(
          expect.objectContaining({
            actor_id: 'user-123',
            action: 'input_sales',
            target: 'sales:sales-123',
            meta: expect.objectContaining({
              store_id: 'store-123',
              store_name: '東京店',
              date: '2025-08-19',
              department: 'food',
              product_category: 'daily_goods',
              revenue_ex_tax: 120000,
              calculated_tax: 12000
            })
          })
        )
      })

      it('失敗時に監査ログが記録される', async () => {
        const insertAuditMock = jest.fn(() => Promise.resolve({ error: null }))
        
        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'dim_store') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: { id: 'store-123', name: '東京店' },
                    error: null
                  })
                })
              })
            }
          }
          if (table === 'sales') {
            return {
              ...mockSupabaseClient,
              select: () => ({
                ...mockSupabaseClient,
                eq: () => ({
                  ...mockSupabaseClient,
                  maybeSingle: () => Promise.resolve({ data: null, error: null })
                })
              }),
              insert: () => ({
                ...mockSupabaseClient,
                select: () => ({
                  ...mockSupabaseClient,
                  single: () => Promise.resolve({
                    data: null,
                    error: { message: 'Database error' }
                  })
                })
              })
            }
          }
          if (table === 'audit_log') {
            return {
              ...mockSupabaseClient,
              insert: insertAuditMock
            }
          }
          return mockSupabaseClient
        })

        const request = createMockRequest('POST', 'http://localhost:3000/api/sales', validSalesData)
        const response = await POST(request)

        expect(response.status).toBe(500)
        expect(insertAuditMock).toHaveBeenCalledWith(
          expect.objectContaining({
            actor_id: 'user-123',
            action: 'input_sales',
            target: 'sales:store-123:2025-08-19',
            meta: expect.objectContaining({
              error: 'Database error',
              attempted_data: validSalesData
            })
          })
        )
      })
    })
  })

  describe('GET /api/sales', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com'
      })
    })

    it('認証されていない場合、401エラーを返す', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest('GET', 'http://localhost:3000/api/sales')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.message).toBe('認証が必要です')
    })

    it('売上データが正常に取得される', async () => {
      const mockSalesData = [
        {
          id: 'sales-1',
          date: '2025-08-19',
          store_id: 'store-123',
          revenue_ex_tax: 120000,
          dim_store: { name: '東京店', area: '関東' }
        },
        {
          id: 'sales-2', 
          date: '2025-08-18',
          store_id: 'store-123',
          revenue_ex_tax: 110000,
          dim_store: { name: '東京店', area: '関東' }
        }
      ]

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sales') {
          return {
            ...mockSupabaseClient,
            select: () => ({
              ...mockSupabaseClient,
              order: () => ({
                ...mockSupabaseClient,
                limit: () => Promise.resolve({
                  data: mockSalesData,
                  error: null
                })
              })
            })
          }
        }
        if (table === 'audit_log') {
          return {
            ...mockSupabaseClient,
            insert: () => Promise.resolve({ error: null })
          }
        }
        return mockSupabaseClient
      })

      const request = createMockRequest('GET', 'http://localhost:3000/api/sales')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockSalesData)
      expect(data.meta.total).toBe(2)
    })

    it('フィルタパラメータが正しく適用される', async () => {
      const eqMock = jest.fn().mockReturnValue({
        ...mockSupabaseClient,
        order: () => ({
          ...mockSupabaseClient,
          limit: () => Promise.resolve({
            data: [],
            error: null
          })
        })
      })

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sales') {
          return {
            ...mockSupabaseClient,
            select: () => ({
              ...mockSupabaseClient,
              order: () => ({
                ...mockSupabaseClient,
                limit: () => ({
                  ...mockSupabaseClient,
                  eq: eqMock
                })
              })
            })
          }
        }
        if (table === 'audit_log') {
          return {
            ...mockSupabaseClient,
            insert: () => Promise.resolve({ error: null })
          }
        }
        return mockSupabaseClient
      })

      const request = createMockRequest('GET', 'http://localhost:3000/api/sales?store_id=store-123&date=2025-08-19&limit=20')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(eqMock).toHaveBeenCalledWith('store_id', 'store-123')
      expect(eqMock).toHaveBeenCalledWith('date', '2025-08-19')
    })
  })
})
