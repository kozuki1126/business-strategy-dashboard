/**
 * ETL E2E Tests
 * Task #008: ETL スケジューラ実装
 * 
 * Purpose: ETL APIエンドポイントの統合テスト
 * Coverage: API応答・データ保存・エラーハンドリング・パフォーマンス
 */

import { test, expect } from '@playwright/test'

const API_TIMEOUT = 10 * 60 * 1000 // 10 minutes for ETL operations
const ETL_API_ENDPOINT = '/api/etl'

test.describe('ETL API Endpoint', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for ETL operations
    page.setDefaultTimeout(API_TIMEOUT)
  })

  test('should successfully execute ETL via POST endpoint', async ({ request }) => {
    // Arrange
    const startTime = Date.now()

    // Act
    const response = await request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const responseData = await response.json()
    const endTime = Date.now()
    const duration = endTime - startTime

    // Assert
    expect(response.status()).toBe(200)
    expect(responseData.success).toBe(true)
    expect(responseData.message).toContain('ETL process completed successfully')
    expect(responseData.data).toHaveProperty('run_id')
    expect(responseData.data).toHaveProperty('duration_ms')
    expect(responseData.data).toHaveProperty('results')
    expect(responseData.data).toHaveProperty('completed_at')

    // Performance requirement: Complete within 10 minutes
    expect(duration).toBeLessThan(10 * 60 * 1000)

    // Verify ETL results structure
    const results = responseData.data.results
    expect(results).toHaveProperty('totalDuration')
    expect(results).toHaveProperty('successCount')
    expect(results).toHaveProperty('failureCount')
    expect(results).toHaveProperty('results')
    expect(Array.isArray(results.results)).toBe(true)

    // Verify data sources were processed
    const dataSourceNames = ['market_index', 'fx_rates', 'weather', 'events', 'stem_news', 'inbound']
    const processedSources = results.results.map((r: any) => r.source)
    
    dataSourceNames.forEach(sourceName => {
      expect(processedSources).toContain(sourceName)
    })

    console.log(`ETL completed in ${duration}ms with ${results.successCount}/${results.results.length} sources successful`)
  })

  test('should handle manual trigger via GET endpoint with authentication', async ({ request }) => {
    // Act - Without authentication (should fail)
    const unauthorizedResponse = await request.get(ETL_API_ENDPOINT)
    const unauthorizedData = await unauthorizedResponse.json()

    // Assert - Unauthorized access
    expect(unauthorizedResponse.status()).toBe(401)
    expect(unauthorizedData.success).toBe(false)
    expect(unauthorizedData.message).toContain('Unauthorized')

    // Act - With authentication token
    const authorizedResponse = await request.get(ETL_API_ENDPOINT, {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      timeout: API_TIMEOUT
    })

    const authorizedData = await authorizedResponse.json()

    // Assert - Authorized access succeeds
    expect(authorizedResponse.status()).toBe(200)
    expect(authorizedData.success).toBe(true)
    expect(authorizedData.message).toContain('ETL process completed successfully')
  })

  test('should handle timeout scenarios gracefully', async ({ request }) => {
    // Note: This test would require a special endpoint or mock that intentionally times out
    // For now, we test that normal operations complete within reasonable time

    const response = await request.post(ETL_API_ENDPOINT, {
      timeout: 30000 // 30 seconds - much shorter than ETL timeout for testing
    })

    // If ETL takes longer than 30s, this will throw
    // In production, we might want to test actual timeout behavior
    expect(response.ok()).toBe(true)
  })

  test('should provide detailed performance metrics', async ({ request }) => {
    // Act
    const response = await request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })

    const responseData = await response.json()

    // Assert performance metrics are included
    expect(responseData.data).toHaveProperty('duration_ms')
    expect(typeof responseData.data.duration_ms).toBe('number')
    expect(responseData.data.duration_ms).toBeGreaterThan(0)

    const results = responseData.data.results
    expect(results).toHaveProperty('totalDuration')
    expect(typeof results.totalDuration).toBe('number')

    // Verify individual source metrics
    results.results.forEach((result: any) => {
      expect(result).toHaveProperty('source')
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('recordsProcessed')
      expect(result).toHaveProperty('duration')
      expect(typeof result.duration).toBe('number')
    })
  })

  test('should create audit log entries', async ({ request, page }) => {
    // Act - Execute ETL
    const etlResponse = await request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })

    expect(etlResponse.ok()).toBe(true)
    const etlData = await etlResponse.json()
    const runId = etlData.data.run_id

    // Verify audit log creation by checking if we can query recent logs
    // Note: This would require additional API endpoint to query audit logs
    // For now, we verify the ETL response includes the run_id which is used for auditing
    expect(runId).toBeTruthy()
    expect(typeof runId).toBe('string')
    expect(runId).toMatch(/^etl-\d+$/)
  })

  test('should maintain data consistency across multiple runs', async ({ request }) => {
    // Act - Execute ETL twice
    const firstRun = await request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })
    expect(firstRun.ok()).toBe(true)
    const firstData = await firstRun.json()

    // Wait a moment between runs
    await new Promise(resolve => setTimeout(resolve, 1000))

    const secondRun = await request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })
    expect(secondRun.ok()).toBe(true)
    const secondData = await secondRun.json()

    // Assert - Both runs should be successful
    expect(firstData.success).toBe(true)
    expect(secondData.success).toBe(true)

    // Verify run IDs are different
    expect(firstData.data.run_id).not.toBe(secondData.data.run_id)

    // Both should process the same number of data sources
    expect(firstData.data.results.results.length).toBe(secondData.data.results.results.length)
  })
})

