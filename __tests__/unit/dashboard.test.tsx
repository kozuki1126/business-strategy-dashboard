/**
 * Dashboard Components Unit Tests
 * Task #006: ダッシュボードUI（α版）実装 - ユニットテスト
 * Created: 2025-08-19
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { KPICards } from '@/components/dashboard/KPICards'
import { ExternalIndicators } from '@/components/dashboard/ExternalIndicators'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { SalesWithCalculated, DashboardFilters as DashboardFiltersType } from '@/types/database.types'

// Mock data
const mockSalesData: SalesWithCalculated[] = [
  {
    id: '1',
    date: '2025-08-15',
    store_id: 'store-1',
    department: '食品',
    product_category: '生鮮',
    revenue_ex_tax: 150000,
    footfall: 250,
    transactions: 180,
    discounts: 5000,
    tax: 15000,
    notes: null,
    created_by: 'user-1',
    created_at: '2025-08-15T10:00:00Z',
    updated_at: '2025-08-15T10:00:00Z',
    total_revenue: 165000,
    average_transaction_value: 833.33,
    conversion_rate: 0.72,
    store_name: '店舗A',
    area: '東京'
  },
  {
    id: '2',
    date: '2025-08-16',
    store_id: 'store-1',
    department: '衣料',
    product_category: 'メンズ',
    revenue_ex_tax: 200000,
    footfall: 180,
    transactions: 120,
    discounts: 10000,
    tax: 20000,
    notes: null,
    created_by: 'user-1',
    created_at: '2025-08-16T10:00:00Z',
    updated_at: '2025-08-16T10:00:00Z',
    total_revenue: 220000,
    average_transaction_value: 1666.67,
    conversion_rate: 0.67,
    store_name: '店舗A',
    area: '東京'
  }
]

const mockMarketData = [
  {
    id: '1',
    date: '2025-08-19',
    symbol: 'TOPIX',
    value: 2450.75,
    change_percent: 1.2,
    updated_at: '2025-08-19T09:00:00Z'
  },
  {
    id: '2',
    date: '2025-08-19',
    symbol: 'NIKKEI225',
    value: 38250.50,
    change_percent: -0.8,
    updated_at: '2025-08-19T09:00:00Z'
  }
]

const mockWeatherData = [
  {
    id: '1',
    date: '2025-08-19',
    location: '東京',
    temperature_max: 32,
    temperature_min: 26,
    precipitation_mm: 0,
    humidity_percent: 65,
    weather_condition: 'sunny',
    updated_at: '2025-08-19T06:00:00Z'
  }
]

const mockEvents = [
  {
    id: '1',
    date: '2025-08-20',
    title: '夏祭り',
    location: '渋谷区',
    lat: 35.6595,
    lng: 139.7006,
    event_type: 'festival',
    expected_attendance: 5000,
    notes: '大規模な夏祭りイベント',
    updated_at: '2025-08-19T12:00:00Z'
  }
]

const mockStores = [
  { id: 'store-1', name: '店舗A', area: '東京' },
  { id: 'store-2', name: '店舗B', area: '大阪' }
]

const mockFilters: DashboardFiltersType = {
  dateRange: {
    start: '2025-08-01',
    end: '2025-08-31'
  },
  storeIds: undefined,
  departments: undefined,
  productCategories: undefined
}

// Mock Recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  LineChart: ({ children }: any) => <div data-testid=\"line-chart\">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid=\"bar-chart\">{children}</div>,
  Line: () => <div data-testid=\"line\" />,
  Bar: () => <div data-testid=\"bar\" />,
  XAxis: () => <div data-testid=\"x-axis\" />,
  YAxis: () => <div data-testid=\"y-axis\" />,
  CartesianGrid: () => <div data-testid=\"grid\" />,
  Tooltip: () => <div data-testid=\"tooltip\" />,
  Legend: () => <div data-testid=\"legend\" />
}))

describe('SalesChart Component', () => {
  it('renders chart with sales data', () => {
    render(<SalesChart salesData={mockSalesData} />)
    
    expect(screen.getByText('売上推移')).toBeInTheDocument()
    expect(screen.getByText('売上金額（税抜）')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<SalesChart salesData={[]} loading={true} />)
    
    expect(screen.getByText('売上推移')).toBeInTheDocument()
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument() // Loading spinner
  })

  it('shows no data state', () => {
    render(<SalesChart salesData={[]} />)
    
    expect(screen.getByText('表示するデータがありません')).toBeInTheDocument()
    expect(screen.getByText('期間や店舗フィルタを変更してください')).toBeInTheDocument()
  })

  it('displays data summary correctly', () => {
    render(<SalesChart salesData={mockSalesData} />)
    
    expect(screen.getByText('総売上:')).toBeInTheDocument()
    expect(screen.getByText('総客数:')).toBeInTheDocument()
    expect(screen.getByText('総取引:')).toBeInTheDocument()
    expect(screen.getByText('期間:')).toBeInTheDocument()
  })
})

describe('KPICards Component', () => {
  it('renders KPI cards with sales data', () => {
    render(<KPICards salesData={mockSalesData} />)
    
    expect(screen.getByText('売上（税抜）')).toBeInTheDocument()
    expect(screen.getByText('客数')).toBeInTheDocument()
    expect(screen.getByText('取引数')).toBeInTheDocument()
    expect(screen.getByText('客単価')).toBeInTheDocument()
    expect(screen.getByText('転換率')).toBeInTheDocument()
  })

  it('shows loading state for all cards', () => {
    render(<KPICards salesData={[]} loading={true} />)
    
    // Should show loading skeletons
    const loadingElements = screen.getAllByRole('status', { hidden: true })
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('calculates KPIs correctly', () => {
    render(<KPICards salesData={mockSalesData} />)
    
    // Total revenue should be 150000 + 200000 = 350000
    expect(screen.getByText('¥350,000')).toBeInTheDocument()
    
    // Total footfall should be 250 + 180 = 430
    expect(screen.getByText('430')).toBeInTheDocument()
    
    // Total transactions should be 180 + 120 = 300
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('shows trend indicators', () => {
    render(<KPICards salesData={mockSalesData} />)
    
    // Should show percentage changes vs previous period
    expect(screen.getByText(/vs 前期/)).toBeInTheDocument()
  })
})

describe('ExternalIndicators Component', () => {
  it('renders market indicators', () => {
    render(
      <ExternalIndicators
        marketData={mockMarketData}
        weatherData={mockWeatherData}
        events={mockEvents}
      />
    )
    
    expect(screen.getByText('外部指標')).toBeInTheDocument()
    expect(screen.getByText('📈 市場指標')).toBeInTheDocument()
    expect(screen.getByText('TOPIX')).toBeInTheDocument()
    expect(screen.getByText('日経225')).toBeInTheDocument()
  })

  it('renders weather information', () => {
    render(
      <ExternalIndicators
        marketData={mockMarketData}
        weatherData={mockWeatherData}
        events={mockEvents}
      />
    )
    
    expect(screen.getByText('天候情報')).toBeInTheDocument()
    expect(screen.getByText('東京')).toBeInTheDocument()
    expect(screen.getByText('32°/26°C')).toBeInTheDocument()
  })

  it('renders upcoming events', () => {
    render(
      <ExternalIndicators
        marketData={mockMarketData}
        weatherData={mockWeatherData}
        events={mockEvents}
      />
    )
    
    expect(screen.getByText('近隣イベント')).toBeInTheDocument()
    expect(screen.getByText('夏祭り')).toBeInTheDocument()
    expect(screen.getByText('渋谷区')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(
      <ExternalIndicators
        marketData={[]}
        weatherData={[]}
        events={[]}
        loading={true}
      />
    )
    
    const loadingElements = screen.getAllByRole('status', { hidden: true })
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('handles empty data gracefully', () => {
    render(
      <ExternalIndicators
        marketData={[]}
        weatherData={[]}
        events={[]}
      />
    )
    
    expect(screen.getByText('市場データなし')).toBeInTheDocument()
    expect(screen.getByText('天候データなし')).toBeInTheDocument()
    expect(screen.getByText('予定イベントなし')).toBeInTheDocument()
  })
})

describe('DashboardFilters Component', () => {
  const mockOnFiltersChange = jest.fn()

  beforeEach(() => {
    mockOnFiltersChange.mockClear()
  })

  it('renders filter options', () => {
    render(
      <DashboardFilters
        filters={mockFilters}
        stores={mockStores}
        onFiltersChange={mockOnFiltersChange}
      />
    )
    
    expect(screen.getByText('ダッシュボードフィルタ')).toBeInTheDocument()
    expect(screen.getByText('期間')).toBeInTheDocument()
    expect(screen.getByText('店舗')).toBeInTheDocument()
    expect(screen.getByText('部門')).toBeInTheDocument()
  })

  it('handles period preset changes', async () => {
    render(
      <DashboardFilters
        filters={mockFilters}
        stores={mockStores}
        onFiltersChange={mockOnFiltersChange}
      />
    )
    
    const periodSelect = screen.getByRole('combobox')
    fireEvent.change(periodSelect, { target: { value: 'last-month' } })
    
    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalled()
    })
  })

  it('shows current filters summary', () => {
    render(
      <DashboardFilters
        filters={mockFilters}
        stores={mockStores}
        onFiltersChange={mockOnFiltersChange}
      />
    )
    
    expect(screen.getByText('現在のフィルタ:')).toBeInTheDocument()
    expect(screen.getByText('📅 2025/08/01 - 2025/08/31')).toBeInTheDocument()
    expect(screen.getByText('全データ表示中')).toBeInTheDocument()
  })

  it('handles filter reset', async () => {
    render(
      <DashboardFilters
        filters={mockFilters}
        stores={mockStores}
        onFiltersChange={mockOnFiltersChange}
      />
    )
    
    const resetButton = screen.getByText('フィルタをリセット（当月・全店舗・全部門）')
    fireEvent.click(resetButton)
    
    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          storeIds: undefined,
          departments: undefined,
          productCategories: undefined
        })
      )
    })
  })

  it('shows disabled state', () => {
    render(
      <DashboardFilters
        filters={mockFilters}
        stores={mockStores}
        onFiltersChange={mockOnFiltersChange}
        disabled={true}
      />
    )
    
    expect(screen.getByText('データ読み込み中のため、フィルタ変更は無効です...')).toBeInTheDocument()
    
    const selects = screen.getAllByRole('combobox')
    selects.forEach(select => {
      expect(select).toBeDisabled()
    })
  })
})

// Integration test for component interaction
describe('Dashboard Components Integration', () => {
  it('components work together with shared data', () => {
    const { rerender } = render(
      <div>
        <KPICards salesData={mockSalesData} />
        <SalesChart salesData={mockSalesData} />
        <ExternalIndicators
          marketData={mockMarketData}
          weatherData={mockWeatherData}
          events={mockEvents}
        />
      </div>
    )
    
    // All components should render without errors
    expect(screen.getByText('売上（税抜）')).toBeInTheDocument()
    expect(screen.getByText('売上推移')).toBeInTheDocument()
    expect(screen.getByText('外部指標')).toBeInTheDocument()
    
    // Test with empty data
    rerender(
      <div>
        <KPICards salesData={[]} />
        <SalesChart salesData={[]} />
        <ExternalIndicators
          marketData={[]}
          weatherData={[]}
          events={[]}
        />
      </div>
    )
    
    // Should handle empty data gracefully
    expect(screen.getByText('表示するデータがありません')).toBeInTheDocument()
    expect(screen.getByText('市場データなし')).toBeInTheDocument()
  })
})
