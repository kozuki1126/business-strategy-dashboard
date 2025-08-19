'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { 
  salesInputSchema, 
  type SalesInput, 
  getDefaultSalesInput,
  formFieldConfig,
  calculateMetrics
} from '@/lib/validations/sales'
import { Button } from '@/components/ui/Button'
import { AlertCircle, Calculator, Save, X } from 'lucide-react'

interface Store {
  id: string
  name: string
  code: string
  area: string
}

interface Department {
  id: string
  name: string
  category: string
}

interface SalesFormProps {
  onSubmit: (data: SalesInput) => Promise<void>
  onCancel?: () => void
  initialData?: Partial<SalesInput>
  stores: Store[]
  departments: Department[]
  isLoading?: boolean
  isEdit?: boolean
}

export default function SalesForm({
  onSubmit,
  onCancel,
  initialData,
  stores,
  departments,
  isLoading = false,
  isEdit = false
}: SalesFormProps) {
  const [showMetrics, setShowMetrics] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid, isDirty }
  } = useForm<SalesInput>({
    resolver: zodResolver(salesInputSchema),
    defaultValues: {
      ...getDefaultSalesInput(),
      ...initialData
    },
    mode: 'onChange'
  })

  // Watch form values for real-time calculations
  const watchedValues = watch()
  const metrics = calculateMetrics(watchedValues)

  // Auto-calculate tax amount when revenue changes
  useEffect(() => {
    const revenue = watchedValues.revenue_ex_tax
    if (revenue && revenue > 0) {
      const estimatedTax = revenue * 0.1 // 10% default tax rate
      setValue('tax_amount', Math.round(estimatedTax))
    }
  }, [watchedValues.revenue_ex_tax, setValue])

  const handleFormSubmit = async (data: SalesInput) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      if (!isEdit) {
        reset()
        setShowMetrics(false)
      }
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    reset()
    setShowMetrics(false)
    onCancel?.()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? '売上データ編集' : '売上データ入力'}
          </h2>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMetrics(!showMetrics)}
              className="flex items-center space-x-2"
            >
              <Calculator className="w-4 h-4" />
              <span>{showMetrics ? '計算結果を隠す' : '計算結果を表示'}</span>
            </Button>
          </div>
        </div>

        {/* Calculation Preview */}
        {showMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium">税込売上</div>
              <div className="text-lg font-bold text-blue-900">
                ¥{metrics.totalRevenue.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium">税率</div>
              <div className="text-lg font-bold text-blue-900">
                {metrics.taxRate.toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium">客単価</div>
              <div className="text-lg font-bold text-blue-900">
                ¥{metrics.averageOrderValue.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium">転換率</div>
              <div className="text-lg font-bold text-blue-900">
                {metrics.conversionRate.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">基本情報</h3>
            
            {/* Date */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                {formFieldConfig.date.label}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                {...register('date')}
                type="date"
                id="date"
                className={`input ${errors.date ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
              />
              {errors.date && (
                <div className="flex items-center mt-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.date.message}
                </div>
              )}
            </div>

            {/* Store */}
            <div>
              <label htmlFor="store_id" className="block text-sm font-medium text-gray-700 mb-1">
                {formFieldConfig.store_id.label}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                {...register('store_id')}
                id="store_id"
                className={`input ${errors.store_id ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">{formFieldConfig.store_id.placeholder}</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name} ({store.code}) - {store.area}
                  </option>
                ))}
              </select>
              {errors.store_id && (
                <div className="flex items-center mt-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.store_id.message}
                </div>
              )}
            </div>

            {/* Department */}
            <div>
              <label htmlFor="department_id" className="block text-sm font-medium text-gray-700 mb-1">
                {formFieldConfig.department_id.label}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <select
                {...register('department_id')}
                id="department_id"
                className={`input ${errors.department_id ? 'border-red-500' : ''}`}
                disabled={isSubmitting}
              >
                <option value="">{formFieldConfig.department_id.placeholder}</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.category})
                  </option>
                ))}
              </select>
              {errors.department_id && (
                <div className="flex items-center mt-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.department_id.message}
                </div>
              )}
            </div>
          </div>

          {/* Financial Data */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">売上データ</h3>
            
            {/* Revenue (Ex-Tax) */}
            <div>
              <label htmlFor="revenue_ex_tax" className="block text-sm font-medium text-gray-700 mb-1">
                {formFieldConfig.revenue_ex_tax.label}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">¥</span>
                <input
                  {...register('revenue_ex_tax', { valueAsNumber: true })}
                  type="number"
                  id="revenue_ex_tax"
                  step="0.01"
                  min="0"
                  max="100000000"
                  className={`input pl-8 ${errors.revenue_ex_tax ? 'border-red-500' : ''}`}
                  placeholder={formFieldConfig.revenue_ex_tax.placeholder}
                  disabled={isSubmitting}
                />
              </div>
              {errors.revenue_ex_tax && (
                <div className="flex items-center mt-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.revenue_ex_tax.message}
                </div>
              )}
            </div>

            {/* Tax Amount */}
            <div>
              <label htmlFor="tax_amount" className="block text-sm font-medium text-gray-700 mb-1">
                {formFieldConfig.tax_amount.label}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">¥</span>
                <input
                  {...register('tax_amount', { valueAsNumber: true })}
                  type="number"
                  id="tax_amount"
                  step="0.01"
                  min="0"
                  max="10000000"
                  className={`input pl-8 ${errors.tax_amount ? 'border-red-500' : ''}`}
                  placeholder={formFieldConfig.tax_amount.placeholder}
                  disabled={isSubmitting}
                />
              </div>
              {errors.tax_amount && (
                <div className="flex items-center mt-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.tax_amount.message}
                </div>
              )}
            </div>

            {/* Footfall */}
            <div>
              <label htmlFor="footfall" className="block text-sm font-medium text-gray-700 mb-1">
                {formFieldConfig.footfall.label}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                {...register('footfall', { valueAsNumber: true })}
                type="number"
                id="footfall"
                min="0"
                max="100000"
                className={`input ${errors.footfall ? 'border-red-500' : ''}`}
                placeholder={formFieldConfig.footfall.placeholder}
                disabled={isSubmitting}
              />
              {errors.footfall && (
                <div className="flex items-center mt-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.footfall.message}
                </div>
              )}
            </div>

            {/* Transactions */}
            <div>
              <label htmlFor="transactions" className="block text-sm font-medium text-gray-700 mb-1">
                {formFieldConfig.transactions.label}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                {...register('transactions', { valueAsNumber: true })}
                type="number"
                id="transactions"
                min="0"
                max="50000"
                className={`input ${errors.transactions ? 'border-red-500' : ''}`}
                placeholder={formFieldConfig.transactions.placeholder}
                disabled={isSubmitting}
              />
              {errors.transactions && (
                <div className="flex items-center mt-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.transactions.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            {formFieldConfig.notes.label}
          </label>
          <textarea
            {...register('notes')}
            id="notes"
            rows={3}
            maxLength={500}
            className={`input ${errors.notes ? 'border-red-500' : ''}`}
            placeholder={formFieldConfig.notes.placeholder}
            disabled={isSubmitting}
          />
          {errors.notes && (
            <div className="flex items-center mt-1 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.notes.message}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {watchedValues.notes?.length || 0}/500文字
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex items-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>キャンセル</span>
            </Button>
          )}
          
          <Button
            type="submit"
            disabled={!isValid || !isDirty || isSubmitting || isLoading}
            className="flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSubmitting ? '保存中...' : isEdit ? '更新する' : '登録する'}
            </span>
          </Button>
        </div>

        {/* Form Status */}
        {Object.keys(errors).length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center text-red-800">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">入力エラーがあります</span>
            </div>
            <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>{error?.message}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  )
}
