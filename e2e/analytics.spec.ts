/**
 * E2E Tests: Analytics & Correlation Analysis
 * Task #015: E2E Test Comprehensive Implementation
 * 
 * Test Coverage:
 * - Analytics page functionality
 * - Correlation analysis execution
 * - Performance monitoring (p95 ≤ 5s SLA)
 * - Data visualization rendering
 * - Filter operations
 * - Error handling
 * - Accessibility compliance
 * - Mobile responsiveness
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Analytics & Correlation Analysis', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to analytics page
    await page.goto('/analytics');
    
    // Wait for authentication and page load
    await expect(page.locator('h1')).toContainText('相関・比較分析', { timeout: 10000 });
  });

  test.describe('Page Loading & Navigation', () => {
    test('should load analytics page successfully', async () => {
      // Verify page title and main heading
      await expect(page).toHaveTitle(/アナリティクス|Analytics/);
      await expect(page.locator('h1')).toContainText('相関・比較分析');
      
      // Check navigation breadcrumb
      await expect(page.locator('[data-testid="breadcrumb"]')).toContainText('アナリティクス');
      
      // Verify main components are visible
      await expect(page.locator('[data-testid="correlation-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="analysis-controls"]')).toBeVisible();
    });

    test('should navigate from dashboard to analytics', async () => {
      // Start from dashboard
      await page.goto('/dashboard');
      await expect(page.locator('h1')).toContainText('ダッシュボード');
      
      // Click analytics link in navigation
      await page.click('[data-testid="nav-analytics"]');
      
      // Verify navigation successful
      await expect(page).toHaveURL(/.*\/analytics/);
      await expect(page.locator('h1')).toContainText('相関・比較分析');
    });
  });

  test.describe('Correlation Analysis Functionality', () => {
    test('should execute correlation analysis with default settings', async () => {
      const startTime = Date.now();
      
      // Click analyze button with default settings (7 days)
      await page.click('[data-testid="analyze-button"]');
      
      // Wait for analysis completion
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible({ timeout: 8000 });
      
      // Verify performance SLA (p95 ≤ 5s)
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(5000); // 5 second SLA
      
      // Verify correlation coefficients display
      await expect(page.locator('[data-testid="correlation-coefficient"]')).toHaveCount({ min: 1 });
      
      // Verify heatmap rendering
      await expect(page.locator('[data-testid="heatmap-container"]')).toBeVisible();
      await expect(page.locator('svg')).toBeVisible(); // Chart SVG element
    });

    test('should perform analysis with different time periods', async () => {
      const periods = [
        { value: '7days', label: '7日間', timeout: 3000 },
        { value: '30days', label: '30日間', timeout: 4000 },
        { value: 'thisMonth', label: '今月', timeout: 4000 },
        { value: '3months', label: '3ヶ月', timeout: 5000 }
      ];

      for (const period of periods) {
        // Select time period
        await page.selectOption('[data-testid="period-select"]', period.value);
        await expect(page.locator('[data-testid="period-select"]')).toHaveValue(period.value);
        
        // Execute analysis
        const startTime = Date.now();
        await page.click('[data-testid="analyze-button"]');
        
        // Wait for results
        await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible({ 
          timeout: period.timeout + 1000 
        });
        
        // Verify performance
        const endTime = Date.now();
        expect(endTime - startTime).toBeLessThan(period.timeout);
        
        // Verify data updated
        await expect(page.locator('[data-testid="analysis-period"]')).toContainText(period.label);
        
        // Wait before next iteration
        await page.waitForTimeout(500);
      }
    });

    test('should display correlation analysis results correctly', async () => {
      // Execute analysis
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify correlation sections
      const sections = [
        'weekday-correlation',
        'weather-correlation', 
        'event-correlation',
        'time-series-comparison'
      ];
      
      for (const section of sections) {
        await expect(page.locator(`[data-testid="${section}"]`)).toBeVisible();
      }
      
      // Verify correlation coefficients are numbers between -1 and 1
      const coefficients = await page.locator('[data-testid="correlation-value"]').allTextContents();
      for (const coeff of coefficients) {
        const value = parseFloat(coeff);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
      
      // Verify heatmap has proper color coding
      await expect(page.locator('[data-testid="heatmap-cell"]')).toHaveCount({ min: 7 }); // 7 days minimum
    });

    test('should handle analysis with store and department filters', async () => {
      // Apply store filter
      await page.selectOption('[data-testid="store-filter"]', 'store-001');
      await expect(page.locator('[data-testid="store-filter"]')).toHaveValue('store-001');
      
      // Apply department filter
      await page.selectOption('[data-testid="department-filter"]', 'electronics');
      await expect(page.locator('[data-testid="department-filter"]')).toHaveValue('electronics');
      
      // Execute filtered analysis
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify filter indication in results
      await expect(page.locator('[data-testid="applied-filters"]')).toContainText('店舗: 001');
      await expect(page.locator('[data-testid="applied-filters"]')).toContainText('部門: Electronics');
    });
  });

  test.describe('Data Visualization', () => {
    test('should render heatmap visualization correctly', async () => {
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify heatmap container
      const heatmap = page.locator('[data-testid="heatmap-container"]');
      await expect(heatmap).toBeVisible();
      
      // Verify heatmap has cells
      await expect(page.locator('[data-testid="heatmap-cell"]')).toHaveCount({ min: 1 });
      
      // Test heatmap cell hover
      const firstCell = page.locator('[data-testid="heatmap-cell"]').first();
      await firstCell.hover();
      
      // Verify tooltip appears
      await expect(page.locator('[data-testid="heatmap-tooltip"]')).toBeVisible();
      await expect(page.locator('[data-testid="heatmap-tooltip"]')).toContainText(/売上|相関/);
    });

    test('should display time series comparison charts', async () => {
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify time series chart
      await expect(page.locator('[data-testid="time-series-chart"]')).toBeVisible();
      
      // Verify chart elements
      await expect(page.locator('[data-testid="chart-line"]')).toHaveCount({ min: 1 });
      await expect(page.locator('[data-testid="chart-legend"]')).toBeVisible();
      await expect(page.locator('[data-testid="chart-axes"]')).toBeVisible();
      
      // Test chart interaction
      await page.hover('[data-testid="chart-line"]');
      await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
    });

    test('should provide data export functionality', async () => {
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify export button is available
      await expect(page.locator('[data-testid="export-analysis"]')).toBeVisible();
      
      // Test export modal
      await page.click('[data-testid="export-analysis"]');
      await expect(page.locator('[data-testid="export-modal"]')).toBeVisible();
      
      // Verify export options
      await expect(page.locator('[data-testid="export-csv"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-json"]')).toBeVisible();
      
      // Close modal
      await page.click('[data-testid="modal-close"]');
      await expect(page.locator('[data-testid="export-modal"]')).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.route('/api/analytics/correlation', route => route.abort());
      
      // Attempt analysis
      await page.click('[data-testid="analyze-button"]');
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/エラー|Error/);
      
      // Verify retry functionality
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should handle empty data scenarios', async () => {
      // Mock empty data response
      await page.route('/api/analytics/correlation', route => 
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            correlations: [],
            message: 'No data available for selected period'
          })
        })
      );
      
      // Execute analysis
      await page.click('[data-testid="analyze-button"]');
      
      // Verify empty state
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(page.locator('[data-testid="empty-state"]')).toContainText(/データがありません/);
    });

    test('should validate form inputs', async () => {
      // Test invalid date range
      await page.fill('[data-testid="start-date"]', '2025-12-01');
      await page.fill('[data-testid="end-date"]', '2025-01-01');
      
      // Attempt analysis
      await page.click('[data-testid="analyze-button"]');
      
      // Verify validation error
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(/日付が無効/);
    });
  });

  test.describe('Performance Monitoring', () => {
    test('should meet SLA requirements for different data sizes', async () => {
      const testCases = [
        { period: '7days', maxTime: 1500, label: '小規模データ (7日)' },
        { period: '30days', maxTime: 3000, label: '中規模データ (30日)' },
        { period: '3months', maxTime: 5000, label: '大規模データ (3ヶ月)' }
      ];

      for (const testCase of testCases) {
        // Set period
        await page.selectOption('[data-testid="period-select"]', testCase.period);
        
        // Measure execution time
        const startTime = Date.now();
        await page.click('[data-testid="analyze-button"]');
        await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
        const endTime = Date.now();
        
        // Verify SLA compliance
        const executionTime = endTime - startTime;
        expect(executionTime, `${testCase.label} should complete within ${testCase.maxTime}ms`)
          .toBeLessThan(testCase.maxTime);
        
        console.log(`${testCase.label}: ${executionTime}ms (Target: ${testCase.maxTime}ms)`);
        
        await page.waitForTimeout(1000); // Wait between tests
      }
    });

    test('should track and display performance metrics', async () => {
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify performance info is displayed
      await expect(page.locator('[data-testid="execution-time"]')).toBeVisible();
      
      // Get execution time value
      const timeText = await page.locator('[data-testid="execution-time"]').textContent();
      const timeMatch = timeText?.match(/(\d+(?:\.\d+)?)/);
      expect(timeMatch).toBeTruthy();
      
      const executionTime = parseFloat(timeMatch![1]);
      expect(executionTime).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(5); // 5 second SLA
    });
  });

  test.describe('Accessibility & Responsive Design', () => {
    test('should be accessible with keyboard navigation', async () => {
      // Test tab navigation through form controls
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="period-select"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="store-filter"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="department-filter"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="analyze-button"]')).toBeFocused();
      
      // Test keyboard execution
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
    });

    test('should work correctly on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Reload page
      await page.reload();
      await expect(page.locator('h1')).toContainText('相関・比較分析');
      
      // Verify mobile navigation
      await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
      
      // Test mobile form interaction
      await page.click('[data-testid="mobile-menu-toggle"]');
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify heatmap is responsive
      const heatmap = page.locator('[data-testid="heatmap-container"]');
      await expect(heatmap).toBeVisible();
      
      const heatmapBox = await heatmap.boundingBox();
      expect(heatmapBox?.width).toBeLessThanOrEqual(375); // Fits mobile width
    });

    test('should have proper ARIA labels and roles', async () => {
      // Verify form has proper labels
      await expect(page.locator('label[for="period-select"]')).toBeVisible();
      await expect(page.locator('[data-testid="analyze-button"]')).toHaveAttribute('role', 'button');
      
      // Verify analysis results have proper structure
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      await expect(page.locator('[data-testid="correlation-results"]')).toHaveAttribute('role', 'region');
      await expect(page.locator('[data-testid="heatmap-container"]')).toHaveAttribute('role', 'img');
      await expect(page.locator('[data-testid="heatmap-container"]')).toHaveAttribute('aria-label');
    });
  });

  test.describe('Integration & Data Quality', () => {
    test('should integrate with audit logging', async () => {
      // Execute analysis
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Navigate to audit logs
      await page.goto('/audit');
      await expect(page.locator('h1')).toContainText('監査ログ');
      
      // Verify analytics action was logged
      await page.fill('[data-testid="action-filter"]', 'view_analytics');
      await page.click('[data-testid="search-button"]');
      
      await expect(page.locator('[data-testid="audit-entry"]').first()).toContainText('view_analytics');
      await expect(page.locator('[data-testid="audit-entry"]').first()).toContainText('correlation_analysis');
    });

    test('should validate data consistency', async () => {
      await page.click('[data-testid="analyze-button"]');
      await expect(page.locator('[data-testid="correlation-results"]')).toBeVisible();
      
      // Verify sample size is displayed and reasonable
      const sampleSize = await page.locator('[data-testid="sample-size"]').textContent();
      const sampleMatch = sampleSize?.match(/(\d+)/);
      expect(sampleMatch).toBeTruthy();
      
      const samples = parseInt(sampleMatch![1]);
      expect(samples).toBeGreaterThan(0);
      expect(samples).toBeLessThan(10000); // Reasonable upper limit
      
      // Verify correlation values are mathematically valid
      const correlations = await page.locator('[data-testid="correlation-value"]').allTextContents();
      for (const corr of correlations) {
        const value = parseFloat(corr);
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
        expect(isNaN(value)).toBeFalsy();
      }
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Capture additional diagnostics on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      // Take screenshot
      await page.screenshot({ 
        path: `test-results/analytics-failure-${testInfo.title.replace(/\s+/g, '-')}.png`,
        fullPage: true 
      });
      
      // Capture console logs
      page.on('console', msg => {
        console.log(`Console ${msg.type()}: ${msg.text()}`);
      });
      
      // Capture network activity
      page.on('response', response => {
        if (response.status() >= 400) {
          console.log(`Network Error: ${response.status()} ${response.url()}`);
        }
      });
    }
  });
});
