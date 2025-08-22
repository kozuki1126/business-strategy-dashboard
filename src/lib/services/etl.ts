/**
 * ETL Service Class
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: 外部API取得・データ正規化・DB更新のメインロジック
 * Sources: 市場・為替・天候・イベント・STEMニュース・インバウンド統計
 * 
 * Features:
 * - 3回リトライロジック
 * - 10分以内更新完了
 * - 包括的エラーハンドリング
 * - データ正規化・バリデーション
 */

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'
import { DataSource } from './data-sources'
import { AuditService } from './audit'

type SupabaseClient = ReturnType<typeof createClient>

export interface ETLResult {
  source: string
  success: boolean
  recordsProcessed: number
  duration: number
  error?: string
}

export interface ETLResults {
  totalDuration: number
  successCount: number
  failureCount: number
  results: ETLResult[]
}

export class ETLService {
  private supabase: SupabaseClient
  private dataSource: DataSource

  constructor() {
    this.supabase = createClient()
    this.dataSource = new DataSource()
  }

  /**
   * Execute full ETL pipeline for all external data sources
   */
  async runFullETL(): Promise<ETLResults> {
    const startTime = Date.now()
    const results: ETLResult[] = []

    if (process.env.NODE_ENV === 'development') {
      console.warn('[ETL] Starting full ETL pipeline...')
    }

    // Define data sources to process
    const dataSources = [
      { name: 'market_index', handler: this.processMarketData.bind(this) },
      { name: 'fx_rates', handler: this.processFXData.bind(this) },
      { name: 'weather', handler: this.processWeatherData.bind(this) },
      { name: 'events', handler: this.processEventsData.bind(this) },
      { name: 'stem_news', handler: this.processSTEMNews.bind(this) },
      { name: 'inbound', handler: this.processInboundData.bind(this) }
    ]

    // Process each data source
    for (const source of dataSources) {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[ETL] Processing ${source.name}...`)
        }
        const result = await this.executeWithRetry(source.handler, source.name)
        results.push(result)
      } catch (error) {
        console.error(`[ETL] Failed to process ${source.name}:`, error)
        results.push({
          source: source.name,
          success: false,
          recordsProcessed: 0,
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const totalDuration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[ETL] Pipeline completed: ${successCount}/${results.length} sources successful`)
    }

    return {
      totalDuration,
      successCount,
      failureCount,
      results
    }
  }

  /**
   * Execute ETL operation with 3-retry logic
   */
  private async executeWithRetry(
    handler: () => Promise<ETLResult>,
    sourceName: string,
    maxRetries: number = 3
  ): Promise<ETLResult> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[ETL] ${sourceName} - Attempt ${attempt}/${maxRetries}`)
        }
        return await handler()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.warn(`[ETL] ${sourceName} - Attempt ${attempt} failed:`, lastError.message)
        
        if (attempt < maxRetries) {
          // Exponential backoff: 2s, 4s, 8s
          const delay = Math.pow(2, attempt) * 1000
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[ETL] ${sourceName} - Retrying in ${delay}ms...`)
          }
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error(`Failed after ${maxRetries} attempts`)
  }

  /**
   * Process market index data (TOPIX, NIKKEI225, individual stocks)
   */
  private async processMarketData(): Promise<ETLResult> {
    const startTime = Date.now()
    let recordsProcessed = 0

    try {
      const marketData = await this.dataSource.fetchMarketData()
      
      for (const data of marketData) {
        await this.supabase
          .from('ext_market_index')
          .upsert({
            date: data.date,
            symbol: data.symbol,
            value: data.value,
            change_percent: data.change_percent,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'date,symbol'
          })
        
        recordsProcessed++
      }

      return {
        source: 'market_index',
        success: true,
        recordsProcessed,
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`Market data ETL failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process FX rate data (USD/JPY, EUR/JPY, CNY/JPY)
   */
  private async processFXData(): Promise<ETLResult> {
    const startTime = Date.now()
    let recordsProcessed = 0

    try {
      const fxData = await this.dataSource.fetchFXRates()
      
      for (const data of fxData) {
        await this.supabase
          .from('ext_fx_rate')
          .upsert({
            date: data.date,
            pair: data.pair,
            rate: data.rate,
            change_percent: data.change_percent,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'date,pair'
          })
        
        recordsProcessed++
      }

      return {
        source: 'fx_rates',
        success: true,
        recordsProcessed,
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`FX data ETL failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process weather data
   */
  private async processWeatherData(): Promise<ETLResult> {
    const startTime = Date.now()
    let recordsProcessed = 0

    try {
      const weatherData = await this.dataSource.fetchWeatherData()
      
      for (const data of weatherData) {
        await this.supabase
          .from('ext_weather_daily')
          .upsert({
            date: data.date,
            location: data.location,
            temperature_max: data.temperature_max,
            temperature_min: data.temperature_min,
            precipitation_mm: data.precipitation_mm,
            humidity_percent: data.humidity_percent,
            weather_condition: data.weather_condition,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'date,location'
          })
        
        recordsProcessed++
      }

      return {
        source: 'weather',
        success: true,
        recordsProcessed,
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`Weather data ETL failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process local events data (5km radius around stores)
   */
  private async processEventsData(): Promise<ETLResult> {
    const startTime = Date.now()
    let recordsProcessed = 0

    try {
      const eventsData = await this.dataSource.fetchEventsData()
      
      for (const data of eventsData) {
        await this.supabase
          .from('ext_events')
          .upsert({
            date: data.date,
            title: data.title,
            location: data.location,
            lat: data.lat,
            lng: data.lng,
            event_type: data.event_type,
            expected_attendance: data.expected_attendance,
            notes: data.notes,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'date,title,location'
          })
        
        recordsProcessed++
      }

      return {
        source: 'events',
        success: true,
        recordsProcessed,
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`Events data ETL failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process STEM news data (AI, semiconductor, robotics, biotech)
   */
  private async processSTEMNews(): Promise<ETLResult> {
    const startTime = Date.now()
    let recordsProcessed = 0

    try {
      const stemNews = await this.dataSource.fetchSTEMNews()
      
      for (const news of stemNews) {
        await this.supabase
          .from('ext_stem_news')
          .upsert({
            published_date: news.published_date,
            title: news.title,
            source: news.source,
            category: news.category,
            url: news.url,
            summary: news.summary,
            sentiment_score: news.sentiment_score,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'published_date,title,source'
          })
        
        recordsProcessed++
      }

      return {
        source: 'stem_news',
        success: true,
        recordsProcessed,
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`STEM news ETL failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process inbound tourism statistics
   */
  private async processInboundData(): Promise<ETLResult> {
    const startTime = Date.now()
    let recordsProcessed = 0

    try {
      const inboundData = await this.dataSource.fetchInboundData()
      
      for (const data of inboundData) {
        await this.supabase
          .from('ext_inbound')
          .upsert({
            year_month: data.year_month,
            country: data.country,
            visitors: data.visitors,
            change_percent: data.change_percent,
            prefecture: data.prefecture,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'year_month,country,prefecture'
          })
        
        recordsProcessed++
      }

      return {
        source: 'inbound',
        success: true,
        recordsProcessed,
        duration: Date.now() - startTime
      }
    } catch (error) {
      throw new Error(`Inbound data ETL failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
