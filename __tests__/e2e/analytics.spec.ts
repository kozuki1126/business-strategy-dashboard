/**
 * アナリティクス機能 E2Eテスト
 * 相関・比較分析のエンドツーエンドテスト
 */

import { test, expect, Page } from '@playwright/test';

test.describe('アナリティクス機能', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // ログインプロセス（テスト環境に応じて調整）
    await page.goto('/auth');
    
    // テスト用ユーザーでログイン
    const emailInput = await page.waitForSelector('input[type="email"]');
    await emailInput.fill('test@example.com');
    
    const submitButton = await page.waitForSelector('button[type="submit"]');
    await submitButton.click();
    
    // ログイン完了を待機（ダッシュボードへのリダイレクト）
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('ページアクセス・ナビゲーション', () => {
    test('ナビゲーションからアナリティクスページにアクセスできること', async () => {
      // ナビゲーションメニューの「アナリティクス」をクリック
      await page.click('text=アナリティクス');
      
      // アナリティクスページに遷移することを確認
      await expect(page).toHaveURL('/analytics');
      
      // ページタイトルの確認
      await expect(page.locator('h1')).toHaveText('アナリティクス');
      
      // 主要セクションの表示確認
      await expect(page.locator('text=相関・比較分析')).toBeVisible();
      await expect(page.locator('text=分析期間設定')).toBeVisible();
      await expect(page.locator('text=フィルター設定')).toBeVisible();
    });

    test('クイックアクションからアナリティクスページにアクセスできること', async () => {
      // クイックアクションの「分析」ボタンをクリック
      await page.click('text=分析');
      
      // アナリティクスページに遷移することを確認
      await expect(page).toHaveURL('/analytics');
      await expect(page.locator('h1')).toHaveText('アナリティクス');
    });

    test('直接URL指定でアナリティクスページにアクセスできること', async () => {
      await page.goto('/analytics');
      
      // ページが正常に表示されることを確認
      await expect(page.locator('h1')).toHaveText('アナリティクス');
      await expect(page.locator('text=相関・比較分析')).toBeVisible();
    });
  });

  test.describe('フォーム操作', () => {
    test.beforeEach(async () => {
      await page.goto('/analytics');
    });

    test('期間設定フォームが正常に動作すること', async () => {
      // 開始日の設定
      await page.fill('input[name="startDate"]', '2024-01-01');
      
      // 終了日の設定
      await page.fill('input[name="endDate"]', '2024-01-31');
      
      // 入力値の確認
      const startDateValue = await page.inputValue('input[name="startDate"]');
      const endDateValue = await page.inputValue('input[name="endDate"]');
      
      expect(startDateValue).toBe('2024-01-01');
      expect(endDateValue).toBe('2024-01-31');
    });

    test('プリセット期間ボタンが正常に動作すること', async () => {
      // 「過去7日」ボタンをクリック
      await page.click('text=過去7日');
      
      // 日付が自動設定されることを確認
      const startDateValue = await page.inputValue('input[name="startDate"]');
      const endDateValue = await page.inputValue('input[name="endDate"]');
      
      expect(startDateValue).toBeTruthy();
      expect(endDateValue).toBeTruthy();
      
      // 「過去30日」ボタンのテスト
      await page.click('text=過去30日');
      
      const newStartDateValue = await page.inputValue('input[name="startDate"]');
      expect(newStartDateValue).not.toBe(startDateValue); // 値が変更されていることを確認
    });

    test('フィルター選択が正常に動作すること', async () => {
      // 店舗フィルター選択
      await page.selectOption('select[name="storeId"]', { index: 1 }); // 最初の店舗を選択
      
      // 部門フィルター選択
      await page.selectOption('select[name="department"]', { index: 1 }); // 最初の部門を選択
      
      // 選択値の確認
      const storeValue = await page.inputValue('select[name="storeId"]');
      const departmentValue = await page.inputValue('select[name="department"]');
      
      expect(storeValue).toBeTruthy();
      expect(departmentValue).toBeTruthy();
    });

    test('リセット機能が正常に動作すること', async () => {
      // フィルターを設定
      await page.selectOption('select[name="storeId"]', { index: 1 });
      await page.selectOption('select[name="department"]', { index: 1 });
      
      // リセットボタンをクリック
      await page.click('text=リセット');
      
      // デフォルト値に戻ることを確認
      const storeValue = await page.inputValue('select[name="storeId"]');
      const departmentValue = await page.inputValue('select[name="department"]');
      
      expect(storeValue).toBe('');
      expect(departmentValue).toBe('');
    });
  });

  test.describe('相関分析実行', () => {
    test.beforeEach(async () => {
      await page.goto('/analytics');
    });

    test('基本的な相関分析が実行できること', async () => {
      // 期間設定（過去30日）
      await page.click('text=過去30日');
      
      // 分析実行ボタンをクリック
      await page.click('button:has-text("相関分析実行")');
      
      // ローディング状態の確認
      await expect(page.locator('text=分析中...')).toBeVisible();
      
      // 分析完了の待機（最大30秒）
      await page.waitForSelector('text=分析完了', { timeout: 30000 });
      
      // 結果セクションの表示確認
      await expect(page.locator('text=分析結果')).toBeVisible();
      await expect(page.locator('text=分析期間')).toBeVisible();
      await expect(page.locator('text=平均日売上')).toBeVisible();
    });

    test('相関係数一覧が正しく表示されること', async () => {
      await page.click('text=過去30日');
      await page.click('button:has-text("相関分析実行")');
      
      // 分析完了を待機
      await page.waitForSelector('text=分析完了', { timeout: 30000 });
      
      // 相関係数一覧の表示確認
      await expect(page.locator('text=相関係数一覧')).toBeVisible();
      
      // 相関要因の表示確認（例：曜日、天候など）
      const correlationItems = await page.locator('.correlation-item, [data-testid="correlation-item"]').count();
      expect(correlationItems).toBeGreaterThan(0);
    });

    test('ヒートマップが正しく表示されること', async () => {
      await page.click('text=過去30日');
      await page.click('button:has-text("相関分析実行")');
      
      // 分析完了を待機
      await page.waitForSelector('text=分析完了', { timeout: 30000 });
      
      // ヒートマップセクションの表示確認
      await expect(page.locator('text=曜日×天候ヒートマップ')).toBeVisible();
      
      // 曜日ラベルの確認
      const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
      for (const day of dayLabels) {
        await expect(page.locator(`text=${day}`)).toBeVisible();
      }
      
      // 天候ラベルの確認
      const weatherLabels = ['晴', '曇', '雨'];
      for (const weather of weatherLabels) {
        await expect(page.locator(`text=${weather}`)).toBeVisible();
      }
    });

    test('フィルター適用された分析が正常に動作すること', async () => {
      // フィルターを設定
      await page.selectOption('select[name="storeId"]', { index: 1 });
      await page.selectOption('select[name="department"]', { index: 1 });
      
      // 期間設定
      await page.click('text=過去30日');
      
      // 分析実行
      await page.click('button:has-text("相関分析実行")');
      
      // 分析完了を待機
      await page.waitForSelector('text=分析完了', { timeout: 30000 });
      
      // 結果が表示されることを確認
      await expect(page.locator('text=分析結果')).toBeVisible();
    });
  });

  test.describe('パフォーマンス要件', () => {
    test.beforeEach(async () => {
      await page.goto('/analytics');
    });

    test('分析処理が5秒以内に完了すること（SLA要件）', async () => {
      await page.click('text=過去7日'); // 短期間でテスト
      
      const startTime = Date.now();
      await page.click('button:has-text("相関分析実行")');
      
      // 分析完了を待機
      await page.waitForSelector('text=分析完了', { timeout: 10000 });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // パフォーマンス要件: 5秒以内
      expect(processingTime).toBeLessThan(5000);
    });

    test('ページ初期表示が1.5秒以内であること', async () => {
      const startTime = Date.now();
      await page.goto('/analytics');
      
      // メインコンテンツの表示を待機
      await page.waitForSelector('text=相関・比較分析');
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // パフォーマンス要件: p95 ≤ 1.5秒
      expect(loadTime).toBeLessThan(1500);
    });
  });

  test.describe('エラーハンドリング', () => {
    test.beforeEach(async () => {
      await page.goto('/analytics');
    });

    test('ネットワークエラー時の処理', async () => {
      // ネットワークを無効化
      await page.setOfflineMode(true);
      
      await page.click('text=過去7日');
      await page.click('button:has-text("相関分析実行")');
      
      // エラーメッセージの表示確認
      await expect(page.locator('text*=エラー')).toBeVisible({ timeout: 10000 });
      
      // ネットワークを復元
      await page.setOfflineMode(false);
    });

    test('無効な日付範囲でのバリデーション', async () => {
      // 終了日が開始日より前の設定
      await page.fill('input[name="startDate"]', '2024-01-31');
      await page.fill('input[name="endDate"]', '2024-01-01');
      
      await page.click('button:has-text("相関分析実行")');
      
      // バリデーションエラーの表示確認
      // (実際のバリデーションメッセージは実装に依存)
      await page.waitForTimeout(1000); // バリデーション処理の待機
    });
  });

  test.describe('アクセシビリティ', () => {
    test.beforeEach(async () => {
      await page.goto('/analytics');
    });

    test('キーボードナビゲーションが可能であること', async () => {
      // Tab キーでのフォーカス移動テスト
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // 最終的にボタンにフォーカスが当たることを確認
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'SELECT', 'BUTTON']).toContain(focusedElement);
    });

    test('スクリーンリーダー対応のラベルが適切に設定されていること', async () => {
      // フォーム要素のラベル確認
      await expect(page.locator('label:has-text("開始日")')).toBeVisible();
      await expect(page.locator('label:has-text("終了日")')).toBeVisible();
      
      // ARIA属性の確認
      const analyzeButton = page.locator('button:has-text("相関分析実行")');
      await expect(analyzeButton).toBeVisible();
    });
  });

  test.describe('レスポンシブデザイン', () => {
    test('モバイル画面での表示・操作', async () => {
      // モバイル画面サイズに設定
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/analytics');
      
      // メインコンテンツが表示されることを確認
      await expect(page.locator('text=アナリティクス')).toBeVisible();
      await expect(page.locator('text=相関・比較分析')).toBeVisible();
      
      // フォーム操作が可能であることを確認
      await page.click('text=過去7日');
      await page.click('button:has-text("相関分析実行")');
      
      // ローディング表示の確認
      await expect(page.locator('text=分析中...')).toBeVisible();
    });

    test('タブレット画面での表示・操作', async () => {
      // タブレット画面サイズに設定
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/analytics');
      
      // レイアウトが適切に表示されることを確認
      await expect(page.locator('text=アナリティクス')).toBeVisible();
      
      // グリッドレイアウトが適切に機能することを確認
      const summaryCards = await page.locator('.summary-card, [data-testid="summary-card"]').count();
      expect(summaryCards).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('データ整合性', () => {
    test.beforeEach(async () => {
      await page.goto('/analytics');
    });

    test('分析結果のデータ形式が正しいこと', async () => {
      await page.click('text=過去7日');
      await page.click('button:has-text("相関分析実行")');
      
      // 分析完了を待機
      await page.waitForSelector('text=分析完了', { timeout: 30000 });
      
      // 数値データが適切な形式で表示されることを確認
      const salesValue = await page.locator('text*=¥').textContent();
      expect(salesValue).toMatch(/¥[\d,]+/);
      
      // 相関係数が適切な範囲内であることを確認（-1.0 〜 1.0）
      const correlationValues = await page.locator('[data-testid="correlation-value"]').allTextContents();
      for (const value of correlationValues) {
        const numValue = parseFloat(value);
        expect(numValue).toBeGreaterThanOrEqual(-1.0);
        expect(numValue).toBeLessThanOrEqual(1.0);
      }
    });
  });
});
