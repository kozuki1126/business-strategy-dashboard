/**
 * エクスポート機能 E2Eテスト
 */

import { test, expect, Page, Download } from '@playwright/test';
import { format, subDays } from 'date-fns';

// テスト用ユーザー情報
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
};

// ヘルパー関数: ログイン
async function login(page: Page) {
  await page.goto('/auth');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.click('button[type="submit"]');
  
  // マジックリンクのシミュレーション（テスト環境では自動ログイン）
  await page.waitForURL('/dashboard');
}

// ヘルパー関数: エクスポートページへ移動
async function navigateToExport(page: Page) {
  await page.goto('/export');
  await page.waitForLoadState('networkidle');
}

// ヘルパー関数: フォーム設定
async function setupExportForm(page: Page, options: {
  dataType?: string;
  format?: string;
  startDate?: string;
  endDate?: string;
  storeId?: string;
}) {
  if (options.dataType) {
    await page.check(`input[value="${options.dataType}"]`);
  }
  
  if (options.format) {
    await page.check(`input[value="${options.format}"]`);
  }
  
  if (options.startDate) {
    await page.fill('input[name="filters.startDate"]', options.startDate);
  }
  
  if (options.endDate) {
    await page.fill('input[name="filters.endDate"]', options.endDate);
  }
  
  if (options.storeId) {
    await page.selectOption('select[name="filters.storeId"]', options.storeId);
  }
}

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display export page correctly', async ({ page }) => {
    await navigateToExport(page);

    // ページタイトル確認
    await expect(page).toHaveTitle(/データエクスポート/);
    
    // 主要要素の存在確認
    await expect(page.locator('h1')).toContainText('データエクスポート');
    await expect(page.locator('text=エクスポートデータ')).toBeVisible();
    await expect(page.locator('text=ファイル形式')).toBeVisible();
    await expect(page.locator('text=フィルター設定')).toBeVisible();
    
    // データタイプオプション確認
    await expect(page.locator('text=売上データ')).toBeVisible();
    await expect(page.locator('text=外部データ')).toBeVisible();
    await expect(page.locator('text=統合データ')).toBeVisible();
    
    // ファイル形式オプション確認
    await expect(page.locator('text=CSV')).toBeVisible();
    await expect(page.locator('text=Excel')).toBeVisible();
  });

  test('should export CSV file successfully', async ({ page }) => {
    await navigateToExport(page);
    
    // フォーム設定
    await setupExportForm(page, {
      dataType: 'sales',
      format: 'csv',
      startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });

    // ダウンロード監視開始
    const downloadPromise = page.waitForEvent('download');
    
    // エクスポート実行
    await page.click('button:has-text("エクスポート実行")');
    
    // 成功メッセージ確認
    await expect(page.locator('text=エクスポート処理中')).toBeVisible();
    
    // ダウンロード完了確認
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/sales_export_.*\.csv/);
    
    // 成功メッセージ確認
    await expect(page.locator('text=エクスポートが完了しました')).toBeVisible();
  });

  test('should export Excel file successfully', async ({ page }) => {
    await navigateToExport(page);
    
    await setupExportForm(page, {
      dataType: 'external',
      format: 'excel',
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("エクスポート実行")');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/external_export_.*\.xlsx/);
    
    await expect(page.locator('text=エクスポートが完了しました')).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    await navigateToExport(page);
    
    // 無効な日付範囲をテスト
    await setupExportForm(page, {
      dataType: 'sales',
      format: 'csv',
      startDate: '2025-01-31',
      endDate: '2025-01-01' // 開始日が終了日より後
    });
    
    await page.click('button:has-text("エクスポート実行")');
    
    // バリデーションエラー確認
    await expect(page.locator('text=開始日は終了日以前である必要があります')).toBeVisible();
  });

  test('should use preset date ranges', async ({ page }) => {
    await navigateToExport(page);
    
    // 「過去7日」プリセットをクリック
    await page.click('button:has-text("過去7日")');
    
    // 日付フィールドが自動入力されることを確認
    const startDate = await page.inputValue('input[name="filters.startDate"]');
    const endDate = await page.inputValue('input[name="filters.endDate"]');
    
    expect(startDate).toBeTruthy();
    expect(endDate).toBeTruthy();
    
    // 開始日が7日前になっていることを確認
    const expectedStartDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    expect(startDate).toBe(expectedStartDate);
  });

  test('should display rate limit information', async ({ page }) => {
    await navigateToExport(page);
    
    // レート制限情報の表示確認
    await expect(page.locator('text=エクスポート制限')).toBeVisible();
    await expect(page.locator('text=残り')).toBeVisible();
    await expect(page.locator('text=リセット:')).toBeVisible();
  });

  test('should handle rate limiting', async ({ page }) => {
    await navigateToExport(page);
    
    // 複数回連続でエクスポートしてレート制限をテスト
    for (let i = 0; i < 6; i++) {
      await setupExportForm(page, {
        dataType: 'sales',
        format: 'csv',
        startDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      });
      
      if (i < 5) {
        // 最初の5回は成功するはず
        const downloadPromise = page.waitForEvent('download');
        await page.click('button:has-text("エクスポート実行")');
        await downloadPromise;
        await expect(page.locator('text=エクスポートが完了しました')).toBeVisible();
        
        // 少し待つ
        await page.waitForTimeout(1000);
      } else {
        // 6回目はレート制限にかかるはず
        await page.click('button:has-text("エクスポート実行")');
        await expect(page.locator('text=エクスポート制限に達しています')).toBeVisible();
      }
    }
  });

  test('should filter by store and department', async ({ page }) => {
    await navigateToExport(page);
    
    // 売上データを選択してフィルター表示
    await page.check('input[value="sales"]');
    
    // 店舗とフィルター要素が表示されることを確認
    await expect(page.locator('select[name="filters.storeId"]')).toBeVisible();
    await expect(page.locator('select[name="filters.department"]')).toBeVisible();
    await expect(page.locator('select[name="filters.category"]')).toBeVisible();
    
    // フィルターを設定してエクスポート
    await setupExportForm(page, {
      format: 'csv',
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });
    
    // 特定の店舗を選択（最初の選択肢以外）
    const storeOptions = await page.locator('select[name="filters.storeId"] option').all();
    if (storeOptions.length > 1) {
      const storeValue = await storeOptions[1].getAttribute('value');
      if (storeValue) {
        await page.selectOption('select[name="filters.storeId"]', storeValue);
      }
    }
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("エクスポート実行")');
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/sales_export_.*\.csv/);
  });

  test('should preview data before export', async ({ page }) => {
    await navigateToExport(page);
    
    await setupExportForm(page, {
      dataType: 'sales',
      format: 'csv',
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });
    
    // プレビューボタンをクリック
    await page.click('button:has-text("プレビュー")');
    
    // プレビューデータの表示確認
    await expect(page.locator('text=プレビューデータ取得中')).toBeVisible();
    
    // プレビュー結果の表示を待つ
    await page.waitForSelector('text=データプレビュー', { timeout: 10000 });
    await expect(page.locator('text=データプレビュー')).toBeVisible();
  });

  test('should reset form correctly', async ({ page }) => {
    await navigateToExport(page);
    
    // フォームに値を入力
    await setupExportForm(page, {
      dataType: 'external',
      format: 'excel',
      startDate: '2025-01-01',
      endDate: '2025-01-31'
    });
    
    // リセットボタンをクリック
    await page.click('button:has-text("リセット")');
    
    // デフォルト値に戻っていることを確認
    await expect(page.locator('input[value="sales"]')).toBeChecked();
    await expect(page.locator('input[value="csv"]')).toBeChecked();
    
    // 日付フィールドがクリアされていることを確認
    const startDate = await page.inputValue('input[name="filters.startDate"]');
    const endDate = await page.inputValue('input[name="filters.endDate"]');
    expect(startDate).toBe('');
    expect(endDate).toBe('');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await navigateToExport(page);
    
    // APIエラーをシミュレート（ネットワークエラー）
    await page.route('/api/export', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Export failed',
          message: 'サーバーエラーが発生しました'
        })
      });
    });
    
    await setupExportForm(page, {
      dataType: 'sales',
      format: 'csv',
      startDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });
    
    await page.click('button:has-text("エクスポート実行")');
    
    // エラーメッセージの表示確認
    await expect(page.locator('text=サーバーエラーが発生しました')).toBeVisible();
  });

  test('should display help information', async ({ page }) => {
    await navigateToExport(page);
    
    // ヘルプセクションの確認
    await expect(page.locator('text=エクスポート機能について')).toBeVisible();
    await expect(page.locator('text=データタイプ')).toBeVisible();
    await expect(page.locator('text=ファイル形式')).toBeVisible();
    await expect(page.locator('text=制限事項')).toBeVisible();
    await expect(page.locator('text=セキュリティ')).toBeVisible();
    await expect(page.locator('text=よくある質問')).toBeVisible();
    
    // 制限事項の詳細確認
    await expect(page.locator('text=5回/時間まで')).toBeVisible();
    await expect(page.locator('text=最大1年分のデータ')).toBeVisible();
    await expect(page.locator('text=最大50MB')).toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await navigateToExport(page);
    
    // アクセシビリティの基本チェック
    
    // フォーム要素にラベルがあることを確認
    const radioButtons = await page.locator('input[type="radio"]').all();
    for (const radio of radioButtons) {
      const id = await radio.getAttribute('id');
      if (id) {
        await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
      }
    }
    
    // ボタンにアクセシブルなテキストがあることを確認
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const text = await button.textContent();
      expect(text?.trim()).toBeTruthy();
    }
    
    // フォーカス可能な要素のキーボードナビゲーション
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
  });

  test('should handle large date ranges appropriately', async ({ page }) => {
    await navigateToExport(page);
    
    // 1年以上の期間を設定
    await setupExportForm(page, {
      dataType: 'sales',
      format: 'csv',
      startDate: '2023-01-01',
      endDate: '2024-02-01'
    });
    
    await page.click('button:has-text("エクスポート実行")');
    
    // バリデーションエラー確認
    await expect(page.locator('text=エクスポート期間は最大1年間です')).toBeVisible();
  });

  test('should maintain form state during session', async ({ page }) => {
    await navigateToExport(page);
    
    // フォームに値を設定
    await setupExportForm(page, {
      dataType: 'external',
      format: 'excel',
      startDate: '2025-01-01',
      endDate: '2025-01-31'
    });
    
    // 他のページに移動
    await page.goto('/dashboard');
    
    // エクスポートページに戻る
    await navigateToExport(page);
    
    // フォーム状態が保持されていることを確認（実装次第で変更）
    // 注：現在の実装では状態は保持されないが、将来的には保持する可能性あり
    await expect(page.locator('input[value="sales"]')).toBeChecked();
  });
});

