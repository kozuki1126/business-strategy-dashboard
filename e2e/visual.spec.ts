import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Task #015
 * 
 * These tests capture screenshots and compare them against baseline images
 * to detect unintended visual changes in the UI.
 */

test.describe('Visual Regression Tests @visual', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addInitScript(() => {
      document.documentElement.style.setProperty('--animation-duration-scale', '0');
      document.documentElement.style.setProperty('--transition-duration', '0s');
    });

    // Add CSS to disable all animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          scroll-behavior: auto !important;
        }
      `
    });
  });

  test('should match home page visual baseline @visual', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for fonts to load
    await page.waitForFunction(() => document.fonts.ready);
    
    // Hide dynamic content that changes frequently
    await page.addStyleTag({
      content: `
        [data-testid="current-time"],
        .timestamp,
        .dynamic-data {
          opacity: 0 !important;
        }
      `
    });

    // Take full page screenshot
    await expect(page).toHaveScreenshot('home-page-full.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Take viewport screenshot
    await expect(page).toHaveScreenshot('home-page-viewport.png', {
      animations: 'disabled'
    });
  });

  test('should match dashboard page visual baseline @visual', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    // Wait for charts to render
    await page.waitForSelector('[data-testid="sales-chart"]', { state: 'visible', timeout: 10000 }).catch(() => {
      console.log('Sales chart not found, continuing with screenshot');
    });

    // Hide dynamic elements
    await page.addStyleTag({
      content: `
        [data-testid="last-updated"],
        .realtime-data,
        .chart-tooltip,
        .loading-spinner {
          opacity: 0 !important;
        }
      `
    });

    // Take screenshot of main dashboard
    await expect(page).toHaveScreenshot('dashboard-main.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Take screenshot of KPI cards section
    const kpiSection = page.locator('[data-testid="kpi-cards"], .kpi-section').first();
    if (await kpiSection.isVisible()) {
      await expect(kpiSection).toHaveScreenshot('dashboard-kpi-cards.png', {
        animations: 'disabled'
      });
    }

    // Take screenshot of charts section
    const chartsSection = page.locator('[data-testid="charts-section"], .charts-container').first();
    if (await chartsSection.isVisible()) {
      await expect(chartsSection).toHaveScreenshot('dashboard-charts.png', {
        animations: 'disabled'
      });
    }
  });

  test('should match sales form visual baseline @visual', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    // Hide dynamic elements
    await page.addStyleTag({
      content: `
        [data-testid="current-date"],
        .auto-generated-id {
          opacity: 0 !important;
        }
      `
    });

    // Take full form screenshot
    await expect(page).toHaveScreenshot('sales-form-full.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Fill form to test different states
    const form = page.locator('form').first();
    if (await form.isVisible()) {
      // Fill some fields
      await page.getByLabel(/日付|date/i).first().fill('2025-08-23');
      await page.getByLabel(/店舗|store/i).first().selectOption({ index: 1 }).catch(() => {});
      await page.getByLabel(/売上|revenue/i).first().fill('150000');

      await expect(page).toHaveScreenshot('sales-form-filled.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('should match authentication page visual baseline @visual', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    // Take screenshot of auth form
    await expect(page).toHaveScreenshot('auth-form.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Test error state
    const emailInput = page.getByLabel(/email/i).first();
    const submitButton = page.getByRole('button', { name: /送信|ログイン/i });
    
    if (await emailInput.isVisible() && await submitButton.isVisible()) {
      await emailInput.fill('invalid-email');
      await submitButton.click();
      
      // Wait for error message
      await page.waitForSelector('.error-message, [role="alert"]', { timeout: 5000 }).catch(() => {});
      
      await expect(page).toHaveScreenshot('auth-form-error.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }
  });

  test('should match export page visual baseline @visual', async ({ page }) => {
    await page.goto('/export');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    // Take screenshot of export form
    await expect(page).toHaveScreenshot('export-form.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should match mobile responsive layouts @visual', async ({ page }) => {
    // Test iPhone 12 viewport
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('mobile-home.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Test dashboard on mobile
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('mobile-dashboard.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should match tablet responsive layouts @visual', async ({ page }) => {
    // Test iPad viewport
    await page.setViewportSize({ width: 820, height: 1180 });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('tablet-home.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Test dashboard on tablet
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('tablet-dashboard.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should match dark mode visual baseline @visual', async ({ page }) => {
    // Enable dark mode if available
    await page.emulateMedia({ colorScheme: 'dark' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    // Add dark mode if the app supports it
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    });

    await expect(page).toHaveScreenshot('dark-mode-home.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should match high contrast visual baseline @visual', async ({ page }) => {
    // Enable high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('high-contrast-home.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should match component states visually @visual', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Test loading states
    await page.route('**/api/analytics', route => route.abort());
    
    await page.reload();
    await page.waitForTimeout(1000); // Wait for loading states to appear

    await expect(page).toHaveScreenshot('dashboard-loading-states.png', {
      animations: 'disabled'
    });
  });

  test('should match error states visually @visual', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/**', route => 
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server Error' })
      })
    );

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for error states to appear

    await expect(page).toHaveScreenshot('dashboard-error-states.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('should match print layout @visual', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Emulate print media
    await page.emulateMedia({ media: 'print' });
    await page.waitForFunction(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('dashboard-print.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});

/**
 * Cross-browser Visual Regression Tests
 */
test.describe('Cross-browser Visual Tests @visual @cross-browser', () => {
  test('should maintain visual consistency across browsers @visual', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.fonts.ready);

    // Browser-specific screenshot
    await expect(page).toHaveScreenshot(`home-${browserName}.png`, {
      animations: 'disabled'
    });
  });

  test('should maintain dashboard visual consistency across browsers @visual', async ({ page, browserName }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for charts to load
    await page.waitForTimeout(3000);

    // Browser-specific dashboard screenshot
    await expect(page).toHaveScreenshot(`dashboard-${browserName}.png`, {
      fullPage: true,
      animations: 'disabled'
    });
  });
});

/**
 * Accessibility Visual Tests
 */
test.describe('Accessibility Visual Tests @visual @a11y', () => {
  test('should maintain focus indicators visually @visual', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Focus on first interactive element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500); // Wait for focus styles

    await expect(page).toHaveScreenshot('focus-indicators.png', {
      animations: 'disabled'
    });
  });

  test('should show proper keyboard navigation highlights @visual', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate with keyboard
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
    }

    await expect(page).toHaveScreenshot('keyboard-navigation.png', {
      animations: 'disabled'
    });
  });
});
