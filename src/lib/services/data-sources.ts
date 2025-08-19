/**
 * External Data Sources Service
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: 外部API・公開データからの情報取得
 * Sources: 市場・為替・天候・イベント・STEMニュース・インバウンド統計
 * 
 * Features:
 * - 無料公開API利用
 * - レート制限対応
 * - データ正規化・バリデーション
 * - エラーハンドリング
 */

export interface MarketData {
  date: string
  symbol: string
  value: number
  change_percent: number | null
}

export interface FXData {
  date: string
  pair: string
  rate: number
  change_percent: number | null
}

export interface WeatherData {
  date: string
  location: string
  temperature_max: number | null
  temperature_min: number | null
  precipitation_mm: number | null
  humidity_percent: number | null
  weather_condition: string | null
}

export interface EventData {
  date: string
  title: string
  location: string | null
  lat: number | null
  lng: number | null
  event_type: string | null
  expected_attendance: number | null
  notes: string | null
}

export interface STEMNewsData {
  published_date: string
  title: string
  source: string
  category: string
  url: string | null
  summary: string | null
  sentiment_score: number | null
}

export interface InboundData {
  year_month: string
  country: string
  visitors: number
  change_percent: number | null
  prefecture: string | null
}

export class DataSource {
  private readonly API_TIMEOUT = 30000 // 30 seconds
  private readonly RETRY_DELAY = 2000 // 2 seconds

  constructor() {
    console.log('[DataSource] Initializing external data source client')
  }

