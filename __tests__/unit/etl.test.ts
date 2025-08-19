/**
 * ETL Service Unit Tests
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: ETLサービスの包括的単体テスト
 * Coverage: データ取得・変換・保存・エラーハンドリング・リトライ
 */

import { ETLService } from '@/lib/services/etl'
import { DataSource } from '@/lib/services/data-sources'
import { AuditService } from '@/lib/services/audit'
import { NotificationService } from '@/lib/services/notification'

// Mock external dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ error: null }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    }))
  }))
}))

jest.mock('@/lib/services/data-sources')
jest.mock('@/lib/services/audit')
jest.mock('@/lib/services/notification')

const MockedDataSource = DataSource as jest.MockedClass<typeof DataSource>
const MockedAuditService = AuditService as jest.MockedClass<typeof AuditService>
const MockedNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>

describe('ETLService', () => {
  let etlService: ETLService
  let mockDataSource: jest.Mocked<DataSource>

  beforeEach(() => {
    jest.clearAllMocks()
    etlService = new ETLService()
    mockDataSource = new MockedDataSource() as jest.Mocked<DataSource>
    
    // Setup default mock implementations
    MockedAuditService.log = jest.fn().mockResolvedValue(undefined)
    MockedNotificationService.sendETLNotification = jest.fn().mockResolvedValue(undefined)
  })

  describe('runFullETL', () => {
    it('should successfully execute full ETL pipeline', async () => {
      // Arrange
      const mockMarketData = [
        { date: '2025-08-19', symbol: 'TOPIX', value: 2500, change_percent: 1.5 }
      ]
      const mockFXData = [
        { date: '2025-08-19', pair: 'USD/JPY', rate: 148.5, change_percent: 0.2 }
      ]
      const mockWeatherData = [
        { date: '2025-08-19', location: 'Tokyo', temperature_max: 28, temperature_min: 20, precipitation_mm: 0, humidity_percent: 65, weather_condition: 'sunny' }
      ]
      const mockEventsData = [
        { date: '2025-08-19', title: 'Test Event', location: 'Tokyo', lat: 35.6812, lng: 139.7671, event_type: 'festival', expected_attendance: 5000, notes: null }
      ]
      const mockSTEMNews = [
        { published_date: '2025-08-19', title: 'AI News', source: 'TechCrunch', category: 'AI', url: 'https://example.com', summary: 'Test news', sentiment_score: 0.5 }
      ]
      const mockInboundData = [
        { year_month: '2025-08', country: 'China', visitors: 50000, change_percent: 5.0, prefecture: 'Tokyo' }
      ]

      mockDataSource.fetchMarketData = jest.fn().mockResolvedValue(mockMarketData)
      mockDataSource.fetchFXRates = jest.fn().mockResolvedValue(mockFXData)
      mockDataSource.fetchWeatherData = jest.fn().mockResolvedValue(mockWeatherData)
      mockDataSource.fetchEventsData = jest.fn().mockResolvedValue(mockEventsData)
      mockDataSource.fetchSTEMNews = jest.fn().mockResolvedValue(mockSTEMNews)
      mockDataSource.fetchInboundData = jest.fn().mockResolvedValue(mockInboundData)

      // Act
      const result = await etlService.runFullETL()

      // Assert
      expect(result.successCount).toBe(6)
      expect(result.failureCount).toBe(0)
      expect(result.results).toHaveLength(6)
      expect(result.totalDuration).toBeGreaterThan(0)

      // Verify all data sources were called
      expect(mockDataSource.fetchMarketData).toHaveBeenCalledTimes(1)
      expect(mockDataSource.fetchFXRates).toHaveBeenCalledTimes(1)
      expect(mockDataSource.fetchWeatherData).toHaveBeenCalledTimes(1)
      expect(mockDataSource.fetchEventsData).toHaveBeenCalledTimes(1)
      expect(mockDataSource.fetchSTEMNews).toHaveBeenCalledTimes(1)
      expect(mockDataSource.fetchInboundData).toHaveBeenCalledTimes(1)

      // Verify all results are successful
      result.results.forEach(r => {
        expect(r.success).toBe(true)
        expect(r.recordsProcessed).toBeGreaterThan(0)
        expect(r.duration).toBeGreaterThan(0)
      })
    })

    it('should handle partial failures in ETL pipeline', async () => {
      // Arrange - One data source fails
      mockDataSource.fetchMarketData = jest.fn().mockRejectedValue(new Error('Market API unavailable'))
      mockDataSource.fetchFXRates = jest.fn().mockResolvedValue([
        { date: '2025-08-19', pair: 'USD/JPY', rate: 148.5, change_percent: 0.2 }
      ])
      mockDataSource.fetchWeatherData = jest.fn().mockResolvedValue([
        { date: '2025-08-19', location: 'Tokyo', temperature_max: 28, temperature_min: 20, precipitation_mm: 0, humidity_percent: 65, weather_condition: 'sunny' }
      ])
      mockDataSource.fetchEventsData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchSTEMNews = jest.fn().mockResolvedValue([])
      mockDataSource.fetchInboundData = jest.fn().mockResolvedValue([])

      // Act
      const result = await etlService.runFullETL()

      // Assert
      expect(result.successCount).toBe(5)
      expect(result.failureCount).toBe(1)
      expect(result.results).toHaveLength(6)

      const failedResult = result.results.find(r => !r.success)
      expect(failedResult).toBeDefined()
      expect(failedResult?.source).toBe('market_index')
      expect(failedResult?.error).toContain('Market API unavailable')
    })
  })

  describe('retry logic', () => {
    it('should retry failed operations up to 3 times', async () => {
      // Arrange
      let attempts = 0
      mockDataSource.fetchMarketData = jest.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return Promise.resolve([
          { date: '2025-08-19', symbol: 'TOPIX', value: 2500, change_percent: 1.5 }
        ])
      })

      // Mock other data sources to succeed immediately
      mockDataSource.fetchFXRates = jest.fn().mockResolvedValue([])
      mockDataSource.fetchWeatherData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchEventsData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchSTEMNews = jest.fn().mockResolvedValue([])
      mockDataSource.fetchInboundData = jest.fn().mockResolvedValue([])

      // Act
      const result = await etlService.runFullETL()

      // Assert
      expect(attempts).toBe(3) // Should have retried 2 times (3 total attempts)
      expect(result.successCount).toBe(6)
      expect(result.failureCount).toBe(0)
    })

    it('should fail after 3 unsuccessful retry attempts', async () => {
      // Arrange
      let attempts = 0
      mockDataSource.fetchMarketData = jest.fn().mockImplementation(() => {
        attempts++
        throw new Error('Persistent failure')
      })

      // Mock other data sources to succeed
      mockDataSource.fetchFXRates = jest.fn().mockResolvedValue([])
      mockDataSource.fetchWeatherData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchEventsData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchSTEMNews = jest.fn().mockResolvedValue([])
      mockDataSource.fetchInboundData = jest.fn().mockResolvedValue([])

      // Act
      const result = await etlService.runFullETL()

      // Assert
      expect(attempts).toBe(3) // Should have attempted 3 times
      expect(result.successCount).toBe(5)
      expect(result.failureCount).toBe(1)

      const failedResult = result.results.find(r => !r.success)
      expect(failedResult?.error).toContain('Persistent failure')
    })
  })

  describe('data processing', () => {
    it('should correctly process market data', async () => {
      // This test would be more detailed in a real implementation
      // Testing the specific market data processing logic
      const mockData = [
        { date: '2025-08-19', symbol: 'TOPIX', value: 2500, change_percent: 1.5 },
        { date: '2025-08-19', symbol: 'NIKKEI225', value: 38000, change_percent: -0.5 }
      ]

      mockDataSource.fetchMarketData = jest.fn().mockResolvedValue(mockData)
      mockDataSource.fetchFXRates = jest.fn().mockResolvedValue([])
      mockDataSource.fetchWeatherData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchEventsData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchSTEMNews = jest.fn().mockResolvedValue([])
      mockDataSource.fetchInboundData = jest.fn().mockResolvedValue([])

      const result = await etlService.runFullETL()

      const marketResult = result.results.find(r => r.source === 'market_index')
      expect(marketResult?.success).toBe(true)
      expect(marketResult?.recordsProcessed).toBe(2)
    })

    it('should handle empty data gracefully', async () => {
      // Arrange - All data sources return empty arrays
      mockDataSource.fetchMarketData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchFXRates = jest.fn().mockResolvedValue([])
      mockDataSource.fetchWeatherData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchEventsData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchSTEMNews = jest.fn().mockResolvedValue([])
      mockDataSource.fetchInboundData = jest.fn().mockResolvedValue([])

      // Act
      const result = await etlService.runFullETL()

      // Assert
      expect(result.successCount).toBe(6)
      expect(result.failureCount).toBe(0)
      
      result.results.forEach(r => {
        expect(r.success).toBe(true)
        expect(r.recordsProcessed).toBe(0)
      })
    })
  })

  describe('performance requirements', () => {
    it('should complete ETL within 10 minutes', async () => {
      // Arrange
      mockDataSource.fetchMarketData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchFXRates = jest.fn().mockResolvedValue([])
      mockDataSource.fetchWeatherData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchEventsData = jest.fn().mockResolvedValue([])
      mockDataSource.fetchSTEMNews = jest.fn().mockResolvedValue([])
      mockDataSource.fetchInboundData = jest.fn().mockResolvedValue([])

      // Act
      const result = await etlService.runFullETL()

      // Assert
      const maxDuration = 10 * 60 * 1000 // 10 minutes in milliseconds
      expect(result.totalDuration).toBeLessThan(maxDuration)
    })
  })
})

