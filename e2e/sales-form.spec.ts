import { test, expect } from '@playwright/test';

test.describe('Sales Input Form', () => {
  test.beforeEach(async ({ page }) => {
    // 認証が必要な場合のセットアップ
    // 実際の環境では適切な認証フローに変更
    await page.goto('/auth');
    
    // テスト用のメールでログイン（環境に応じて調整）
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');
    
    // ログイン完了を待機
    await page.waitForURL('/dashboard');
    
    // 売上入力ページに移動
    await page.goto('/sales');
  });

  test('should display sales form correctly', async ({ page }) => {
    // ページタイトルの確認
    await expect(page).toHaveTitle(/売上入力/);
    
    // フォームヘッダーの確認
    await expect(page.locator('h2')).toContainText('売上入力');
    
    // 必須フィールドの存在確認
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible(); // 店舗選択
    await expect(page.locator('input[type="number"]').first()).toBeVisible(); // 税抜売上
    
    // ボタンの確認
    await expect(page.locator('button', { hasText: '売上を保存' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'キャンセル' })).toBeVisible();
  });

  test('should show validation errors for empty required fields', async ({ page }) => {
    // 空のフォームで送信を試行
    await page.click('button:has-text("売上を保存")');
    
    // バリデーションエラーメッセージの確認
    await expect(page.locator('text=店舗を選択してください')).toBeVisible();
    await expect(page.locator('text=部門を選択してください')).toBeVisible();
    await expect(page.locator('text=商品カテゴリを選択してください')).toBeVisible();
  });

  test('should successfully submit valid sales data', async ({ page }) => {
    // 日付入力
    await page.fill('input[type="date"]', '2025-08-19');
    
    // 店舗選択（実際のデータに応じて調整）
    await page.selectOption('select:nth-of-type(1)', { index: 1 });
    
    // 部門選択
    await page.selectOption('select:nth-of-type(2)', 'electronics');
    
    // 商品カテゴリ選択
    await page.selectOption('select:nth-of-type(3)', 'premium');
    
    // 税抜売上入力
    await page.fill('input[type="number"]:nth-of-type(1)', '100000');
    
    // オプション項目の入力
    await page.fill('input[type="number"]:nth-of-type(2)', '100'); // 客数
    await page.fill('input[type="number"]:nth-of-type(3)', '50');  // 取引数
    await page.fill('input[type="number"]:nth-of-type(4)', '5000'); // 割引額
    
    // 備考入力
    await page.fill('input[type="text"]:last-of-type', 'E2Eテストデータ');
    
    // フォーム送信
    await page.click('button:has-text("売上を保存")');
    
    // 成功時の動作確認（リダイレクトまたは成功メッセージ）
    await expect(page).toHaveURL(/dashboard/);
    
    // 売上データがダッシュボードに反映されていることを確認（可能な場合）
    await expect(page.locator('text=100,000')).toBeVisible({ timeout: 10000 });
  });

  test('should display calculations when revenue is entered', async ({ page }) => {
    // 売上金額を入力
    await page.fill('input[type="number"]:nth-of-type(1)', '100000');
    
    // 計算結果セクションが表示されることを確認
    await expect(page.locator('text=計算結果')).toBeVisible();
    
    // 計算結果を表示
    await page.click('button:has-text("表示")');
    
    // 税込売上の表示確認
    await expect(page.locator('text=税込売上')).toBeVisible();
    await expect(page.locator('text=￥110,000')).toBeVisible();
  });

  test('should calculate metrics correctly with full data', async ({ page }) => {
    // 完全なデータを入力
    await page.fill('input[type="number"]:nth-of-type(1)', '100000'); // 税抜売上
    await page.fill('input[type="number"]:nth-of-type(2)', '100');    // 客数
    await page.fill('input[type="number"]:nth-of-type(3)', '50');     // 取引数
    
    // 計算結果を表示
    await page.click('button:has-text("表示")');
    
    // 計算値の確認
    await expect(page.locator('text=客単価')).toBeVisible();
    await expect(page.locator('text=￥2,000')).toBeVisible(); // 100000 / 50
    
    await expect(page.locator('text=転換率')).toBeVisible();
    await expect(page.locator('text=50.0%')).toBeVisible(); // 50 / 100 * 100
  });

  test('should validate business logic constraints', async ({ page }) => {
    // 客数より多い取引数を入力
    await page.fill('input[type="number"]:nth-of-type(2)', '50');  // 客数
    await page.fill('input[type="number"]:nth-of-type(3)', '100'); // 取引数
    
    // フィールドからフォーカスを外す
    await page.click('h2'); // 他の要素をクリック
    
    // バリデーションエラーの確認
    await expect(page.locator('text=取引数は客数以下である必要があります')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // APIエラーをシミュレートするため、無効なデータでテスト
    // または、ネットワークを無効にしてテスト
    await page.route('/api/sales', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          success: false,
          message: 'Internal Server Error'
        })
      });
    });
    
    // 有効なデータを入力
    await page.fill('input[type="date"]', '2025-08-19');
    await page.selectOption('select:nth-of-type(1)', { index: 1 });
    await page.selectOption('select:nth-of-type(2)', 'electronics');
    await page.selectOption('select:nth-of-type(3)', 'premium');
    await page.fill('input[type="number"]:nth-of-type(1)', '100000');
    
    // フォーム送信
    await page.click('button:has-text("売上を保存")');
    
    // エラーメッセージの確認
    await expect(page.locator('text=Internal Server Error')).toBeVisible();
  });

  test('should maintain form state during interaction', async ({ page }) => {
    // データを入力
    await page.fill('input[type="date"]', '2025-08-19');
    await page.selectOption('select:nth-of-type(1)', { index: 1 });
    await page.fill('input[type="number"]:nth-of-type(1)', '100000');
    
    // 計算結果の表示/非表示を切り替え
    await page.click('button:has-text("表示")');
    await page.click('button:has-text("非表示")');
    
    // フォームデータが保持されていることを確認
    await expect(page.locator('input[type="date"]')).toHaveValue('2025-08-19');
    await expect(page.locator('input[type="number"]:nth-of-type(1)')).toHaveValue('100000');
  });

  test('should navigate correctly with cancel button', async ({ page }) => {
    // データを入力
    await page.fill('input[type="number"]:nth-of-type(1)', '50000');
    
    // キャンセルボタンをクリック
    await page.click('button:has-text("キャンセル")');
    
    // 前のページに戻ることを確認（実装に応じて調整）
    await expect(page).not.toHaveURL('/sales');
  });

  test('should be accessible with keyboard navigation', async ({ page }) => {
    // タブナビゲーションのテスト
    await page.keyboard.press('Tab'); // 日付フィールド
    await expect(page.locator('input[type="date"]')).toBeFocused();
    
    await page.keyboard.press('Tab'); // 店舗選択
    await expect(page.locator('select:nth-of-type(1)')).toBeFocused();
    
    await page.keyboard.press('Tab'); // 部門選択
    await expect(page.locator('select:nth-of-type(2)')).toBeFocused();
    
    // Enterキーでフォーム送信のテスト
    await page.fill('input[type="date"]', '2025-08-19');
    await page.selectOption('select:nth-of-type(1)', { index: 1 });
    await page.selectOption('select:nth-of-type(2)', 'electronics');
    await page.selectOption('select:nth-of-type(3)', 'premium');
    await page.fill('input[type="number"]:nth-of-type(1)', '100000');
    
    // 送信ボタンにフォーカスを移動してEnterで送信
    await page.locator('button:has-text("売上を保存")').focus();
    await page.keyboard.press('Enter');
    
    // 送信が実行されることを確認
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should handle concurrent submissions correctly', async ({ page }) => {
    // 有効なデータを入力
    await page.fill('input[type="date"]', '2025-08-19');
    await page.selectOption('select:nth-of-type(1)', { index: 1 });
    await page.selectOption('select:nth-of-type(2)', 'electronics');
    await page.selectOption('select:nth-of-type(3)', 'premium');
    await page.fill('input[type="number"]:nth-of-type(1)', '100000');
    
    // 送信ボタンを連続でクリック
    const submitButton = page.locator('button:has-text("売上を保存")');
    await Promise.all([
      submitButton.click(),
      submitButton.click(), // 2回目のクリック
    ]);
    
    // ボタンが無効化されることを確認
    await expect(submitButton).toBeDisabled();
    
    // 1回のみ送信されることを確認（実装に応じて調整）
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });
});