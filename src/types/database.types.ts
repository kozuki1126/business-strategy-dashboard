// Enhanced Database Types for Business Strategy Dashboard
// Task #004: データベーススキーマ作成 - TypeScript型定義更新
// Generated: 2025-08-19
// Updated: 2025-08-22 - TypeScript型定義エラー修正

export interface Database {
  public: {
    Tables: {
      // ========================================
      // DIMENSION TABLES
      // ========================================
      dim_store: {
        Row: {
          id: string
          name: string
          address: string | null
          lat: number | null
          lng: number | null
          area: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          area?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          area?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      dim_department: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      
      // ========================================
      // SALES FACT TABLE
      // ========================================
      sales: {
        Row: {
          id: string
          date: string
          store_id: string
          department: string | null
          product_category: string | null
          revenue_ex_tax: number
          footfall: number | null
          transactions: number | null
          discounts: number | null
          tax: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          store_id: string
          department?: string | null
          product_category?: string | null
          revenue_ex_tax: number
          footfall?: number | null
          transactions?: number | null
          discounts?: number | null
          tax?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          store_id?: string
          department?: string | null
          product_category?: string | null
          revenue_ex_tax?: number
          footfall?: number | null
          transactions?: number | null
          discounts?: number | null
          tax?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // ========================================
      // EXTERNAL DATA TABLES
      // ========================================
      ext_market_index: {
        Row: {
          id: string
          date: string
          symbol: string
          value: number
          change_percent: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          symbol: string
          value: number
          change_percent?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          symbol?: string
          value?: number
          change_percent?: number | null
          updated_at?: string
        }
      }
      ext_fx_rate: {
        Row: {
          id: string
          date: string
          pair: string
          rate: number
          change_percent: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          pair: string
          rate: number
          change_percent?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          pair?: string
          rate?: number
          change_percent?: number | null
          updated_at?: string
        }
      }
      ext_weather_daily: {
        Row: {
          id: string
          date: string
          location: string
          temperature_max: number | null
          temperature_min: number | null
          precipitation_mm: number | null
          humidity_percent: number | null
          weather_condition: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          location: string
          temperature_max?: number | null
          temperature_min?: number | null
          precipitation_mm?: number | null
          humidity_percent?: number | null
          weather_condition?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          location?: string
          temperature_max?: number | null
          temperature_min?: number | null
          precipitation_mm?: number | null
          humidity_percent?: number | null
          weather_condition?: string | null
          updated_at?: string
        }
      }
      ext_events: {
        Row: {
          id: string
          date: string
          title: string
          location: string | null
          lat: number | null
          lng: number | null
          event_type: string | null
          expected_attendance: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          title: string
          location?: string | null
          lat?: number | null
          lng?: number | null
          event_type?: string | null
          expected_attendance?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          title?: string
          location?: string | null
          lat?: number | null
          lng?: number | null
          event_type?: string | null
          expected_attendance?: number | null
          notes?: string | null
          updated_at?: string
        }
      }
      ext_inbound: {
        Row: {
          id: string
          year_month: string
          country: string
          visitors: number
          change_percent: number | null
          prefecture: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          year_month: string
          country: string
          visitors: number
          change_percent?: number | null
          prefecture?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          year_month?: string
          country?: string
          visitors?: number
          change_percent?: number | null
          prefecture?: string | null
          updated_at?: string
        }
      }
      ext_stem_news: {
        Row: {
          id: string
          published_date: string
          title: string
          source: string
          category: string
          url: string | null
          summary: string | null
          sentiment_score: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          published_date: string
          title: string
          source: string
          category: string
          url?: string | null
          summary?: string | null
          sentiment_score?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          published_date?: string
          title?: string
          source?: string
          category?: string
          url?: string | null
          summary?: string | null
          sentiment_score?: number | null
          updated_at?: string
        }
      }
      
      // ========================================
      // AUDIT TABLE
      // ========================================
      audit_log: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          target: string | null
          at: string
          ip: string | null
          ua: string | null
          meta: Record<string, any> | null
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          target?: string | null
          at?: string
          ip?: string | null
          ua?: string | null
          meta?: Record<string, any> | null
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          target?: string | null
          at?: string
          ip?: string | null
          ua?: string | null
          meta?: Record<string, any> | null
        }
      }
      
      // ========================================
      // MONITORING VIEWS
      // ========================================
      v_table_stats: {
        Row: {
          schemaname: string | null
          tablename: string | null
          attname: string | null
          n_distinct: number | null
          correlation: number | null
          most_common_vals: string[] | null
          most_common_freqs: number[] | null
        }
      }
      v_slow_queries: {
        Row: {
          query: string | null
          calls: number | null
          total_time: number | null
          mean_time: number | null
          rows: number | null
          hit_percent: number | null
        }
      }
    }
    Views: {
      v_table_stats: Database['public']['Tables']['v_table_stats']['Row']
      v_slow_queries: Database['public']['Tables']['v_slow_queries']['Row']
    }
    Functions: {
      calculate_distance: {
        Args: {
          lat1: number
          lng1: number
          lat2: number
          lng2: number
        }
        Returns: number | null
      }
      get_nearby_events: {
        Args: {
          store_lat: number
          store_lng: number
          event_date: string
          radius_km?: number
        }
        Returns: {
          event_id: string
          title: string
          event_type: string | null
          distance_km: number | null
        }[]
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}

// ========================================
// ENHANCED APPLICATION TYPES
// ========================================

// Sales data with calculated fields
// TypeScript型定義エラー修正: interfaceからtype aliasへ変更
export type SalesWithCalculated = Database['public']['Tables']['sales']['Row'] & {
  total_revenue?: number // revenue_ex_tax + tax
  average_transaction_value?: number // revenue_ex_tax / transactions
  conversion_rate?: number // transactions / footfall
  store_name?: string
  area?: string
}

// Weather condition types
export type WeatherCondition = 
  | 'sunny' 
  | 'cloudy' 
  | 'partly_cloudy' 
  | 'light_rain' 
  | 'heavy_rain' 
  | 'snow'
  | 'fog'
  | 'windy'

// Event types
export type EventType = 
  | 'festival'
  | 'concert' 
  | 'sports'
  | 'exhibition'
  | 'conference'
  | 'food'
  | 'cultural'
  | 'fireworks'

// STEM news categories
export type STEMCategory = 
  | 'AI'
  | 'semiconductor'
  | 'robotics'
  | 'biotech'
  | 'quantum'
  | 'clean_energy'
  | 'space'

// Market symbols commonly tracked
export type MarketSymbol = 
  | 'TOPIX'
  | 'NIKKEI225'
  | '7203' // Toyota
  | '6758' // Sony
  | '9984' // SoftBank
  | '4755' // Rakuten
  | '6861' // Keyence

// Currency pairs
export type CurrencyPair = 
  | 'USD/JPY'
  | 'EUR/JPY'
  | 'CNY/JPY'
  | 'GBP/JPY'
  | 'AUD/JPY'

// Dashboard query parameters
export interface DashboardFilters {
  dateRange: {
    start: string
    end: string
  }
  storeIds?: string[]
  departments?: string[]
  productCategories?: string[]
}

// Analytics data structure
export interface AnalyticsData {
  sales: SalesWithCalculated[]
  marketData: Database['public']['Tables']['ext_market_index']['Row'][]
  weatherData: Database['public']['Tables']['ext_weather_daily']['Row'][]
  events: Database['public']['Tables']['ext_events']['Row'][]
  correlations?: {
    weather_sales: number
    events_sales: number
    market_sales: number
  }
}

// Export format options
export type ExportFormat = 'csv' | 'excel' | 'pdf'

export interface ExportRequest {
  format: ExportFormat
  filters: DashboardFilters
  tables: ('sales' | 'market' | 'weather' | 'events')[]
  includeCharts?: boolean
}

// Audit action types
export type AuditAction = 
  | 'login'
  | 'logout'
  | 'view_dashboard'
  | 'export_csv'
  | 'export_excel'
  | 'input_sales'
  | 'edit_sales'
  | 'delete_sales'
  | 'system_init'
  | 'migration_applied'
  | 'seed_data'

// User roles for future RBAC
export type UserRole = 
  | 'dashboard_admin'
  | 'store_manager'
  | 'viewer'
  | 'analyst'

// Store areas for filtering
export type StoreArea = 
  | '東京'
  | '関西'
  | '関東'
  | '中部'
  | '九州'
  | '北海道'
  | '東北'
  | '中国'

// API response types
export interface APIResponse<T> {
  data: T
  success: boolean
  message?: string
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}

// Sales input form data
export interface SalesInputForm {
  date: string
  store_id: string
  department: string
  product_category: string
  revenue_ex_tax: number
  footfall?: number
  transactions?: number
  discounts?: number
  notes?: string
}

// Validation errors
export interface ValidationError {
  field: string
  message: string
  code: string
}

// Performance metrics
export interface PerformanceMetrics {
  response_time_ms: number
  cache_hit_ratio: number
  query_count: number
  memory_usage_mb: number
}

// Dashboard configuration
export interface DashboardConfig {
  refresh_interval_ms: number
  max_data_points: number
  default_date_range_days: number
  chart_colors: string[]
  timezone: string
}
