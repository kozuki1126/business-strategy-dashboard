'use client'

import { useState, useEffect } from 'react'
import { useRequireAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import SalesForm from '@/components/forms/SalesForm'
import { 
  type SalesInput,
  formFieldConfig 
} from '@/lib/validations/sales'
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Eye
} from 'lucide-react'

interface SalesRecord {
  id: string
  date: string
  revenue_ex_tax: number
  tax_amount: number
  footfall: number
  transactions: number
  notes?: string
  created_at: string
  updated_at: string
  dim_store: {
    id: string
    name: string
    code: string
    area: string
  }
  dim_department: {
    id: string
    name: string
    category: string
  }
  calculated_metrics: {
    total_revenue: number
    tax_rate: number
    average_order_value: number
    conversion_rate: number
  }
}

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

export default function SalesManagePage() {
  const { user, loading: authLoading, isAuthenticated } = useRequireAuth()
  
  // State management
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // UI state
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<SalesRecord | null>(null)
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])
  
  // Filters
  const [filters, setFilters] = useState({
    store_id: '',
    department_id: '',
    start_date: '',
    end_date: '',
    search: ''
  })
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Fetch master data
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [storesRes, deptsRes] = await Promise.all([
          fetch('/api/sales?period=current-year&store=all'),
          fetch('/api/sales?period=current-year&store=all')
        ])

        if (storesRes.ok && deptsRes.ok) {
          const salesData = await storesRes.json()
          
          // Extract unique stores and departments from sales data
          const uniqueStores = salesData.stores || []
          const uniqueDepts = salesData.departments || []
          
          setStores(uniqueStores)
          setDepartments(uniqueDepts)
        }
      } catch (error) {
        console.error('Failed to fetch master data:', error)
      }
    }

    if (isAuthenticated) {
      fetchMasterData()
    }
  }, [isAuthenticated])

  // Fetch sales records
  const fetchSalesRecords = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      })
      
      const response = await fetch(`/api/sales/manage?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales records')
      }
      
      const data = await response.json()
      setSalesRecords(data.data || [])
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0
      }))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchSalesRecords()
    }
  }, [isAuthenticated, pagination.page, filters])

  // Handle form submission
  const handleCreateSales = async (data: SalesInput) => {
    try {
      const response = await fetch('/api/sales/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create sales record')
      }

      // Refresh data
      await fetchSalesRecords()
      setShowForm(false)
      
      // Show success message
      alert('売上データが正常に登録されました')
    } catch (error) {
      alert(`登録に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Handle edit submission
  const handleUpdateSales = async (data: SalesInput) => {
    if (!editingRecord) return
    
    try {
      const response = await fetch('/api/sales/manage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          id: editingRecord.id,
          edit_reason: '管理画面からの更新'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update sales record')
      }

      // Refresh data
      await fetchSalesRecords()
      setEditingRecord(null)
      setShowForm(false)
      
      alert('売上データが正常に更新されました')
    } catch (error) {
      alert(`更新に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Handle delete
  const handleDeleteRecord = async (record: SalesRecord) => {
    const reason = prompt('削除理由を入力してください:')
    if (!reason) return

    if (!confirm(`${record.date}の売上データを削除しますか？この操作は取り消せません。`)) {
      return
    }

    try {
      const response = await fetch(`/api/sales/manage?id=${record.id}&reason=${encodeURIComponent(reason)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete sales record')
      }

      await fetchSalesRecords()
      alert('売上データが削除されました')
    } catch (error) {
      alert(`削除に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="animate-spin h-8 w-8 text-white" />
          </div>
          <p className="text-gray-600">認証状態を確認中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <SalesForm
            onSubmit={editingRecord ? handleUpdateSales : handleCreateSales}
            onCancel={() => {
              setShowForm(false)
              setEditingRecord(null)
            }}
            initialData={editingRecord ? {
              date: editingRecord.date,
              store_id: editingRecord.dim_store.id,
              department_id: editingRecord.dim_department.id,
              revenue_ex_tax: editingRecord.revenue_ex_tax,
              tax_amount: editingRecord.tax_amount,
              footfall: editingRecord.footfall,
              transactions: editingRecord.transactions,
              notes: editingRecord.notes || ''
            } : undefined}
            stores={stores}
            departments={departments}
            isEdit={!!editingRecord}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">売上データ管理</h1>
              <p className="text-gray-600 mt-1">売上データの入力・編集・削除を行います</p>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => setShowForm(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>新規入力</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">店舗</label>
              <select
                value={filters.store_id}
                onChange={(e) => setFilters(prev => ({ ...prev, store_id: e.target.value }))}
                className="input"
              >
                <option value="">全店舗</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">部門</label>
              <select
                value={filters.department_id}
                onChange={(e) => setFilters(prev => ({ ...prev, department_id: e.target.value }))}
                className="input"
              >
                <option value="">全部門</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className="input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className="input"
              />
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <Button
              onClick={fetchSalesRecords}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Search className="w-4 h-4" />
              <span>検索</span>
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="animate-spin w-8 h-8 mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">データを読み込み中...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchSalesRecords} variant="outline">再試行</Button>
            </div>
          ) : salesRecords.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-4">売上データが見つかりません</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                最初の売上データを入力
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日付
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      店舗・部門
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      売上（税抜）
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      客数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      客単価
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      転換率
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {salesRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.date).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{record.dim_store.name}</div>
                          <div className="text-gray-500">{record.dim_department.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(record.revenue_ex_tax)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {record.footfall.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(record.calculated_metrics.average_order_value)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatPercentage(record.calculated_metrics.conversion_rate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Button
                            onClick={() => {
                              setEditingRecord(record)
                              setShowForm(true)
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteRecord(record)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                {pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}～
                {Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  variant="outline"
                  size="sm"
                >
                  前へ
                </Button>
                <Button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  variant="outline"
                  size="sm"
                >
                  次へ
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
