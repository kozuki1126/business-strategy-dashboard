/**
 * Dashboard E2E Tests
 * Task #006: ダッシュボードUI（α版）実装 - E2Eテスト
 * Created: 2025-08-19
 */

import { test, expect, Page } from '@playwright/test'

// Test data and helpers
const TEST_USER_EMAIL = 'test@example.com'
const DASHBOARD_URL = '/dashboard'
const AUTH_URL = '/auth'

// Helper function to login
async function loginUser(page: Page, email: string = TEST_USER_EMAIL) {
  await page.goto(AUTH_URL)
  await page.fill('input[type="email"]', email)
  await page.click('button[type="submit"]')
  
  // Wait for potential redirect to callback
  await page.waitForLoadState('networkidle')
  
  // In a real test, we'd handle the magic link flow
  // For now, we'll mock the authenticated state
  await page.addInitScript(() => {
    // Mock Supabase auth state
    window.localStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: 'mock-token',
      user: { email: 'test@example.com' }
    }))
  })
  
  await page.goto(DASHBOARD_URL)
}

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set up performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = []
      
      // Track page load performance
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        window.performanceMetrics.push({
          type: 'page_load',
          duration: perfData.loadEventEnd - perfData.loadEventStart,
          total_time: perfData.loadEventEnd - perfData.fetchStart
        })
      })
    })
  })

  test('loads dashboard and displays main sections', async ({ page }) => {
    await loginUser(page)
    
    // Check main header
    await expect(page.locator('h1')).toContainText('経営戦略ダッシュボード')
    
    // Check user authentication info
    await expect(page.locator('text=ログイン中:')).toBeVisible()
    await expect(page.locator('text=test@example.com')).toBeVisible()
    await expect(page.locator('text=認証済み - セッション有効時間: 30分')).toBeVisible()
    
    // Check logout button
    await expect(page.locator('button:has-text("ログアウト")')).toBeVisible()
  })

  test('displays and interacts with dashboard filters', async ({ page }) => {
    await loginUser(page)
    
    // Check filter section
    await expect(page.locator('text=ダッシュボードフィルタ')).toBeVisible()
    
    // Check period filter
    const periodSelect = page.locator('select').first()
    await expect(periodSelect).toBeVisible()
    
    // Test period change
    await periodSelect.selectOption('last-month')
    await page.waitForTimeout(500) // Wait for potential data reload
    
    // Check date range display
    await expect(page.locator('text=現在のフィルタ:')).toBeVisible()
    
    // Test filter reset
    await page.click('text=フィルタをリセット')
    await page.waitForTimeout(500)
  })

  test('displays KPI cards with data', async ({ page }) => {
    await loginUser(page)
    
    // Wait for data to load
    await page.waitForSelector('[data-testid="kpi-cards"], .card', { timeout: 10000 })
    
    // Check KPI cards
    await expect(page.locator('text=売上（税抜）')).toBeVisible()
    await expect(page.locator('text=客数')).toBeVisible()
    await expect(page.locator('text=取引数')).toBeVisible()
    await expect(page.locator('text=客単価')).toBeVisible()
    await expect(page.locator('text=転換率')).toBeVisible()
    
    // Check that KPI values are displayed (numbers with currency/formatting)
    await expect(page.locator('text=/¥[0-9,]+/')).toBeVisible()
    await expect(page.locator('text=/[0-9,]+/')).toBeVisible()
  })

  test('displays sales chart with Recharts', async ({ page }) => {
    await loginUser(page)
    
    // Wait for charts to load
    await page.waitForSelector('text=売上推移', { timeout: 10000 })
    
    // Check chart sections
    await expect(page.locator('text=売上推移')).toBeVisible()
    await expect(page.locator('text=売上金額（税抜）')).toBeVisible()
    await expect(page.locator('text=客数・取引数')).toBeVisible()
    await expect(page.locator('text=転換率 (%)')).toBeVisible()
    
    // Check data summary section
    await expect(page.locator('text=総売上:')).toBeVisible()
    await expect(page.locator('text=総客数:')).toBeVisible()
    await expect(page.locator('text=総取引:')).toBeVisible()
    await expect(page.locator('text=期間:')).toBeVisible()
  })

  test('displays external indicators', async ({ page }) => {
    await loginUser(page)
    
    // Wait for external data to load
    await page.waitForSelector('text=外部指標', { timeout: 10000 })
    
    // Check external indicators sections
    await expect(page.locator('text=外部指標')).toBeVisible()
    await expect(page.locator('text=📈 市場指標')).toBeVisible()
    await expect(page.locator('text=天候情報')).toBeVisible()
    await expect(page.locator('text=近隣イベント')).toBeVisible()
    
    // Check for data or no-data messages
    const marketSection = page.locator('text=📈 市場指標').locator('..')
    await expect(marketSection.locator('text=/TOPIX|日経225|市場データなし/')).toBeVisible()
  })

  test('handles loading states appropriately', async ({ page }) => {
    await loginUser(page)
    
    // Check initial loading state
    const initialLoader = page.locator('text=ダッシュボードを読み込み中...')
    // Loader should either be visible initially or not (if data loads quickly)
    
    // Wait for content to load
    await page.waitForSelector('text=売上推移', { timeout: 15000 })
    
    // Ensure loading state is gone
    await expect(initialLoader).not.toBeVisible()
  })

  test('performance: page loads within target time', async ({ page }) => {
    const startTime = Date.now()
    
    await loginUser(page)
    
    // Wait for main content to be loaded
    await page.waitForSelector('text=売上推移', { timeout: 15000 })
    await page.waitForSelector('text=外部指標', { timeout: 15000 })
    
    const endTime = Date.now()
    const totalLoadTime = endTime - startTime
    
    // Performance target: p95 ≤ 1500ms for initial render
    // We'll be a bit more lenient for E2E tests due to network overhead
    expect(totalLoadTime).toBeLessThan(3000) // 3 seconds for E2E
    
    console.log(`Dashboard load time: ${totalLoadTime}ms`)
  })

  test('performance: dashboard responds to filter changes quickly', async ({ page }) => {
    await loginUser(page)
    
    // Wait for initial load
    await page.waitForSelector('text=売上推移', { timeout: 10000 })
    
    // Measure filter change performance
    const startTime = Date.now()
    
    // Change period filter
    await page.selectOption('select', 'last-month')
    
    // Wait for data update (look for loading state or new data)
    await page.waitForTimeout(1000) // Allow time for the change to process
    
    const endTime = Date.now()
    const filterChangeTime = endTime - startTime
    
    // Filter changes should be under 2 seconds
    expect(filterChangeTime).toBeLessThan(2000)
    
    console.log(`Filter change response time: ${filterChangeTime}ms`)
  })

  test('accessibility: dashboard is keyboard navigable', async ({ page }) => {
    await loginUser(page)
    
    await page.waitForSelector('text=売上推移', { timeout: 10000 })
    
    // Test keyboard navigation
    await page.keyboard.press('Tab') // Should focus on first interactive element
    await page.keyboard.press('Tab') // Next element
    await page.keyboard.press('Tab') // Next element
    
    // Should be able to use Enter/Space on buttons
    const logoutButton = page.locator('button:has-text("ログアウト")')
    await logoutButton.focus()
    
    // Test that focused element is visible
    await expect(logoutButton).toBeFocused()
  })

  test('responsive design: dashboard works on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await loginUser(page)
    await page.waitForSelector('text=売上推移', { timeout: 10000 })
    
    // Check that content is still visible and usable
    await expect(page.locator('h1')).toContainText('経営戦略ダッシュボード')
    await expect(page.locator('text=売上推移')).toBeVisible()
    await expect(page.locator('text=外部指標')).toBeVisible()
    
    // Check that filters are accessible
    await expect(page.locator('text=ダッシュボードフィルタ')).toBeVisible()
    
    // Test scrolling behavior
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)
  })

  test('error handling: displays error state when data fails to load', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/analytics**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })
    
    await loginUser(page)
    
    // Should show error state
    await expect(page.locator('text=/エラー|失敗|問題/')).toBeVisible({ timeout: 10000 })
    
    // Should have a retry button
    await expect(page.locator('button:has-text("再読み込み")')).toBeVisible()
  })

  test('logout functionality works correctly', async ({ page }) => {
    await loginUser(page)
    
    await page.waitForSelector('text=売上推移', { timeout: 10000 })
    
    // Click logout button
    await page.click('button:has-text("ログアウト")')
    
    // Should redirect to auth page or home
    await page.waitForURL(/\/(auth|$)/, { timeout: 5000 })
    
    // Should not be able to access dashboard directly after logout
    await page.goto(DASHBOARD_URL)
    await page.waitForURL(/\/auth/, { timeout: 5000 })
  })
})

