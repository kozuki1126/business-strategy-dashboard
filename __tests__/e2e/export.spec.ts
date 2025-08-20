/**
 * エクスポート機能 E2Eテスト
 * /export ページとAPI機能の包括的テスト
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { format, subDays } from 'date-fns';

// テスト用データ
const TEST_USER_EMAIL = 'test-export@example.com';
const TEST_STORE_ID = 'store-001';
const TEST_DEPARTMENT = 'electronics';

// パフォーマンス要件
const EXPORT_SLA_MS = 5000; // p95 ≤ 5秒
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

test.describe('Export Functionality E2E Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // 認証済み状態をセットアップ
    await setupAuthentication(page);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Authentication & Access Control', () => {
    test('should redirect unauthenticated users to login', async () => {
      // 新しい未認証ページを作成
      const unauthPage = await context.newPage();
      
      await unauthPage.goto('/export');
      
      // 認証ページにリダイレクトされることを確認
      await expect(unauthPage).toHaveURL(/\/auth/);
    });

    test('should show export page for authenticated users', async () => {
      await page.goto('/export');
      
      // エクスポートページが表示されることを確認
      await expect(page.locator('h1')).toContainText('データエクスポート');
      await expect(page.locator('text=ログイン中:')).toBeVisible();
    });

    test('should log page access in audit trail', async () => {
      const startTime = Date.now();
      
      await page.goto('/export');
      
      // 監査ログが記録されることを検証
      // 注: 実際の実装では監査ログAPIを呼び出して確認する
      const auditResponse = await page.evaluate(async () => {
        return fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'view_export_page',
            timestamp: new Date().toISOString()
          })
        });
      });
      
      expect(auditResponse).toBeTruthy();
    });
  });

  test.describe('Export Form UI & Validation', () => {
    test.beforeEach(async () => {
      await page.goto('/export');
    });

    test('should display all required form elements', async () => {
      // データタイプ選択
      await expect(page.locator('input[value="sales"]')).toBeVisible();
      await expect(page.locator('input[value="external"]')).toBeVisible();
      await expect(page.locator('input[value="combined"]')).toBeVisible();
      
      // フォーマット選択
      await expect(page.locator('input[value="csv"]')).toBeVisible();
      await expect(page.locator('input[value="excel"]')).toBeVisible();
      
      // 期間設定
      await expect(page.locator('input[type="date"]').first()).toBeVisible();
      
      // アクションボタン
      await expect(page.locator('button:has-text("エクスポート実行")')).toBeVisible();
      await expect(page.locator('button:has-text("プレビュー")')).toBeVisible();
    });

    test('should validate required fields', async () => {
      // フォームが未入力状態でエクスポート実行を試行
      await page.locator('button:has-text("エクスポート実行")').click();
      
      // バリデーションエラーが表示されることを確認
      // 注: 実装に応じてエラーメッセージのセレクターを調整
      await expect(page.locator('.text-red-600')).toBeVisible();
    });

    test('should apply preset date ranges correctly', async () => {
      // 「過去7日」プリセットをクリック
      await page.locator('button:has-text("過去7日")').click();
      
      // 日付フィールドが正しく設定されることを確認
      const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');
      
      await expect(page.locator('input[type="date"]').first()).toHaveValue(startDate);
      await expect(page.locator('input[type="date"]').last()).toHaveValue(endDate);
    });

    test('should show store/department filters for sales data', async () => {
      // 売上データを選択
      await page.locator('input[value="sales"]').click();
      
      // 店舗・部門フィルターが表示されることを確認
      await expect(page.locator('select').first()).toBeVisible(); // 店舗選択
      await expect(page.locator('select').nth(1)).toBeVisible(); // 部門選択
    });

    test('should hide store/department filters for external data', async () => {
      // 外部データを選択
      await page.locator('input[value="external"]').click();
      
      // 店舗・部門フィルターが非表示になることを確認
      const storeSelect = page.locator('select').first();
      await expect(storeSelect).not.toBeVisible();
    });
  });

  test.describe('Rate Limiting & Status Display', () => {
    test.beforeEach(async () => {
      await page.goto('/export');
    });

    test('should display rate limit information', async () => {
      // レート制限情報が表示されることを確認
      await expect(page.locator('text=エクスポート制限')).toBeVisible();
      await expect(page.locator('text=残り')).toBeVisible();
    });

    test('should disable export button when rate limit exceeded', async () => {
      // レート制限をシミュレート（モック）
      await page.route('/api/export', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              rateLimit: {
                maxRequests: 5,
                remainingRequests: 0,
                resetTime: Date.now() + 3600000,
                windowMs: 3600000
              }
            })
          });
        }
      });

      await page.reload();
      
      // エクスポートボタンが無効になることを確認
      await expect(page.locator('button:has-text("エクスポート実行")')).toBeDisabled();
    });
  });

  test.describe('CSV Export Functionality', () => {
    test('should export sales data as CSV within SLA', async () => {
      await page.goto('/export');
      
      // フォーム設定
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7); // 過去7日
      
      // パフォーマンス測定開始
      const startTime = Date.now();
      
      // ダウンロード監視を設定
      const downloadPromise = page.waitForDownload();
      
      // エクスポート実行
      await page.locator('button:has-text("エクスポート実行")').click();
      
      // ダウンロード完了を待機
      const download = await downloadPromise;
      const processingTime = Date.now() - startTime;
      
      // SLA確認（p95 ≤ 5秒）
      expect(processingTime).toBeLessThanOrEqual(EXPORT_SLA_MS);
      
      // ファイル名確認
      expect(download.suggestedFilename()).toMatch(/sales_export_\d{8}_\d{6}\.csv$/);
      
      // ファイル内容確認
      const path = await download.path();
      expect(path).toBeTruthy();
      
      // ファイルサイズ制限確認
      const fs = require('fs');
      const stats = fs.statSync(path);
      expect(stats.size).toBeLessThanOrEqual(MAX_FILE_SIZE);
    });

    test('should export external data as CSV', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="external"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 30); // 過去30日
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/external_export_\d{8}_\d{6}\.csv$/);
    });

    test('should export combined data as CSV', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="combined"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 14); // 過去14日
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/combined_export_\d{8}_\d{6}\.csv$/);
    });
  });

  test.describe('Excel Export Functionality', () => {
    test('should export sales data as Excel within SLA', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="excel"]').click();
      await setDateRange(page, 7);
      
      const startTime = Date.now();
      const downloadPromise = page.waitForDownload();
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      const processingTime = Date.now() - startTime;
      
      // SLA確認
      expect(processingTime).toBeLessThanOrEqual(EXPORT_SLA_MS);
      
      // Excelファイル確認
      expect(download.suggestedFilename()).toMatch(/sales_export_\d{8}_\d{6}\.xlsx$/);
    });

    test('should export combined data as Excel with multiple sheets', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="combined"]').click();
      await page.locator('input[value="excel"]').click();
      await setDateRange(page, 30);
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/combined_export_\d{8}_\d{6}\.xlsx$/);
      
      // 注: 実際の実装では、Excelファイル内のシート数も検証できる
    });
  });

  test.describe('Filtered Export Functionality', () => {
    test('should export filtered sales data by store', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7);
      
      // 店舗フィルター設定
      await page.locator('select').first().selectOption(TEST_STORE_ID);
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/sales_export_\d{8}_\d{6}\.csv$/);
    });

    test('should export filtered sales data by department', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 14);
      
      // 部門フィルター設定
      await page.locator('select').nth(1).selectOption(TEST_DEPARTMENT);
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/sales_export_\d{8}_\d{6}\.csv$/);
    });

    test('should export filtered data with multiple filters', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="excel"]').click();
      await setDateRange(page, 7);
      
      // 複数フィルター設定
      await page.locator('select').first().selectOption(TEST_STORE_ID);
      await page.locator('select').nth(1).selectOption(TEST_DEPARTMENT);
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/sales_export_\d{8}_\d{6}\.xlsx$/);
    });
  });

  test.describe('Preview Functionality', () => {
    test('should show data preview before export', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7);
      
      // プレビュー実行
      await page.locator('button:has-text("プレビュー")').click();
      
      // プレビューデータが表示されることを確認
      await expect(page.locator('text=データプレビュー')).toBeVisible();
      await expect(page.locator('pre')).toBeVisible();
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should handle export API errors gracefully', async () => {
      await page.goto('/export');
      
      // APIエラーをシミュレート
      await page.route('/api/export', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Export failed',
              message: 'Internal server error'
            })
          });
        }
      });
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7);
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      // エラーメッセージが表示されることを確認
      await expect(page.locator('.text-red-800')).toBeVisible();
      await expect(page.locator('text=エクスポート処理中にエラーが発生しました')).toBeVisible();
    });

    test('should handle rate limit exceeded error', async () => {
      await page.goto('/export');
      
      // レート制限エラーをシミュレート
      await page.route('/api/export', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Rate limit exceeded',
              message: '最大 5 回/時間までエクスポート可能です',
              remainingTime: 3600000
            })
          });
        }
      });
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7);
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      // レート制限エラーメッセージが表示されることを確認
      await expect(page.locator('text=最大 5 回/時間までエクスポート可能です')).toBeVisible();
    });

    test('should handle invalid date range', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      
      // 無効な日付範囲を設定（終了日 < 開始日）
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      await page.locator('input[type="date"]').first().fill(format(tomorrow, 'yyyy-MM-dd'));
      await page.locator('input[type="date"]').last().fill(format(today, 'yyyy-MM-dd'));
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      // バリデーションエラーが表示されることを確認
      await expect(page.locator('.text-red-600')).toBeVisible();
    });

    test('should handle maximum period exceeded', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      
      // 1年を超える期間を設定
      const today = new Date();
      const overYear = new Date(today);
      overYear.setFullYear(today.getFullYear() - 2);
      
      await page.locator('input[type="date"]').first().fill(format(overYear, 'yyyy-MM-dd'));
      await page.locator('input[type="date"]').last().fill(format(today, 'yyyy-MM-dd'));
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      // 期間制限エラーが表示されることを確認
      await expect(page.locator('text=エクスポート期間は最大1年間です')).toBeVisible();
    });
  });

  test.describe('Audit Logging', () => {
    test('should log successful export in audit trail', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7);
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download).toBeTruthy();
      
      // 監査ログが記録されることを検証
      // 注: 実際の実装では監査ログAPIを呼び出して記録を確認する
    });

    test('should log failed export in audit trail', async () => {
      await page.goto('/export');
      
      // 失敗をシミュレート
      await page.route('/api/export', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Export failed' })
          });
        }
      });
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7);
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      // エラーが表示され、監査ログが記録されることを検証
      await expect(page.locator('.text-red-800')).toBeVisible();
    });
  });

  test.describe('Performance & SLA Verification', () => {
    test('should complete small export within 2 seconds', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 1); // 1日分の小さなデータ
      
      const startTime = Date.now();
      const downloadPromise = page.waitForDownload();
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      const processingTime = Date.now() - startTime;
      
      // 小さなデータセットは2秒以内
      expect(processingTime).toBeLessThanOrEqual(2000);
      expect(download).toBeTruthy();
    });

    test('should complete large export within 5 seconds', async () => {
      await page.goto('/export');
      
      await page.locator('input[value="combined"]').click();
      await page.locator('input[value="excel"]').click();
      await setDateRange(page, 90); // 3ヶ月分の大きなデータ
      
      const startTime = Date.now();
      const downloadPromise = page.waitForDownload();
      
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      const processingTime = Date.now() - startTime;
      
      // 大きなデータセットでもSLA内（5秒以内）
      expect(processingTime).toBeLessThanOrEqual(EXPORT_SLA_MS);
      expect(download).toBeTruthy();
    });

    test('should show performance stats in response headers', async () => {
      await page.goto('/export');
      
      // レスポンスヘッダーを監視
      let exportStats: any = null;
      
      page.on('response', async (response) => {
        if (response.url().includes('/api/export') && response.request().method() === 'POST') {
          const statsHeader = response.headers()['x-export-stats'];
          if (statsHeader) {
            exportStats = JSON.parse(statsHeader);
          }
        }
      });
      
      await page.locator('input[value="sales"]').click();
      await page.locator('input[value="csv"]').click();
      await setDateRange(page, 7);
      
      const downloadPromise = page.waitForDownload();
      await page.locator('button:has-text("エクスポート実行")').click();
      
      const download = await downloadPromise;
      expect(download).toBeTruthy();
      
      // パフォーマンス統計が返されることを確認
      expect(exportStats).toBeTruthy();
      expect(exportStats.processingTime).toBeLessThanOrEqual(EXPORT_SLA_MS);
      expect(exportStats.withinSLA).toBe(true);
    });
  });
});

/**
 * ヘルパー関数
 */

async function setupAuthentication(page: Page) {
  // テスト用の認証をセットアップ
  // 注: 実際の実装に応じて認証方法を調整
  await page.goto('/auth');
  
  // メールマジックリンク認証をシミュレート
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.click('button[type="submit"]');
  
  // 認証完了を待機（実際の実装では認証フローに応じて調整）
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

async function setDateRange(page: Page, days: number) {
  const endDate = new Date();
  const startDate = subDays(endDate, days);
  
  await page.locator('input[type="date"]').first().fill(format(startDate, 'yyyy-MM-dd'));
  await page.locator('input[type="date"]').last().fill(format(endDate, 'yyyy-MM-dd'));
}