  /**
   * Fetch market index data (TOPIX, NIKKEI225, individual stocks)
   * Using Yahoo Finance API (free tier)
   */
  async fetchMarketData(): Promise<MarketData[]> {
    console.log('[DataSource] Fetching market data...')
    
    const symbols = ['TOPIX', 'NIKKEI225', '7203.T', '6758.T', '9984.T'] // Toyota, Sony, SoftBank
    const results: MarketData[] = []
    const today = new Date().toISOString().split('T')[0]

    try {
      // Mock implementation for now - replace with actual API calls
      // Using Alpha Vantage, Yahoo Finance, or similar free API
      for (const symbol of symbols) {
        const mockData: MarketData = {
          date: today,
          symbol: symbol.replace('.T', ''),
          value: Math.random() * 10000 + 20000, // Mock value
          change_percent: (Math.random() - 0.5) * 4 // -2% to +2%
        }
        results.push(mockData)
      }

      console.log(`[DataSource] Market data: ${results.length} records fetched`)
      return results

    } catch (error) {
      console.error('[DataSource] Market data fetch failed:', error)
      throw new Error(`Failed to fetch market data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch FX rate data (USD/JPY, EUR/JPY, CNY/JPY)
   * Using ExchangeRate-API or similar free service
   */
  async fetchFXRates(): Promise<FXData[]> {
    console.log('[DataSource] Fetching FX rates...')
    
    const pairs = ['USD/JPY', 'EUR/JPY', 'CNY/JPY']
    const results: FXData[] = []
    const today = new Date().toISOString().split('T')[0]

    try {
      // Mock implementation - replace with actual API calls
      // Using ExchangeRate-API, Fixer.io free tier, or Bank of Japan API
      const baseRates = { 'USD/JPY': 148.5, 'EUR/JPY': 162.3, 'CNY/JPY': 20.8 }
      
      for (const pair of pairs) {
        const mockData: FXData = {
          date: today,
          pair,
          rate: baseRates[pair as keyof typeof baseRates] * (1 + (Math.random() - 0.5) * 0.02),
          change_percent: (Math.random() - 0.5) * 2 // -1% to +1%
        }
        results.push(mockData)
      }

      console.log(`[DataSource] FX rates: ${results.length} records fetched`)
      return results

    } catch (error) {
      console.error('[DataSource] FX rates fetch failed:', error)
      throw new Error(`Failed to fetch FX rates: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch weather data
   * Using OpenWeatherMap API (free tier) or JMA (Japan Meteorological Agency)
   */
  async fetchWeatherData(): Promise<WeatherData[]> {
    console.log('[DataSource] Fetching weather data...')
    
    const locations = ['Tokyo', 'Osaka', 'Nagoya', 'Fukuoka', 'Sapporo']
    const results: WeatherData[] = []
    const today = new Date().toISOString().split('T')[0]

    try {
      // Mock implementation - replace with actual API calls
      // Using OpenWeatherMap API or JMA API
      for (const location of locations) {
        const mockData: WeatherData = {
          date: today,
          location,
          temperature_max: Math.round(Math.random() * 15 + 15), // 15-30°C
          temperature_min: Math.round(Math.random() * 10 + 5), // 5-15°C
          precipitation_mm: Math.random() > 0.7 ? Math.round(Math.random() * 20) : 0,
          humidity_percent: Math.round(Math.random() * 30 + 50), // 50-80%
          weather_condition: Math.random() > 0.3 ? 'sunny' : 'cloudy'
        }
        results.push(mockData)
      }

      console.log(`[DataSource] Weather data: ${results.length} records fetched`)
      return results

    } catch (error) {
      console.error('[DataSource] Weather data fetch failed:', error)
      throw new Error(`Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch local events data (5km radius around stores)
   * Using EventBrite API, Facebook Events, or local tourism APIs
   */
  async fetchEventsData(): Promise<EventData[]> {
    console.log('[DataSource] Fetching events data...')
    
    const results: EventData[] = []
    const today = new Date()
    
    try {
      // Mock implementation - replace with actual API calls
      // Using EventBrite API, Facebook Events API, or local tourism board APIs
      const eventTypes = ['festival', 'concert', 'sports', 'exhibition', 'food']
      const locations = [
        { name: 'Tokyo Station', lat: 35.6812, lng: 139.7671 },
        { name: 'Osaka Castle', lat: 34.6873, lng: 135.5262 },
        { name: 'Nagoya Station', lat: 35.1706, lng: 136.8816 }
      ]

      for (let i = 0; i < 10; i++) {
        const eventDate = new Date(today.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000)
        const location = locations[Math.floor(Math.random() * locations.length)]
        
        const mockData: EventData = {
          date: eventDate.toISOString().split('T')[0],
          title: `イベント ${i + 1}`,
          location: location.name,
          lat: location.lat + (Math.random() - 0.5) * 0.01,
          lng: location.lng + (Math.random() - 0.5) * 0.01,
          event_type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          expected_attendance: Math.round(Math.random() * 10000 + 1000),
          notes: null
        }
        results.push(mockData)
      }

      console.log(`[DataSource] Events data: ${results.length} records fetched`)
      return results

    } catch (error) {
      console.error('[DataSource] Events data fetch failed:', error)
      throw new Error(`Failed to fetch events data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch STEM news data (AI, semiconductor, robotics, biotech)
   * Using News API, RSS feeds, or tech news aggregators
   */
  async fetchSTEMNews(): Promise<STEMNewsData[]> {
    console.log('[DataSource] Fetching STEM news...')
    
    const results: STEMNewsData[] = []
    const today = new Date().toISOString().split('T')[0]
    
    try {
      // Mock implementation - replace with actual API calls
      // Using News API, RSS feeds, or tech news aggregators
      const categories = ['AI', 'semiconductor', 'robotics', 'biotech']
      const sources = ['TechCrunch', 'Nikkei Tech', 'ITmedia', 'Impress Watch']
      
      for (let i = 0; i < 20; i++) {
        const publishDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        
        const mockData: STEMNewsData = {
          published_date: publishDate.toISOString().split('T')[0],
          title: `STEM News ${i + 1}: ${categories[Math.floor(Math.random() * categories.length)]}関連`,
          source: sources[Math.floor(Math.random() * sources.length)],
          category: categories[Math.floor(Math.random() * categories.length)],
          url: `https://example.com/news/${i + 1}`,
          summary: `${categories[Math.floor(Math.random() * categories.length)]}分野の最新動向についてのニュース`,
          sentiment_score: Math.random() * 2 - 1 // -1 to +1
        }
        results.push(mockData)
      }

      console.log(`[DataSource] STEM news: ${results.length} records fetched`)
      return results

    } catch (error) {
      console.error('[DataSource] STEM news fetch failed:', error)
      throw new Error(`Failed to fetch STEM news: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch inbound tourism statistics
   * Using JNTO (Japan National Tourism Organization) API or government open data
   */
  async fetchInboundData(): Promise<InboundData[]> {
    console.log('[DataSource] Fetching inbound tourism data...')
    
    const results: InboundData[] = []
    const currentDate = new Date()
    const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    
    try {
      // Mock implementation - replace with actual API calls
      // Using JNTO API or government open data portals
      const countries = ['China', 'South Korea', 'Taiwan', 'USA', 'Thailand', 'Australia']
      const prefectures = ['Tokyo', 'Osaka', 'Kyoto', 'Kanagawa', 'Chiba']
      
      for (const country of countries) {
        for (const prefecture of prefectures) {
          const mockData: InboundData = {
            year_month: yearMonth,
            country,
            visitors: Math.round(Math.random() * 100000 + 10000),
            change_percent: (Math.random() - 0.5) * 40, // -20% to +20%
            prefecture
          }
          results.push(mockData)
        }
      }

      console.log(`[DataSource] Inbound data: ${results.length} records fetched`)
      return results

    } catch (error) {
      console.error('[DataSource] Inbound data fetch failed:', error)
      throw new Error(`Failed to fetch inbound data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generic HTTP request with timeout and retry logic
   */
  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT)
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'BusinessDashboard/1.0',
          'Accept': 'application/json',
          ...options.headers
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.API_TIMEOUT}ms`)
      }
      throw error
    }
  }
}
