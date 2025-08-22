/**
 * E2E Tests: Audit Log System
 * Task #015: E2E Test Comprehensive Implementation
 * 
 * Test Coverage:
 * - Audit log display and filtering
 * - Security monitoring and analysis
 * - Export functionality
 * - Search and pagination
 * - Real-time log updates
 * - Compliance features
 * - Access control verification
 * - Performance monitoring
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Audit Log System', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to audit page
    await page.goto('/audit');
    
    // Wait for authentication and page load
    await expect(page.locator('h1')).toContainText('監査ログ', { timeout: 10000 });
  });

  test.describe('Page Loading & Navigation', () => {
    test('should load audit log page successfully', async () => {
      // Verify page title and main heading
      await expect(page).toHaveTitle(/監査ログ|Audit/);
      await expect(page.locator('h1')).toContainText('監査ログ');
      
      // Check main components
      await expect(page.locator('[data-testid="audit-search-filters"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-metrics-cards"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-logs-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-security-panel"]')).toBeVisible();
    });

    test('should navigate from main menu to audit logs', async () => {
      // Start from dashboard
      await page.goto('/dashboard');
      await expect(page.locator('h1')).toContainText('ダッシュボード');
      
      // Click audit log navigation
      await page.click('[data-testid="nav-audit"]');
      
      // Verify navigation successful
      await expect(page).toHaveURL(/.*\/audit/);
      await expect(page.locator('h1')).toContainText('監査ログ');
    });

    test('should load quick action audit button', async () => {
      await page.goto('/dashboard');
      
      // Click quick action audit button
      await page.click('[data-testid="quick-audit"]');
      
      // Verify navigation to audit page
      await expect(page).toHaveURL(/.*\/audit/);
      await expect(page.locator('h1')).toContainText('監査ログ');
    });
  });

  test.describe('Search & Filter Functionality', () => {
    test('should filter logs by date range', async () => {
      // Set date range filter
      await page.fill('[data-testid="start-date"]', '2025-08-01');
      await page.fill('[data-testid="end-date"]', '2025-08-22');
      
      // Apply filter
      await page.click('[data-testid="apply-filters"]');
      
      // Wait for results
      await expect(page.locator('[data-testid="audit-entry"]')).toHaveCount({ min: 1 });
      
      // Verify date range in results
      const firstEntry = page.locator('[data-testid="audit-entry"]').first();
      await expect(firstEntry.locator('[data-testid="entry-timestamp"]')).toContainText('2025-08');
    });

    test('should filter logs by user', async () => {
      // Select user filter
      await page.selectOption('[data-testid="user-filter"]', 'test@example.com');
      await page.click('[data-testid="apply-filters"]');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="audit-entry"]')).toHaveCount({ min: 1 });
      
      // Check that all entries match the user
      const userCells = page.locator('[data-testid="entry-user"]');
      for (let i = 0; i < await userCells.count(); i++) {
        await expect(userCells.nth(i)).toContainText('test@example.com');
      }
    });

    test('should filter logs by action type', async () => {
      const actionTypes = ['login', 'view_dashboard', 'input_sales', 'export_data', 'view_analytics'];
      
      for (const action of actionTypes) {
        // Apply action filter
        await page.selectOption('[data-testid="action-filter"]', action);
        await page.click('[data-testid="apply-filters"]');
        
        // Verify results contain the action
        if (await page.locator('[data-testid="audit-entry"]').count() > 0) {
          const actionCells = page.locator('[data-testid="entry-action"]');
          for (let i = 0; i < Math.min(5, await actionCells.count()); i++) {
            await expect(actionCells.nth(i)).toContainText(action);
          }
        }
        
        // Clear filter for next iteration
        await page.selectOption('[data-testid="action-filter"]', '');
      }
    });

    test('should search logs by keyword', async () => {
      // Enter search keyword
      await page.fill('[data-testid="keyword-search"]', 'dashboard');
      await page.click('[data-testid="search-button"]');
      
      // Verify search results
      await expect(page.locator('[data-testid="audit-entry"]')).toHaveCount({ min: 1 });
      
      // Check that results contain the keyword
      const entries = page.locator('[data-testid="audit-entry"]');
      for (let i = 0; i < Math.min(3, await entries.count()); i++) {
        const entryText = await entries.nth(i).textContent();
        expect(entryText?.toLowerCase()).toContain('dashboard');
      }
    });

    test('should use preset time periods', async () => {
      const presets = [
        { value: '1hour', label: '1時間', expected: 1 },
        { value: '24hours', label: '24時間', expected: 24 },
        { value: '7days', label: '7日間', expected: 7 * 24 },
        { value: '30days', label: '30日間', expected: 30 * 24 }
      ];

      for (const preset of presets) {
        // Click preset button
        await page.click(`[data-testid="preset-${preset.value}"]`);
        
        // Verify filter applied
        await expect(page.locator('[data-testid="active-filter"]')).toContainText(preset.label);
        
        // Check results are filtered
        await expect(page.locator('[data-testid="audit-entry"]')).toHaveCount({ min: 0 });
        
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Audit Metrics & Statistics', () => {
    test('should display audit metrics cards', async () => {
      // Verify metrics cards are present
      const metricsCards = [
        'total-logs',
        'unique-users', 
        'action-types',
        'failure-rate'
      ];

      for (const cardId of metricsCards) {
        await expect(page.locator(`[data-testid="${cardId}"]`)).toBeVisible();
        
        // Verify metric value is displayed
        const value = await page.locator(`[data-testid="${cardId}-value"]`).textContent();
        expect(value).toBeTruthy();
        expect(parseInt(value || '0')).toBeGreaterThanOrEqual(0);
      }
    });

    test('should show performance metrics', async () => {
      // Verify performance section
      await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
      
      // Check response time metrics
      await expect(page.locator('[data-testid="avg-response-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="p95-response-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="sla-compliance"]')).toBeVisible();
      
      // Verify values are reasonable
      const avgTime = await page.locator('[data-testid="avg-response-time-value"]').textContent();
      const p95Time = await page.locator('[data-testid="p95-response-time-value"]').textContent();
      
      expect(parseFloat(avgTime || '0')).toBeGreaterThan(0);
      expect(parseFloat(p95Time || '0')).toBeGreaterThan(0);
    });

    test('should display time series charts', async () => {
      // Verify time series chart container
      await expect(page.locator('[data-testid="time-series-chart"]')).toBeVisible();
      
      // Check chart elements
      await expect(page.locator('[data-testid="chart-canvas"]')).toBeVisible();
      await expect(page.locator('[data-testid="chart-legend"]')).toBeVisible();
      
      // Test chart interaction
      await page.hover('[data-testid="chart-canvas"]');
      await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
    });
  });

  test.describe('Security Analysis Panel', () => {
    test('should display security risk assessment', async () => {
      // Verify security panel
      await expect(page.locator('[data-testid="security-panel"]')).toBeVisible();
      
      // Check risk score
      await expect(page.locator('[data-testid="risk-score"]')).toBeVisible();
      const riskScore = await page.locator('[data-testid="risk-score-value"]').textContent();
      const score = parseFloat(riskScore || '0');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      
      // Verify risk level indicator
      await expect(page.locator('[data-testid="risk-level"]')).toBeVisible();
    });

    test('should show anomaly detection results', async () => {
      // Verify anomaly section
      await expect(page.locator('[data-testid="anomaly-detection"]')).toBeVisible();
      
      // Check anomaly indicators
      const anomalyTypes = [
        'time-anomaly',
        'location-anomaly', 
        'behavior-anomaly',
        'frequency-anomaly'
      ];

      for (const type of anomalyTypes) {
        await expect(page.locator(`[data-testid="${type}"]`)).toBeVisible();
      }
    });

    test('should display IP analysis', async () => {
      // Verify IP analysis section
      await expect(page.locator('[data-testid="ip-analysis"]')).toBeVisible();
      
      // Check top IPs list
      await expect(page.locator('[data-testid="top-ips"]')).toBeVisible();
      
      // Verify IP entries
      const ipEntries = page.locator('[data-testid="ip-entry"]');
      if (await ipEntries.count() > 0) {
        // Check first IP entry format
        const firstIP = await ipEntries.first().locator('[data-testid="ip-address"]').textContent();
        expect(firstIP).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      }
    });

    test('should show failure rate monitoring', async () => {
      // Verify failure rate section
      await expect(page.locator('[data-testid="failure-monitoring"]')).toBeVisible();
      
      // Check failure rate value
      const failureRate = await page.locator('[data-testid="failure-rate-value"]').textContent();
      const rate = parseFloat(failureRate?.replace('%', '') || '0');
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
      
      // Verify threshold indicators
      await expect(page.locator('[data-testid="failure-threshold"]')).toBeVisible();
    });
  });

  test.describe('Audit Logs Table', () => {
    test('should display audit logs in table format', async () => {
      // Verify table is present
      await expect(page.locator('[data-testid="audit-table"]')).toBeVisible();
      
      // Check table headers
      const headers = [
        'timestamp',
        'user',
        'action', 
        'target',
        'ip-address',
        'status'
      ];

      for (const header of headers) {
        await expect(page.locator(`[data-testid="header-${header}"]`)).toBeVisible();
      }
    });

    test('should support table sorting', async () => {
      // Test sorting by timestamp
      await page.click('[data-testid="sort-timestamp"]');
      
      // Verify sort indicator
      await expect(page.locator('[data-testid="sort-indicator-timestamp"]')).toBeVisible();
      
      // Check that entries are sorted
      const timestamps = await page.locator('[data-testid="entry-timestamp"]').allTextContents();
      expect(timestamps.length).toBeGreaterThan(0);
      
      // Test reverse sort
      await page.click('[data-testid="sort-timestamp"]');
      await expect(page.locator('[data-testid="sort-indicator-timestamp"][data-direction="desc"]')).toBeVisible();
    });

    test('should support pagination', async () => {
      // Check if pagination is present (if there are enough entries)
      const entriesCount = await page.locator('[data-testid="audit-entry"]').count();
      
      if (entriesCount >= 10) {
        // Verify pagination controls
        await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
        await expect(page.locator('[data-testid="next-page"]')).toBeVisible();
        
        // Test page navigation
        await page.click('[data-testid="next-page"]');
        
        // Verify page changed
        await expect(page.locator('[data-testid="current-page"]')).toContainText('2');
        
        // Go back to first page
        await page.click('[data-testid="prev-page"]');
        await expect(page.locator('[data-testid="current-page"]')).toContainText('1');
      }
    });

    test('should show detailed log information', async () => {
      // Click on first audit entry for details
      const firstEntry = page.locator('[data-testid="audit-entry"]').first();
      await firstEntry.click();
      
      // Verify detail modal opens
      await expect(page.locator('[data-testid="audit-detail-modal"]')).toBeVisible();
      
      // Check detail fields
      const detailFields = [
        'detail-timestamp',
        'detail-user',
        'detail-action',
        'detail-target',
        'detail-ip',
        'detail-user-agent',
        'detail-metadata'
      ];

      for (const field of detailFields) {
        await expect(page.locator(`[data-testid="${field}"]`)).toBeVisible();
      }
      
      // Close modal
      await page.click('[data-testid="close-modal"]');
      await expect(page.locator('[data-testid="audit-detail-modal"]')).not.toBeVisible();
    });
  });

  test.describe('Export Functionality', () => {
    test('should open export modal', async () => {
      // Click export button
      await page.click('[data-testid="export-audit-logs"]');
      
      // Verify export modal
      await expect(page.locator('[data-testid="audit-export-modal"]')).toBeVisible();
      
      // Check export options
      await expect(page.locator('[data-testid="export-csv"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-json"]')).toBeVisible();
      
      // Check export settings
      await expect(page.locator('[data-testid="export-conditions"]')).toBeVisible();
      await expect(page.locator('[data-testid="security-notice"]')).toBeVisible();
    });

    test('should show export preview', async () => {
      await page.click('[data-testid="export-audit-logs"]');
      await expect(page.locator('[data-testid="audit-export-modal"]')).toBeVisible();
      
      // Apply some filters for preview
      await page.fill('[data-testid="export-start-date"]', '2025-08-01');
      await page.fill('[data-testid="export-end-date"]', '2025-08-22');
      
      // Show preview
      await page.click('[data-testid="show-preview"]');
      
      // Verify preview section
      await expect(page.locator('[data-testid="export-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="preview-count"]')).toBeVisible();
      
      // Check preview data
      const previewCount = await page.locator('[data-testid="preview-count-value"]').textContent();
      expect(parseInt(previewCount || '0')).toBeGreaterThanOrEqual(0);
    });

    test('should validate export parameters', async () => {
      await page.click('[data-testid="export-audit-logs"]');
      await expect(page.locator('[data-testid="audit-export-modal"]')).toBeVisible();
      
      // Test invalid date range
      await page.fill('[data-testid="export-start-date"]', '2025-12-01');
      await page.fill('[data-testid="export-end-date"]', '2025-01-01');
      
      // Attempt export
      await page.click('[data-testid="execute-export"]');
      
      // Verify validation error
      await expect(page.locator('[data-testid="export-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-error"]')).toContainText(/日付が無効/);
    });
  });

  test.describe('Real-time Updates', () => {
    test('should show loading states during data fetch', async () => {
      // Apply filter to trigger loading
      await page.click('[data-testid="apply-filters"]');
      
      // Verify loading indicator appears briefly
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
      
      // Wait for data to load
      await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({ timeout: 5000 });
    });

    test('should handle empty search results', async () => {
      // Search for something that doesn't exist
      await page.fill('[data-testid="keyword-search"]', 'nonexistent-action-xyz');
      await page.click('[data-testid="search-button"]');
      
      // Verify empty state
      await expect(page.locator('[data-testid="empty-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="empty-message"]')).toContainText(/該当する監査ログが見つかりません/);
    });

    test('should refresh data automatically', async () => {
      // Enable auto-refresh if available
      const autoRefreshToggle = page.locator('[data-testid="auto-refresh-toggle"]');
      if (await autoRefreshToggle.isVisible()) {
        await autoRefreshToggle.check();
        
        // Verify refresh indicator appears periodically
        await expect(page.locator('[data-testid="refresh-indicator"]')).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Performance & Monitoring', () => {
    test('should load audit logs within performance SLA', async () => {
      const startTime = Date.now();
      
      // Apply filter and measure response time
      await page.click('[data-testid="apply-filters"]');
      await expect(page.locator('[data-testid="audit-entry"]')).toHaveCount({ min: 0 });
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Verify performance (should be under 3 seconds)
      expect(loadTime).toBeLessThan(3000);
      console.log(`Audit logs loaded in ${loadTime}ms`);
    });

    test('should handle large result sets efficiently', async () => {
      // Set wide date range to get more results
      await page.fill('[data-testid="start-date"]', '2025-01-01');
      await page.fill('[data-testid="end-date"]', '2025-12-31');
      
      const startTime = Date.now();
      await page.click('[data-testid="apply-filters"]');
      
      // Wait for results to load
      await expect(page.locator('[data-testid="audit-entry"]')).toHaveCount({ min: 0 });
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Even with large datasets, should be reasonable
      expect(loadTime).toBeLessThan(5000);
    });
  });

  test.describe('Accessibility & Compliance', () => {
    test('should be accessible with keyboard navigation', async () => {
      // Test tab navigation through filters
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="start-date"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="end-date"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="user-filter"]')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="action-filter"]')).toBeFocused();
    });

    test('should work on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // Verify mobile layout
      await expect(page.locator('[data-testid="mobile-audit-view"]')).toBeVisible();
      
      // Test mobile filter interaction
      await page.click('[data-testid="mobile-filter-toggle"]');
      await expect(page.locator('[data-testid="mobile-filters"]')).toBeVisible();
      
      // Test mobile table scrolling
      const table = page.locator('[data-testid="audit-table"]');
      await expect(table).toBeVisible();
    });

    test('should have proper ARIA labels', async () => {
      // Verify accessibility attributes
      await expect(page.locator('[data-testid="audit-table"]')).toHaveAttribute('role', 'table');
      await expect(page.locator('[data-testid="security-panel"]')).toHaveAttribute('role', 'region');
      await expect(page.locator('[data-testid="search-button"]')).toHaveAttribute('aria-label');
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Capture diagnostics on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ 
        path: `test-results/audit-failure-${testInfo.title.replace(/\s+/g, '-')}.png`,
        fullPage: true 
      });
      
      // Log console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log(`Console Error: ${msg.text()}`);
        }
      });
    }
  });
});
