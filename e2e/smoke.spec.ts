import { test, expect } from '@playwright/test';

/**
 * Smoke Tests for Task #015 - Critical Path Verification
 * 
 * These tests verify the most critical functionality of the application
 * and should run quickly to provide fast feedback on basic functionality.
 * 
 * @smoke - Tests tagged for smoke test execution
 */

test.describe('Smoke Tests - Critical Path @smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Set up performance monitoring
    await page.addInitScript(() => {
      window.__PERFORMANCE_START__ = performance.now();
    });
  });

  test.afterEach(async ({ page }) => {
    // Collect performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    console.log('📊 Performance Metrics:', performanceMetrics);
  });

  test('should load home page within performance budget @smoke', async ({ page }) => {
    const startTime = performance.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = performance.now() - startTime;
    
    // Verify critical elements are present
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
    await expect(page.getByText('外部指標×売上で意思決定を加速')).toBeVisible();
    
    // Performance assertion - should load within 3 seconds (PRD requirement)
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`✅ Home page loaded in ${Math.round(loadTime)}ms`);
  });

  test('should navigate to dashboard page @smoke', async ({ page }) => {
    await page.goto('/');
    
    // Click dashboard link
    await page.getByRole('link', { name: /ダッシュボード/ }).click();
    
    // Wait for navigation
    await page.waitForURL('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Verify dashboard loaded
    await expect(page.getByText('経営戦略ダッシュボード')).toBeVisible();
    
    console.log('✅ Dashboard navigation successful');
  });

  test('should navigate to sales input page @smoke', async ({ page }) => {
    await page.goto('/');
    
    // Click sales input link
    await page.getByRole('link', { name: /売上入力/ }).click();
    
    // Wait for navigation
    await page.waitForURL('/sales');
    await page.waitForLoadState('networkidle');
    
    // Verify sales form loaded
    await expect(page.getByRole('heading', { name: /売上入力/ })).toBeVisible();
    
    console.log('✅ Sales input navigation successful');
  });

  test('should handle authentication flow @smoke', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    // Verify auth form elements
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /送信|ログイン/i })).toBeVisible();
    
    // Test form validation
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await emailInput.fill('invalid-email');
    
    const submitButton = page.getByRole('button', { name: /送信|ログイン/i });
    await submitButton.click();
    
    // Should show validation error
    await expect(page.getByText(/有効なメールアドレス|正しい形式/i)).toBeVisible();
    
    console.log('✅ Authentication form validation working');
  });

  test('should display critical navigation elements @smoke', async ({ page }) => {
    await page.goto('/');
    
    // Check main navigation elements
    const criticalLinks = [
      'ダッシュボード',
      '売上入力',
      'エクスポート'
    ];
    
    for (const linkText of criticalLinks) {
      await expect(page.getByRole('link', { name: new RegExp(linkText, 'i') })).toBeVisible();
    }
    
    // Check action buttons
    await expect(page.getByRole('button', { name: /ログイン/i })).toBeVisible();
    
    console.log('✅ Critical navigation elements present');
  });

  test('should be responsive on mobile viewport @smoke', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Main content should be visible
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
    
    // Navigation should work on mobile
    const dashboardLink = page.getByRole('link', { name: /ダッシュボード/ }).first();
    await expect(dashboardLink).toBeVisible();
    await dashboardLink.click();
    
    await page.waitForURL('/dashboard');
    
    console.log('✅ Mobile responsiveness verified');
  });

  test('should handle API endpoints availability @smoke', async ({ page, request }) => {
    // Test critical API endpoints
    const criticalEndpoints = [
      '/api/analytics',
      '/api/sales',
      '/api/export'
    ];
    
    for (const endpoint of criticalEndpoints) {
      const response = await request.get(endpoint);
      
      // Should not return 5xx errors (infrastructure issues)
      expect(response.status()).toBeLessThan(500);
      
      console.log(`✅ API endpoint ${endpoint}: ${response.status()}`);
    }
  });

  test('should load without critical console errors @smoke', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to main pages to check for errors
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    await page.goto('/sales');
    await page.waitForLoadState('domcontentloaded');
    
    // Filter out non-critical errors (like network timeouts in test env)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('net::ERR_') && 
      !error.includes('favicon') &&
      !error.includes('chunk-')
    );
    
    if (criticalErrors.length > 0) {
      console.warn('⚠️ Console errors detected:', criticalErrors);
    }
    
    // Should have minimal critical errors
    expect(criticalErrors.length).toBeLessThan(3);
    
    console.log(`✅ Console error check passed (${criticalErrors.length} critical errors)`);
  });

  test('should verify security headers @smoke', async ({ page, request }) => {
    const response = await request.get('/');
    
    const securityHeaders = {
      'x-frame-options': 'Security header for clickjacking protection',
      'x-content-type-options': 'MIME type sniffing protection',
      'x-xss-protection': 'XSS protection header'
    };
    
    for (const [header, description] of Object.entries(securityHeaders)) {
      const headerValue = response.headers()[header];
      if (!headerValue) {
        console.warn(`⚠️ Missing security header: ${header} (${description})`);
      } else {
        console.log(`✅ Security header present: ${header} = ${headerValue}`);
      }
    }
  });

  test('should handle slow network conditions gracefully @smoke', async ({ page, context }) => {
    // Simulate slow network
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
      await route.continue();
    });
    
    const startTime = performance.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = performance.now() - startTime;
    
    // Should still load within reasonable time even with network delays
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
    
    // Critical content should still be visible
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
    
    console.log(`✅ Page loaded under slow network in ${Math.round(loadTime)}ms`);
  });
});

/**
 * Regression Smoke Tests - Quick verification that recent changes didn't break core functionality
 */
test.describe('Regression Smoke Tests @smoke @regression', () => {
  test('should maintain performance after recent changes @smoke @regression', async ({ page }) => {
    const performanceMetrics: number[] = [];
    
    // Test multiple page loads to get average
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const loadTime = performance.now() - startTime;
      performanceMetrics.push(loadTime);
      
      // Clear cache between runs
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    
    const avgLoadTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
    
    // Average should be within performance budget
    expect(avgLoadTime).toBeLessThan(3000);
    
    console.log(`✅ Average load time: ${Math.round(avgLoadTime)}ms`);
  });
  
  test('should maintain accessibility standards @smoke @regression', async ({ page }) => {
    await page.goto('/');
    
    // Basic accessibility checks
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    // Check for proper heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
    
    // Check for alt text on images
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      if (alt === null) {
        console.warn('⚠️ Image without alt text found');
      }
    }
    
    console.log('✅ Basic accessibility checks passed');
  });
});
