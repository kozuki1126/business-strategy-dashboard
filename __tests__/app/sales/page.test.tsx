import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import SalesInputPage from '@/app/sales/page'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'

// Mock dependencies
jest.mock('next/navigation')
jest.mock('@/lib/auth')
jest.mock('@/lib/supabase/client')

const mockPush = jest.fn()
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

describe('SalesInputPage', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
    
    // Setup default mocks
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any)

    mockCreateClient.mockReturnValue(mockSupabaseClient as any)
    
    // Mock successful auth
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com'
    })

    // Mock successful stores data
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'dim_store') {
        return {
          ...mockSupabaseClient,
          select: () => ({
            ...mockSupabaseClient,
            order: () => Promise.resolve({
              data: [
                { id: 'store-1', name: '東京店', area: '関東' },
                { id: 'store-2', name: '大阪店', area: '関西' },
              ],
              error: null
            })
          })
        }
      }
      if (table === 'dim_department') {
        return {
          ...mockSupabaseClient,
          select: () => ({
            ...mockSupabaseClient,
            order: () => Promise.resolve({
              data: [
                { id: 'dept-1', name: 'food' },
                { id: 'dept-2', name: 'clothing' },
              ],
              error: null
            })
          })
        }
      }
      return mockSupabaseClient
    })

    // Mock successful API response
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: '売上データを保存しました',
        data: { id: 'sales-123' }
      })
    })
  })

  describe('Page Rendering', () => {
    it('認証済みユーザーの場合、フォームが正常に表示される', async () => {
      render(<SalesInputPage />)

      await waitFor(() => {
        expect(screen.getByText('売上入力')).toBeInTheDocument()
      })

      // Form fields are present
      expect(screen.getByLabelText(/日付/)).toBeInTheDocument()
      expect(screen.getByLabelText(/店舗/)).toBeInTheDocument()
      expect(screen.getByLabelText(/部門/)).toBeInTheDocument()
      expect(screen.getByLabelText(/商品カテゴリ/)).toBeInTheDocument()
      expect(screen.getByLabelText(/税抜売上/)).toBeInTheDocument()
      expect(screen.getByLabelText(/客数/)).toBeInTheDocument()
      expect(screen.getByLabelText(/取引数/)).toBeInTheDocument()
      expect(screen.getByLabelText(/割引額/)).toBeInTheDocument()
      expect(screen.getByLabelText(/備考/)).toBeInTheDocument()
    })

    it('未認証ユーザーの場合、認証ページにリダイレクトされる', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      render(<SalesInputPage />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth')
      })
    })

    it('ローディング中は適切な表示がされる', () => {
      // Make getCurrentUser hang to test loading state
      mockGetCurrentUser.mockImplementation(() => new Promise(() => {}))

      render(<SalesInputPage />)

      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
      expect(screen.getByRole('generic', { hidden: true })).toHaveClass('animate-spin')
    })
  })

  describe('Form Interaction', () => {
    beforeEach(async () => {
      render(<SalesInputPage />)
      await waitFor(() => {
        expect(screen.getByText('売上入力')).toBeInTheDocument()
      })
    })

    it('フォーム項目に値を入力できる', async () => {
      const dateInput = screen.getByLabelText(/日付/) as HTMLInputElement
      const revenueInput = screen.getByLabelText(/税抜売上/) as HTMLInputElement
      const footfallInput = screen.getByLabelText(/客数/) as HTMLInputElement

      fireEvent.change(dateInput, { target: { value: '2025-08-19' } })
      fireEvent.change(revenueInput, { target: { value: '120000' } })
      fireEvent.change(footfallInput, { target: { value: '250' } })

      expect(dateInput.value).toBe('2025-08-19')
      expect(revenueInput.value).toBe('120000')
      expect(footfallInput.value).toBe('250')
    })

    it('店舗選択ができる', async () => {
      await waitFor(() => {
        const storeSelect = screen.getByLabelText(/店舗/) as HTMLSelectElement
        expect(storeSelect).toBeInTheDocument()
      })

      const storeSelect = screen.getByLabelText(/店舗/) as HTMLSelectElement
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('東京店 (関東)')).toBeInTheDocument()
      })

      fireEvent.change(storeSelect, { target: { value: 'store-1' } })
      expect(storeSelect.value).toBe('store-1')
    })

    it('部門選択ができる', async () => {
      const departmentSelect = screen.getByLabelText(/部門/) as HTMLSelectElement
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('food')).toBeInTheDocument()
      })

      fireEvent.change(departmentSelect, { target: { value: 'food' } })
      expect(departmentSelect.value).toBe('food')
    })
  })

  describe('Form Validation', () => {
    beforeEach(async () => {
      render(<SalesInputPage />)
      await waitFor(() => {
        expect(screen.getByText('売上入力')).toBeInTheDocument()
      })
    })

    it('必須項目が未入力の場合、エラーメッセージが表示される', async () => {
      const submitButton = screen.getByRole('button', { name: /保存/ })
      
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('店舗を選択してください')).toBeInTheDocument()
        expect(screen.getByText('部門を選択してください')).toBeInTheDocument()
        expect(screen.getByText('商品カテゴリを選択してください')).toBeInTheDocument()
        expect(screen.getByText('税抜売上は1円以上で入力してください')).toBeInTheDocument()
      })
    })

    it('税抜売上が0以下の場合、エラーメッセージが表示される', async () => {
      const revenueInput = screen.getByLabelText(/税抜売上/)
      const submitButton = screen.getByRole('button', { name: /保存/ })

      fireEvent.change(revenueInput, { target: { value: '0' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('税抜売上は1円以上で入力してください')).toBeInTheDocument()
      })
    })

    it('客数が負の値の場合、エラーメッセージが表示される', async () => {
      const footfallInput = screen.getByLabelText(/客数/)
      const submitButton = screen.getByRole('button', { name: /保存/ })

      fireEvent.change(footfallInput, { target: { value: '-1' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('客数は0以上で入力してください')).toBeInTheDocument()
      })
    })

    it('取引数が負の値の場合、エラーメッセージが表示される', async () => {
      const transactionsInput = screen.getByLabelText(/取引数/)
      const submitButton = screen.getByRole('button', { name: /保存/ })

      fireEvent.change(transactionsInput, { target: { value: '-1' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('取引数は0以上で入力してください')).toBeInTheDocument()
      })
    })

    it('割引額が負の値の場合、エラーメッセージが表示される', async () => {
      const discountsInput = screen.getByLabelText(/割引額/)
      const submitButton = screen.getByRole('button', { name: /保存/ })

      fireEvent.change(discountsInput, { target: { value: '-1' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('割引額は0以上で入力してください')).toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    beforeEach(async () => {
      render(<SalesInputPage />)
      await waitFor(() => {
        expect(screen.getByText('売上入力')).toBeInTheDocument()
      })
    })

    it('正常なデータで送信が成功する', async () => {
      // Fill out the form with valid data
      await waitFor(() => {
        const storeSelect = screen.getByLabelText(/店舗/)
        expect(storeSelect).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/日付/), { 
        target: { value: '2025-08-19' } 
      })
      fireEvent.change(screen.getByLabelText(/店舗/), { 
        target: { value: 'store-1' } 
      })
      fireEvent.change(screen.getByLabelText(/部門/), { 
        target: { value: 'food' } 
      })
      fireEvent.change(screen.getByLabelText(/商品カテゴリ/), { 
        target: { value: 'daily_goods' } 
      })
      fireEvent.change(screen.getByLabelText(/税抜売上/), { 
        target: { value: '120000' } 
      })
      fireEvent.change(screen.getByLabelText(/客数/), { 
        target: { value: '250' } 
      })
      fireEvent.change(screen.getByLabelText(/取引数/), { 
        target: { value: '180' } 
      })

      const submitButton = screen.getByRole('button', { name: /保存/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/sales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: '2025-08-19',
            store_id: 'store-1',
            department: 'food',
            product_category: 'daily_goods',
            revenue_ex_tax: 120000,
            footfall: 250,
            transactions: 180,
            discounts: undefined,
            notes: '',
            created_by: 'user-123'
          })
        })
      })
    })

    it('送信中はボタンが無効になり、ローディング表示される', async () => {
      // Make fetch hang to test loading state
      ;(global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))

      // Fill required fields
      await waitFor(() => {
        const storeSelect = screen.getByLabelText(/店舗/)
        expect(storeSelect).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/日付/), { 
        target: { value: '2025-08-19' } 
      })
      fireEvent.change(screen.getByLabelText(/店舗/), { 
        target: { value: 'store-1' } 
      })
      fireEvent.change(screen.getByLabelText(/部門/), { 
        target: { value: 'food' } 
      })
      fireEvent.change(screen.getByLabelText(/商品カテゴリ/), { 
        target: { value: 'daily_goods' } 
      })
      fireEvent.change(screen.getByLabelText(/税抜売上/), { 
        target: { value: '120000' } 
      })

      const submitButton = screen.getByRole('button', { name: /保存/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('保存中...')).toBeInTheDocument()
        expect(submitButton).toBeDisabled()
      })
    })

    it('API エラーの場合、エラーメッセージが表示される', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          message: 'バリデーションエラー',
          errors: ['店舗が見つかりません']
        })
      })

      // Fill required fields
      await waitFor(() => {
        const storeSelect = screen.getByLabelText(/店舗/)
        expect(storeSelect).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/日付/), { 
        target: { value: '2025-08-19' } 
      })
      fireEvent.change(screen.getByLabelText(/店舗/), { 
        target: { value: 'store-1' } 
      })
      fireEvent.change(screen.getByLabelText(/部門/), { 
        target: { value: 'food' } 
      })
      fireEvent.change(screen.getByLabelText(/商品カテゴリ/), { 
        target: { value: 'daily_goods' } 
      })
      fireEvent.change(screen.getByLabelText(/税抜売上/), { 
        target: { value: '120000' } 
      })

      const submitButton = screen.getByRole('button', { name: /保存/ })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('バリデーションエラー')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    beforeEach(async () => {
      render(<SalesInputPage />)
      await waitFor(() => {
        expect(screen.getByText('売上入力')).toBeInTheDocument()
      })
    })

    it('ダッシュボードに戻るボタンが機能する', () => {
      const backButton = screen.getByRole('button', { name: /ダッシュボードに戻る/ })
      fireEvent.click(backButton)

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('キャンセルボタンが機能する', () => {
      const cancelButton = screen.getByRole('button', { name: /キャンセル/ })
      fireEvent.click(cancelButton)

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