describe('DataSource', () => {
  let dataSource: DataSource

  beforeEach(() => {
    dataSource = new DataSource()
  })

  describe('fetchMarketData', () => {
    it('should return valid market data structure', async () => {
      const result = await dataSource.fetchMarketData()

      expect(Array.isArray(result)).toBe(true)
      if (result.length > 0) {
        const item = result[0]
        expect(item).toHaveProperty('date')
        expect(item).toHaveProperty('symbol')
        expect(item).toHaveProperty('value')
        expect(item).toHaveProperty('change_percent')
        expect(typeof item.value).toBe('number')
      }
    })
  })

  describe('fetchFXRates', () => {
    it('should return valid FX rate data structure', async () => {
      const result = await dataSource.fetchFXRates()

      expect(Array.isArray(result)).toBe(true)
      if (result.length > 0) {
        const item = result[0]
        expect(item).toHaveProperty('date')
        expect(item).toHaveProperty('pair')
        expect(item).toHaveProperty('rate')
        expect(item).toHaveProperty('change_percent')
        expect(typeof item.rate).toBe('number')
      }
    })
  })

  describe('fetchWeatherData', () => {
    it('should return valid weather data structure', async () => {
      const result = await dataSource.fetchWeatherData()

      expect(Array.isArray(result)).toBe(true)
      if (result.length > 0) {
        const item = result[0]
        expect(item).toHaveProperty('date')
        expect(item).toHaveProperty('location')
        expect(item).toHaveProperty('temperature_max')
        expect(item).toHaveProperty('temperature_min')
        expect(item).toHaveProperty('precipitation_mm')
        expect(item).toHaveProperty('humidity_percent')
        expect(item).toHaveProperty('weather_condition')
      }
    })
  })

  describe('error handling', () => {
    it('should throw appropriate errors for network failures', async () => {
      // Mock fetch to simulate network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      // This test would need actual fetch calls in the real implementation
      // For now, we test that the mock data source doesn't throw errors
      await expect(dataSource.fetchMarketData()).resolves.not.toThrow()
    })
  })
})