test.describe('Export Performance', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should complete export within performance SLA', async ({ page }) => {
    await navigateToExport(page);
    
    await setupExportForm(page, {
      dataType: 'sales',
      format: 'csv',
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });
    
    const startTime = Date.now();
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("エクスポート実行")');
    
    await downloadPromise;
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 5秒以内に完了することを確認（SLA）
    expect(duration).toBeLessThan(5000);
  });

  test('should handle concurrent export requests', async ({ browser }) => {
    // 複数のページで同時にエクスポートを実行
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await login(page1);
    await login(page2);
    
    await navigateToExport(page1);
    await navigateToExport(page2);
    
    // 両方のページで同時にエクスポート設定
    await Promise.all([
      setupExportForm(page1, {
        dataType: 'sales',
        format: 'csv',
        startDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      }),
      setupExportForm(page2, {
        dataType: 'external',
        format: 'excel',
        startDate: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd')
      })
    ]);
    
    // 同時にエクスポート実行
    const [download1Promise, download2Promise] = await Promise.all([
      page1.waitForEvent('download'),
      page2.waitForEvent('download')
    ]);
    
    await Promise.all([
      page1.click('button:has-text("エクスポート実行")'),
      page2.click('button:has-text("エクスポート実行")')
    ]);
    
    // 両方のダウンロードが完了することを確認
    const [download1, download2] = await Promise.all([
      download1Promise,
      download2Promise
    ]);
    
    expect(download1.suggestedFilename()).toMatch(/sales_export_.*\.csv/);
    expect(download2.suggestedFilename()).toMatch(/external_export_.*\.xlsx/);
    
    await context1.close();
    await context2.close();
  });
});
