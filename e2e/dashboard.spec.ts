import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display dashboard title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
  });

  test('should display KPI cards', async ({ page }) => {
    // Check for KPI cards
    await expect(page.getByText('売上（税抜）')).toBeVisible();
    await expect(page.getByText('客数')).toBeVisible();
    await expect(page.getByText('客単価')).toBeVisible();
    
    // Check for values
    await expect(page.getByText('¥12,345,678')).toBeVisible();
    await expect(page.getByText('8,742')).toBeVisible();
    await expect(page.getByText('¥1,413')).toBeVisible();
  });

  test('should have functional filters', async ({ page }) => {
    // Test period filter
    const periodSelect = page.locator('#period');
    await expect(periodSelect).toBeVisible();
    await periodSelect.selectOption('last-month');
    await expect(periodSelect).toHaveValue('last-month');
    
    // Test store filter
    const storeSelect = page.locator('#store');
    await expect(storeSelect).toBeVisible();
    await storeSelect.selectOption('store-1');
    await expect(storeSelect).toHaveValue('store-1');
  });

  test('should display chart placeholders', async ({ page }) => {
    await expect(page.getByText('売上推移')).toBeVisible();
    await expect(page.getByText('外部指標')).toBeVisible();
    await expect(page.getByText('グラフエリア（Recharts実装予定）')).toBeVisible();
  });

  test('should display external indicators', async ({ page }) => {
    await expect(page.getByText('USD/JPY')).toBeVisible();
    await expect(page.getByText('¥150.25')).toBeVisible();
    await expect(page.getByText('日経225')).toBeVisible();
    await expect(page.getByText('33,425.50')).toBeVisible();
    await expect(page.getByText('天候')).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
    
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
  });

  test('should have proper performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds as per PRD requirements
    expect(loadTime).toBeLessThan(3000);
  });
});