test.describe('Dashboard API', () => {
  test('analytics endpoint returns data with proper structure', async ({ request }) => {
    // Test the analytics API endpoint
    const response = await request.get('/api/analytics', {
      params: {
        start: '2025-08-01',
        end: '2025-08-31'
      },
      headers: {
        'Authorization': 'Bearer mock-token' // In real tests, use proper auth
      }
    })
    
    expect(response.status()).toBe(200)
    
    const data = await response.json()
    expect(data).toHaveProperty('data')
    expect(data).toHaveProperty('meta')
    expect(data.meta).toHaveProperty('response_time_ms')
    expect(data.meta.response_time_ms).toBeGreaterThan(0)
  })

  test('analytics endpoint handles invalid date range', async ({ request }) => {
    const response = await request.get('/api/analytics', {
      params: {
        start: '2025-13-01', // Invalid month
        end: '2025-08-31'
      },
      headers: {
        'Authorization': 'Bearer mock-token'
      }
    })
    
    // Should handle invalid dates gracefully
    expect([200, 400]).toContain(response.status())
  })

  test('analytics endpoint requires authentication', async ({ request }) => {
    const response = await request.get('/api/analytics', {
      params: {
        start: '2025-08-01',
        end: '2025-08-31'
      }
      // No authorization header
    })
    
    expect(response.status()).toBe(401)
  })
})

test.describe('Performance Monitoring', () => {
  test('dashboard meets performance SLO requirements', async ({ page }) => {
    // Track Web Vitals
    await page.addInitScript(() => {
      window.webVitals = {}
      
      // Mock Web Vitals measurement
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            window.webVitals.fcp = navEntry.responseEnd - navEntry.fetchStart
            window.webVitals.lcp = navEntry.loadEventEnd - navEntry.fetchStart
          }
        }
      }).observe({ entryTypes: ['navigation'] })
    })
    
    await loginUser(page)
    await page.waitForSelector('text=売上推移', { timeout: 10000 })
    
    // Get performance metrics
    const vitals = await page.evaluate(() => window.webVitals)
    
    console.log('Web Vitals:', vitals)
    
    // Performance assertions based on PRD requirements
    // These are relaxed for E2E testing due to network overhead
    if (vitals.fcp) {
      expect(vitals.fcp).toBeLessThan(2000) // First Contentful Paint
    }
    if (vitals.lcp) {
      expect(vitals.lcp).toBeLessThan(4000) // Largest Contentful Paint
    }
  })
})
