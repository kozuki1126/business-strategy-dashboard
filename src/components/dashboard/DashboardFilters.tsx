'use client'

import { useState } from 'react'
import { DashboardFilters } from '@/types/database.types'
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns'
import { Calendar, Store, Building, Package } from 'lucide-react'

interface DashboardFiltersProps {
  filters: DashboardFilters
  stores: any[]
  onFiltersChange: (filters: DashboardFilters) => void
  disabled?: boolean
}

interface FilterPreset {
  label: string
  value: string
  dateRange: { start: string; end: string }
}

export function DashboardFilters({ 
  filters, 
  stores, 
  onFiltersChange, 
  disabled = false 
}: DashboardFiltersProps) {
  const [selectedPreset, setSelectedPreset] = useState('current-month')

  const filterPresets: FilterPreset[] = [
    {
      label: '当月',
      value: 'current-month',
      dateRange: {
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
      }
    },
    {
      label: '前月',
      value: 'last-month',
      dateRange: {
        start: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'),
        end: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
      }
    },
    {
      label: '過去7日',
      value: 'last-7-days',
      dateRange: {
        start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
      }
    },
    {
      label: '過去30日',
      value: 'last-30-days',
      dateRange: {
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
      }
    },
    {
      label: '当年',
      value: 'current-year',
      dateRange: {
        start: format(startOfYear(new Date()), 'yyyy-MM-dd'),
        end: format(endOfYear(new Date()), 'yyyy-MM-dd')
      }
    }
  ]

  const handlePresetChange = (presetValue: string) => {
    setSelectedPreset(presetValue)
    const preset = filterPresets.find(p => p.value === presetValue)
    if (preset) {
      onFiltersChange({
        ...filters,
        dateRange: preset.dateRange
      })
    }
  }

  const handleDateRangeChange = (start: string, end: string) => {
    setSelectedPreset('custom')
    onFiltersChange({
      ...filters,
      dateRange: { start, end }
    })
  }

  const handleStoreChange = (storeIds: string[]) => {
    onFiltersChange({
      ...filters,
      storeIds: storeIds.length > 0 ? storeIds : undefined
    })
  }

  const handleDepartmentChange = (departments: string[]) => {
    onFiltersChange({
      ...filters,
      departments: departments.length > 0 ? departments : undefined
    })
  }

  // Mock departments data (in real app, this would come from props or API)
  const mockDepartments = [
    '食品',
    '衣料',
    '雑貨',
    '家電',
    'サービス'
  ]

  return (
    <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center">
        <Calendar className="h-4 w-4 mr-2" />
        ダッシュボードフィルタ
      </h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Period Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            期間
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            disabled={disabled}
            className="input text-sm"
          >
            {filterPresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
            <option value="custom">カスタム期間</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {selectedPreset === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                開始日
              </label>
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => handleDateRangeChange(e.target.value, filters.dateRange.end)}
                disabled={disabled}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                終了日
              </label>
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => handleDateRangeChange(filters.dateRange.start, e.target.value)}
                disabled={disabled}
                className="input text-sm"
              />
            </div>
          </>
        )}

        {/* Store Selection */}
        <div className={selectedPreset === 'custom' ? 'lg:col-start-1' : ''}>
          <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center">
            <Store className="h-4 w-4 mr-1" />
            店舗
          </label>
          <select
            multiple
            value={filters.storeIds || []}
            onChange={(e) => {
              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
              handleStoreChange(selectedOptions)
            }}
            disabled={disabled}
            className="input text-sm h-20"
          >
            <option value="">全店舗</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name} {store.area && `(${store.area})`}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Ctrl/Cmd + クリックで複数選択
          </p>
        </div>

        {/* Department Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center">
            <Building className="h-4 w-4 mr-1" />
            部門
          </label>
          <select
            multiple
            value={filters.departments || []}
            onChange={(e) => {
              const selectedOptions = Array.from(e.target.selectedOptions, option => option.value)
              handleDepartmentChange(selectedOptions)
            }}
            disabled={disabled}
            className="input text-sm h-20"
          >
            <option value="">全部門</option>
            {mockDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Ctrl/Cmd + クリックで複数選択
          </p>
        </div>
      </div>

      {/* Current Filters Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="text-gray-600">現在のフィルタ:</span>
          
          <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-md">
            📅 {format(new Date(filters.dateRange.start), 'yyyy/MM/dd')} - {format(new Date(filters.dateRange.end), 'yyyy/MM/dd')}
          </span>
          
          {filters.storeIds && filters.storeIds.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-md">
              🏪 {filters.storeIds.length}店舗選択中
            </span>
          )}
          
          {filters.departments && filters.departments.length > 0 && (
            <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-md">
              🏢 {filters.departments.length}部門選択中
            </span>
          )}
          
          {!filters.storeIds && !filters.departments && (
            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
              全データ表示中
            </span>
          )}
        </div>
        
        {/* Quick Reset */}
        <div className="mt-2">
          <button
            onClick={() => onFiltersChange({
              dateRange: {
                start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
              },
              storeIds: undefined,
              departments: undefined,
              productCategories: undefined
            })}
            disabled={disabled}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline disabled:text-gray-400 disabled:no-underline"
          >
            フィルタをリセット（当月・全店舗・全部門）
          </button>
        </div>
      </div>

      {disabled && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
            データ読み込み中のため、フィルタ変更は無効です...
          </p>
        </div>
      )}
    </div>
  )
}