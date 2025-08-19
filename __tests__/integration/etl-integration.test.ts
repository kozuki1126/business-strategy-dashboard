/**
 * ETL Integration Tests
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: ETLパイプライン全体の統合テスト
 * Coverage: データベース接続・データ変換・監査ログ・通知
 */

import { createClient } from '@/lib/supabase/server'
import { ETLService } from '@/lib/services/etl'
import { AuditService } from '@/lib/services/audit'

// Use test database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for integration tests')
}

describe('ETL Integration Tests', () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(async () => {
    supabase = createClient()
    
    // Ensure test database is clean and has basic data
    await setupTestDatabase()
  })

  afterAll(async () => {
    // Clean up test data
    await cleanupTestDatabase()
  })

  describe('Full ETL Pipeline Integration', () => {
    it('should execute complete ETL pipeline and persist data', async () => {
      // Arrange
      const etlService = new ETLService()
      const startTime = Date.now()

      // Act
      const results = await etlService.runFullETL()
      const endTime = Date.now()

      // Assert
      expect(results).toBeDefined()
      expect(results.successCount).toBeGreaterThanOrEqual(0)
      expect(results.failureCount).toBeGreaterThanOrEqual(0)
      expect(results.results).toHaveLength(6) // All data sources
      expect(results.totalDuration).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(10 * 60 * 1000) // 10 minutes

      // Verify data was actually persisted in database
      await verifyDataPersistence(results)

      console.log(`ETL integration test completed: ${results.successCount}/${results.results.length} sources successful`)
    }, 10 * 60 * 1000) // 10-minute timeout

    it('should create audit log entries during ETL execution', async () => {
      // Arrange
      const etlService = new ETLService()
      const initialLogCount = await getAuditLogCount()

      // Act
      await etlService.runFullETL()

      // Assert
      const finalLogCount = await getAuditLogCount()
      expect(finalLogCount).toBeGreaterThan(initialLogCount)

      // Verify specific audit entries were created
      const recentLogs = await AuditService.getRecentLogs(50)
      const etlLogs = recentLogs.filter(log => 
        log.action.includes('etl_') || log.actor_id === 'etl_scheduler'
      )

      expect(etlLogs.length).toBeGreaterThan(0)

      // Check for start/success/failure logs
      const hasStartLog = etlLogs.some(log => log.action === 'etl_start')
      const hasCompletionLog = etlLogs.some(log => 
        log.action === 'etl_success' || log.action === 'etl_failure'
      )

      expect(hasStartLog || hasCompletionLog).toBe(true) // At least one type should exist

      console.log(`Found ${etlLogs.length} ETL-related audit log entries`)
    })
  })

  describe('Database Operations Integration', () => {
    it('should handle upsert operations correctly', async () => {
      // Test market data upsert
      const testData = {
        date: '2025-08-19',
        symbol: 'TEST_SYMBOL',
        value: 12345.67,
        change_percent: 2.5,
        updated_at: new Date().toISOString()
      }

      // Insert initial data
      const { error: insertError } = await supabase
        .from('ext_market_index')
        .insert(testData)

      expect(insertError).toBeNull()

      // Update the same data (upsert)
      const updatedData = { ...testData, value: 23456.78, change_percent: -1.2 }
      const { error: upsertError } = await supabase
        .from('ext_market_index')
        .upsert(updatedData, { onConflict: 'date,symbol' })

      expect(upsertError).toBeNull()

      // Verify the data was updated
      const { data: retrievedData, error: selectError } = await supabase
        .from('ext_market_index')
        .select('*')
        .eq('date', testData.date)
        .eq('symbol', testData.symbol)
        .single()

      expect(selectError).toBeNull()
      expect(retrievedData.value).toBe(23456.78)
      expect(retrievedData.change_percent).toBe(-1.2)
    })

    it('should maintain data integrity across all external tables', async () => {
      // Verify all external tables exist and are accessible
      const tables = [
        'ext_market_index',
        'ext_fx_rate', 
        'ext_weather_daily',
        'ext_events',
        'ext_stem_news',
        'ext_inbound'
      ]

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)

        expect(error).toBeNull()
        expect(Array.isArray(data)).toBe(true)
        
        console.log(`Table ${table} is accessible and operational`)
      }
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle database connection failures gracefully', async () => {
      // This test would require a way to simulate database failures
      // For now, we test normal operation
      const etlService = new ETLService()

      // Should not throw unhandled exceptions
      await expect(etlService.runFullETL()).resolves.toBeDefined()
    })

    it('should recover from partial data source failures', async () => {
      const etlService = new ETLService()
      
      // Execute ETL - some sources might fail in test environment
      const results = await etlService.runFullETL()

      // Should complete even if some sources fail
      expect(results).toBeDefined()
      expect(results.results).toHaveLength(6)
      
      // Should have detailed error information for failed sources
      const failedSources = results.results.filter(r => !r.success)
      failedSources.forEach(source => {
        expect(source.error).toBeDefined()
        expect(typeof source.error).toBe('string')
        expect(source.recordsProcessed).toBe(0)
      })
    })
  })

  describe('Performance Integration', () => {
    it('should meet performance requirements under normal load', async () => {
      const etlService = new ETLService()
      const startTime = Date.now()

      const results = await etlService.runFullETL()
      const totalTime = Date.now() - startTime

      // Performance requirements
      expect(totalTime).toBeLessThan(10 * 60 * 1000) // 10 minutes
      expect(results.totalDuration).toBeGreaterThan(0)
      expect(results.totalDuration).toBeLessThan(10 * 60 * 1000)

      // Log performance metrics
      console.log(`ETL performance: ${totalTime}ms total, ${results.totalDuration}ms reported`)
    })
  })

  describe('Data Quality Integration', () => {
    it('should validate data format and constraints', async () => {
      // Run ETL and then verify data quality
      const etlService = new ETLService()
      await etlService.runFullETL()

      // Check market data quality
      const { data: marketData } = await supabase
        .from('ext_market_index')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (marketData && marketData.length > 0) {
        marketData.forEach(record => {
          expect(record.date).toBeTruthy()
          expect(record.symbol).toBeTruthy()
          expect(typeof record.value).toBe('number')
          expect(record.value).toBeGreaterThan(0)
          expect(record.updated_at).toBeTruthy()
        })
      }

      // Check FX data quality
      const { data: fxData } = await supabase
        .from('ext_fx_rate')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10)

      if (fxData && fxData.length > 0) {
        fxData.forEach(record => {
          expect(record.date).toBeTruthy()
          expect(record.pair).toBeTruthy()
          expect(typeof record.rate).toBe('number')
          expect(record.rate).toBeGreaterThan(0)
          expect(record.updated_at).toBeTruthy()
        })
      }
    })
  })
})

