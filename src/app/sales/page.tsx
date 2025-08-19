'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/auth'
import { Database, SalesInputForm, ValidationError } from '@/types/database.types'

type Store = Database['public']['Tables']['dim_store']['Row']
type Department = Database['public']['Tables']['dim_department']['Row']

// 部門マスタ（初期値）
const DEFAULT_DEPARTMENTS = [
  'food', 'clothing', 'electronics', 'home', 'health', 'sports', 'other'
]

// 商品カテゴリ（初期値）
const DEFAULT_CATEGORIES = [
  'daily_goods', 'luxury', 'seasonal', 'promotional', 'imported', 'domestic', 'other'
]

export default function SalesInputPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [stores, setStores] = useState<Store[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [user, setUser] = useState<any>(null)
  
  const [formData, setFormData] = useState<SalesInputForm>({
    date: new Date().toISOString().split('T')[0], // 今日の日付
    store_id: '',
    department: '',
    product_category: '',
    revenue_ex_tax: 0,
    footfall: undefined,
    transactions: undefined,
    discounts: undefined,
    notes: ''
  })

  // 認証確認とマスタデータ取得
  useEffect(() => {
    const initializePage = async () => {
      setIsLoading(true)
      try {
        // 認証確認
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push('/auth')
          return
        }
        setUser(currentUser)

        const supabase = createClient()
        
        // 店舗マスタ取得
        const { data: storesData, error: storesError } = await supabase
          .from('dim_store')
          .select('*')
          .order('name')
        
        if (storesError) throw storesError
        setStores(storesData || [])

        // 部門マスタ取得
        const { data: departmentsData, error: departmentsError } = await supabase
          .from('dim_department')
          .select('*')
          .order('name')
        
        if (departmentsError) throw departmentsError
        setDepartments(departmentsData || [])

      } catch (error) {
        console.error('初期化エラー:', error)
        setErrors([{ field: 'general', message: 'データの取得に失敗しました', code: 'INIT_ERROR' }])
      } finally {
        setIsLoading(false)
      }
    }

    initializePage()
  }, [router])

  // フォーム値変更
  const handleInputChange = (field: keyof SalesInputForm, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // エラークリア
    setErrors(prev => prev.filter(error => error.field !== field))
  }

  // バリデーション
  const validateForm = (): ValidationError[] => {
    const newErrors: ValidationError[] = []

    if (!formData.date) {
      newErrors.push({ field: 'date', message: '日付は必須です', code: 'REQUIRED' })
    }

    if (!formData.store_id) {
      newErrors.push({ field: 'store_id', message: '店舗を選択してください', code: 'REQUIRED' })
    }

    if (!formData.department) {
      newErrors.push({ field: 'department', message: '部門を選択してください', code: 'REQUIRED' })
    }

    if (!formData.product_category) {
      newErrors.push({ field: 'product_category', message: '商品カテゴリを選択してください', code: 'REQUIRED' })
    }

    if (formData.revenue_ex_tax <= 0) {
      newErrors.push({ field: 'revenue_ex_tax', message: '税抜売上は1円以上で入力してください', code: 'MIN_VALUE' })
    }

    if (formData.footfall !== undefined && formData.footfall < 0) {
      newErrors.push({ field: 'footfall', message: '客数は0以上で入力してください', code: 'MIN_VALUE' })
    }

    if (formData.transactions !== undefined && formData.transactions < 0) {
      newErrors.push({ field: 'transactions', message: '取引数は0以上で入力してください', code: 'MIN_VALUE' })
    }

    if (formData.discounts !== undefined && formData.discounts < 0) {
      newErrors.push({ field: 'discounts', message: '割引額は0以上で入力してください', code: 'MIN_VALUE' })
    }

    return newErrors
  }

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setErrors([])

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          created_by: user?.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || '売上データの保存に失敗しました')
      }

      const result = await response.json()
      
      // 成功時の処理
      alert('売上データを保存しました')
      
      // フォームリセット
      setFormData({
        date: new Date().toISOString().split('T')[0],
        store_id: '',
        department: '',
        product_category: '',
        revenue_ex_tax: 0,
        footfall: undefined,
        transactions: undefined,
        discounts: undefined,
        notes: ''
      })

    } catch (error) {
      console.error('売上保存エラー:', error)
      setErrors([{ 
        field: 'general', 
        message: error instanceof Error ? error.message : '保存に失敗しました', 
        code: 'SAVE_ERROR' 
      }])
    } finally {
      setIsSubmitting(false)
    }
  }

  // エラー表示ヘルパー
  const getFieldError = (field: string) => {
    return errors.find(error => error.field === field)?.message
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">売上入力</h1>
                <p className="text-sm text-gray-600 mt-1">
                  日々の売上データを入力してください（税抜金額で管理）
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                ダッシュボードに戻る
              </Button>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {errors.some(error => error.field === 'general') && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="ml-2 text-sm text-red-800">
                {errors.find(error => error.field === 'general')?.message}
              </p>
            </div>
          </div>
        )}

        {/* フォーム */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* 基本情報 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 日付 */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  日付 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('date') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                {getFieldError('date') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('date')}</p>
                )}
              </div>

              {/* 店舗 */}
              <div>
                <label htmlFor="store_id" className="block text-sm font-medium text-gray-700 mb-2">
                  店舗 <span className="text-red-500">*</span>
                </label>
                <select
                  id="store_id"
                  value={formData.store_id}
                  onChange={(e) => handleInputChange('store_id', e.target.value)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('store_id') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">店舗を選択</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} {store.area && `(${store.area})`}
                    </option>
                  ))}
                </select>
                {getFieldError('store_id') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('store_id')}</p>
                )}
              </div>
            </div>

            {/* 部門・カテゴリ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 部門 */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                  部門 <span className="text-red-500">*</span>
                </label>
                <select
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('department') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">部門を選択</option>
                  {departments.length > 0 
                    ? departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name}
                        </option>
                      ))
                    : DEFAULT_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))
                  }
                </select>
                {getFieldError('department') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('department')}</p>
                )}
              </div>

              {/* 商品カテゴリ */}
              <div>
                <label htmlFor="product_category" className="block text-sm font-medium text-gray-700 mb-2">
                  商品カテゴリ <span className="text-red-500">*</span>
                </label>
                <select
                  id="product_category"
                  value={formData.product_category}
                  onChange={(e) => handleInputChange('product_category', e.target.value)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('product_category') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">カテゴリを選択</option>
                  {DEFAULT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {getFieldError('product_category') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('product_category')}</p>
                )}
              </div>
            </div>

            {/* 売上データ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 税抜売上 */}
              <div>
                <label htmlFor="revenue_ex_tax" className="block text-sm font-medium text-gray-700 mb-2">
                  税抜売上 (円) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="revenue_ex_tax"
                  min="1"
                  step="1"
                  value={formData.revenue_ex_tax}
                  onChange={(e) => handleInputChange('revenue_ex_tax', Number(e.target.value))}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('revenue_ex_tax') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="例: 120000"
                  required
                />
                {getFieldError('revenue_ex_tax') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('revenue_ex_tax')}</p>
                )}
              </div>

              {/* 客数 */}
              <div>
                <label htmlFor="footfall" className="block text-sm font-medium text-gray-700 mb-2">
                  客数 (人)
                </label>
                <input
                  type="number"
                  id="footfall"
                  min="0"
                  step="1"
                  value={formData.footfall || ''}
                  onChange={(e) => handleInputChange('footfall', e.target.value ? Number(e.target.value) : undefined)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('footfall') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="例: 250"
                />
                {getFieldError('footfall') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('footfall')}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 取引数 */}
              <div>
                <label htmlFor="transactions" className="block text-sm font-medium text-gray-700 mb-2">
                  取引数
                </label>
                <input
                  type="number"
                  id="transactions"
                  min="0"
                  step="1"
                  value={formData.transactions || ''}
                  onChange={(e) => handleInputChange('transactions', e.target.value ? Number(e.target.value) : undefined)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('transactions') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="例: 180"
                />
                {getFieldError('transactions') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('transactions')}</p>
                )}
              </div>

              {/* 割引額 */}
              <div>
                <label htmlFor="discounts" className="block text-sm font-medium text-gray-700 mb-2">
                  割引額 (円)
                </label>
                <input
                  type="number"
                  id="discounts"
                  min="0"
                  step="1"
                  value={formData.discounts || ''}
                  onChange={(e) => handleInputChange('discounts', e.target.value ? Number(e.target.value) : undefined)}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    getFieldError('discounts') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="例: 5000"
                />
                {getFieldError('discounts') && (
                  <p className="mt-1 text-sm text-red-600">{getFieldError('discounts')}</p>
                )}
              </div>
            </div>

            {/* 備考 */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                備考
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="特記事項があれば入力してください"
              />
            </div>

            {/* 送信ボタン */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={isSubmitting}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    保存
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
