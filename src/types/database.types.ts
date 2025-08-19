export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      dim_department: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dim_product_category: {
        Row: {
          code: string
          created_at: string | null
          department_id: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dim_product_category_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dim_department"
            referencedColumns: ["id"]
          },
        ]
      }
      dim_store: {
        Row: {
          address: string | null
          area: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          manager_name: string | null
          name: string
          opening_date: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          name: string
          opening_date?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          name?: string
          opening_date?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ext_events: {
        Row: {
          attendance_estimate: number | null
          category: string | null
          created_at: string | null
          date: string
          description: string | null
          end_date: string | null
          id: string
          is_major_event: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          title: string
        }
        Insert: {
          attendance_estimate?: number | null
          category?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_major_event?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          title: string
        }
        Update: {
          attendance_estimate?: number | null
          category?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_major_event?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          title?: string
        }
        Relationships: []
      }
      ext_fx_rate: {
        Row: {
          base_currency: string
          created_at: string | null
          date: string
          id: string
          rate: number
          target_currency: string
        }
        Insert: {
          base_currency: string
          created_at?: string | null
          date: string
          id?: string
          rate: number
          target_currency: string
        }
        Update: {
          base_currency?: string
          created_at?: string | null
          date?: string
          id?: string
          rate?: number
          target_currency?: string
        }
        Relationships: []
      }
      ext_inbound: {
        Row: {
          avg_stay_days: number | null
          country: string | null
          created_at: string | null
          id: string
          region: string
          spending_amount: number | null
          visitors: number | null
          year_month: string
        }
        Insert: {
          avg_stay_days?: number | null
          country?: string | null
          created_at?: string | null
          id?: string
          region: string
          spending_amount?: number | null
          visitors?: number | null
          year_month: string
        }
        Update: {
          avg_stay_days?: number | null
          country?: string | null
          created_at?: string | null
          id?: string
          region?: string
          spending_amount?: number | null
          visitors?: number | null
          year_month?: string
        }
        Relationships: []
      }
      ext_market_index: {
        Row: {
          change_percent: number | null
          change_value: number | null
          created_at: string | null
          date: string
          id: string
          index_code: string
          index_name: string | null
          value: number | null
        }
        Insert: {
          change_percent?: number | null
          change_value?: number | null
          created_at?: string | null
          date: string
          id?: string
          index_code: string
          index_name?: string | null
          value?: number | null
        }
        Update: {
          change_percent?: number | null
          change_value?: number | null
          created_at?: string | null
          date?: string
          id?: string
          index_code?: string
          index_name?: string | null
          value?: number | null
        }
        Relationships: []
      }
      ext_stem_news: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          keywords: string[] | null
          published_date: string
          sentiment: string | null
          source: string | null
          summary: string | null
          title: string
          url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          published_date: string
          sentiment?: string | null
          source?: string | null
          summary?: string | null
          title: string
          url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          keywords?: string[] | null
          published_date?: string
          sentiment?: string | null
          source?: string | null
          summary?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      ext_stock_price: {
        Row: {
          close_price: number | null
          company_name: string | null
          created_at: string | null
          date: string
          high_price: number | null
          id: string
          low_price: number | null
          open_price: number | null
          symbol: string
          volume: number | null
        }
        Insert: {
          close_price?: number | null
          company_name?: string | null
          created_at?: string | null
          date: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          open_price?: number | null
          symbol: string
          volume?: number | null
        }
        Update: {
          close_price?: number | null
          company_name?: string | null
          created_at?: string | null
          date?: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          open_price?: number | null
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      ext_weather_daily: {
        Row: {
          created_at: string | null
          date: string
          humidity_avg: number | null
          id: string
          location: string
          precipitation: number | null
          temperature_avg: number | null
          temperature_max: number | null
          temperature_min: number | null
          weather_code: string | null
          weather_condition: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          humidity_avg?: number | null
          id?: string
          location: string
          precipitation?: number | null
          temperature_avg?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          weather_code?: string | null
          weather_condition?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          humidity_avg?: number | null
          id?: string
          location?: string
          precipitation?: number | null
          temperature_avg?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          weather_code?: string | null
          weather_condition?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          department_id: string | null
          discounts: number | null
          footfall: number | null
          id: string
          notes: string | null
          product_category_id: string | null
          revenue_ex_tax: number
          store_id: string
          tax_amount: number
          transactions: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          department_id?: string | null
          discounts?: number | null
          footfall?: number | null
          id?: string
          notes?: string | null
          product_category_id?: string | null
          revenue_ex_tax?: number
          store_id: string
          tax_amount?: number
          transactions?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          department_id?: string | null
          discounts?: number | null
          footfall?: number | null
          id?: string
          notes?: string | null
          product_category_id?: string | null
          revenue_ex_tax?: number
          store_id?: string
          tax_amount?: number
          transactions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "dim_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "dim_product_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "dim_store"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