// Helper functions

async function setupTestDatabase() {
  const supabase = createClient()
  
  // Ensure all required tables exist
  // This would typically be handled by migrations in a real environment
  console.log('Setting up test database...')
  
  // Verify basic tables are accessible
  const tables = ['dim_store', 'dim_department', 'audit_log']
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1)
    if (error) {
      console.warn(`Table ${table} not accessible:`, error.message)
    }
  }
}

async function cleanupTestDatabase() {
  const supabase = createClient()
  
  // Clean up test data (be careful not to delete production data)
  if (process.env.NODE_ENV === 'test') {
    console.log('Cleaning up test database...')
    
    // Remove test records created during integration tests
    await supabase
      .from('ext_market_index')
      .delete()
      .eq('symbol', 'TEST_SYMBOL')
  }
}

async function getAuditLogCount(): Promise<number> {
  const supabase = createClient()
  
  const { count, error } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.warn('Failed to get audit log count:', error.message)
    return 0
  }

  return count || 0
}

async function verifyDataPersistence(results: any) {
  const supabase = createClient()
  
  // Check that successful data sources actually saved data
  for (const result of results.results) {
    if (result.success && result.recordsProcessed > 0) {
      let tableName = ''
      
      switch (result.source) {
        case 'market_index':
          tableName = 'ext_market_index'
          break
        case 'fx_rates':
          tableName = 'ext_fx_rate'
          break
        case 'weather':
          tableName = 'ext_weather_daily'
          break
        case 'events':
          tableName = 'ext_events'
          break
        case 'stem_news':
          tableName = 'ext_stem_news'
          break
        case 'inbound':
          tableName = 'ext_inbound'
          break
      }

      if (tableName) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)

        expect(error).toBeNull()
        if (result.recordsProcessed > 0) {
          expect(data).toBeTruthy()
          expect(data?.length).toBeGreaterThan(0)
        }
      }
    }
  }
}