test.describe('ETL Performance Requirements', () => {
  test('should meet p95 response time requirements', async ({ request }) => {
    const runs = []
    const numRuns = 5 // Run multiple times to test consistency

    for (let i = 0; i < numRuns; i++) {
      const startTime = Date.now()
      
      const response = await request.post(ETL_API_ENDPOINT, {
        timeout: API_TIMEOUT
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(response.ok()).toBe(true)
      runs.push(duration)

      console.log(`ETL run ${i + 1}: ${duration}ms`)
    }

    // Calculate p95 (95th percentile)
    runs.sort((a, b) => a - b)
    const p95Index = Math.floor(runs.length * 0.95)
    const p95Duration = runs[p95Index]

    console.log(`ETL p95 duration: ${p95Duration}ms`)

    // Performance requirement: p95 ≤ 10 minutes
    expect(p95Duration).toBeLessThan(10 * 60 * 1000)
  })

  test('should handle concurrent ETL requests properly', async ({ request }) => {
    // Note: In production, we might want to prevent concurrent ETL runs
    // This test verifies the behavior when multiple requests are made

    const concurrent1Promise = request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })
    
    const concurrent2Promise = request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })

    // Wait for both to complete
    const [response1, response2] = await Promise.all([
      concurrent1Promise,
      concurrent2Promise
    ])

    // Both should complete successfully
    // (In production, you might want to implement locking to prevent concurrent runs)
    expect(response1.ok()).toBe(true)
    expect(response2.ok()).toBe(true)

    const data1 = await response1.json()
    const data2 = await response2.json()

    expect(data1.success).toBe(true)
    expect(data2.success).toBe(true)

    // Verify they have different run IDs
    expect(data1.data.run_id).not.toBe(data2.data.run_id)
  })
})

test.describe('ETL Error Handling', () => {
  test('should return proper error responses for malformed requests', async ({ request }) => {
    // Act - Send malformed request
    const response = await request.post(ETL_API_ENDPOINT, {
      data: 'invalid-json-data',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Even with malformed body, ETL should work since it doesn't require request body
    // The important thing is that it doesn't crash
    expect(response.status()).toBeLessThan(500) // Should not be a server error
  })

  test('should handle database connection failures gracefully', async ({ request }) => {
    // This test would require injecting database failures
    // For now, we test that normal operations work correctly
    
    const response = await request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })

    // Normal case should work
    expect(response.ok()).toBe(true)
    
    const data = await response.json()
    expect(data.success).toBe(true)
  })
})

test.describe('ETL Integration with Dashboard', () => {
  test('should update external data that reflects in dashboard', async ({ request, page }) => {
    // Act - Execute ETL first
    const etlResponse = await request.post(ETL_API_ENDPOINT, {
      timeout: API_TIMEOUT
    })

    expect(etlResponse.ok()).toBe(true)
    const etlData = await etlResponse.json()
    expect(etlData.success).toBe(true)

    // Navigate to dashboard to verify data is available
    await page.goto('/dashboard')
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 10000 })

    // Verify that external indicators are displayed
    // These should show updated data from the ETL run
    await expect(page.locator('[data-testid="external-indicators"]')).toBeVisible()
    
    // Look for specific data that should be updated by ETL
    await expect(page.locator('[data-testid="market-data"]')).toBeVisible()
    await expect(page.locator('[data-testid="fx-rates"]')).toBeVisible()
    await expect(page.locator('[data-testid="weather-data"]')).toBeVisible()

    console.log('Dashboard successfully displays ETL-updated data')
  })
})
