import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display main title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
    await expect(page.getByText('外部指標×売上で意思決定を加速')).toBeVisible();
  });

  test('should display navigation cards', async ({ page }) => {
    // Check for navigation cards
    await expect(page.getByText('📊 ダッシュボード')).toBeVisible();
    await expect(page.getByText('💰 売上入力')).toBeVisible();
    await expect(page.getByText('📤 エクスポート')).toBeVisible();
    
    // Check descriptions
    await expect(page.getByText('KPI・外部指標・売上データの統合表示')).toBeVisible();
    await expect(page.getByText('店舗別売上データの入力・管理')).toBeVisible();
    await expect(page.getByText('CSV・Excel形式でのデータ出力')).toBeVisible();
  });

  test('should have functional navigation links', async ({ page }) => {
    // Test dashboard link
    await page.getByRole('link', { name: /ダッシュボード/ }).click();
    await expect(page).toHaveURL('/dashboard');
    
    // Go back to home
    await page.goto('/');
    
    // Test other links (these will 404 for now, but should navigate)
    await page.getByRole('link', { name: /売上入力/ }).click();
    await expect(page).toHaveURL('/sales');
  });

  test('should display action buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ドキュメント' })).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
    
    // Cards should stack vertically on mobile
    const cards = page.locator('.card');
    await expect(cards).toHaveCount(3);
    
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { name: '経営戦略ダッシュボード' })).toBeVisible();
  });

  test('should have proper performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds as per PRD requirements
    expect(loadTime).toBeLessThan(3000);
  });
});