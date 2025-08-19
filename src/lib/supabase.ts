import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'business-strategy-dashboard@0.1.0',
    },
  },
})

// Export types for convenience
export type { Database } from '@/types/database.types'
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Common table types
export type Store = Tables<'dim_store'>
export type Department = Tables<'dim_department'>
export type ProductCategory = Tables<'dim_product_category'>
export type Sales = Tables<'sales'>
export type MarketIndex = Tables<'ext_market_index'>
export type FxRate = Tables<'ext_fx_rate'>
export type WeatherDaily = Tables<'ext_weather_daily'>
export type StemNews = Tables<'ext_stem_news'>
export type AuditLog = Tables<'audit_log'>
