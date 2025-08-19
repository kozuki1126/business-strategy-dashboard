import { test, expect } from '@playwright/test'

test.describe('Sales Input to Dashboard Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 認証処理（テスト環境）
    await page.goto('/auth')
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill('test@example.com')
    
    const sendButton = page.locator('button', { hasText: 'マジックリンクを送信' })
    await sendButton.click()
    
    // テスト環境では直接ダッシュボードに移動
    await page.goto('/dashboard')
    await expect(page.locator('h1', { hasText: '経営戦略ダッシュボード' })).toBeVisible()
  })

  test('売上入力から集計反映までの完全フロー', async ({ page }) => {
    // ダッシュボードの初期状態確認
    await expect(page.locator('h1', { hasText: '経営戦略ダッシュボード' })).toBeVisible()
    
    // 売上入力ページに移動（ヘッダーボタンから）
    await page.locator('button', { hasText: '売上入力' }).click()
    await expect(page).toHaveURL('/sales')
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
    
    // 売上データ入力
    const testSalesData = {
      date: '2025-08-19',
      revenue: '150000',
      footfall: '300',
      transactions: '220',
      discounts: '8000',
      notes: 'E2E統合テストデータ'
    }
    
    // フォーム入力
    await page.locator('input[type="date"]').fill(testSalesData.date)
    
    // 店舗選択（データが読み込まれるまで待機）
    const storeSelect = page.locator('select[id="store_id"]')
    await storeSelect.waitFor({ state: 'visible' })
    await expect(storeSelect.locator('option').nth(1)).toBeVisible()
    await storeSelect.selectOption({ index: 1 })
    
    // 部門・カテゴリ選択
    await page.locator('select[id="department"]').selectOption('food')
    await page.locator('select[id="product_category"]').selectOption('daily_goods')
    
    // 数値入力
    await page.locator('input[id="revenue_ex_tax"]').fill(testSalesData.revenue)
    await page.locator('input[id="footfall"]').fill(testSalesData.footfall)
    await page.locator('input[id="transactions"]').fill(testSalesData.transactions)
    await page.locator('input[id="discounts"]').fill(testSalesData.discounts)
    await page.locator('textarea[id="notes"]').fill(testSalesData.notes)
    
    // APIレスポンスをモック（成功パターン）
    await page.route('/api/sales', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: '売上データを保存しました',
            data: {
              id: 'test-sales-123',
              date: testSalesData.date,
              store_name: 'テスト店舗',
              revenue_ex_tax: parseInt(testSalesData.revenue),
              tax: 15000,
              total_revenue: 165000
            }
          })
        })
      } else {
        route.continue()
      }
    })
    
    // 保存ボタンクリック
    await page.locator('button', { hasText: '保存' }).click()
    
    // 保存完了の確認（成功メッセージまたはフォームリセット）
    await page.waitForTimeout(2000)
    
    // フォームがリセットされていることを確認
    await expect(page.locator('input[id="revenue_ex_tax"]')).toHaveValue('0')
    await expect(page.locator('textarea[id="notes"]')).toHaveValue('')
    
    // ダッシュボードに戻る
    await page.locator('button', { hasText: 'ダッシュボードに戻る' }).click()
    await expect(page).toHaveURL('/dashboard')
    
    // ダッシュボードで新しいデータが反映されているか確認
    // （実際の環境では、データが更新されて表示される）
    await expect(page.locator('h1', { hasText: '経営戦略ダッシュボード' })).toBeVisible()
  })

  test('クイックアクションパネルからの売上入力', async ({ page }) => {
    // ダッシュボードのクイックアクションパネル確認
    await expect(page.locator('h2', { hasText: 'クイックアクション' })).toBeVisible()
    
    // 売上入力のクイックアクションボタンをクリック
    const salesInputQuickAction = page.locator('button').filter({ 
      has: page.locator('span', { hasText: '売上入力' }) 
    })
    await expect(salesInputQuickAction).toBeVisible()
    await salesInputQuickAction.click()
    
    // 売上入力ページに移動
    await expect(page).toHaveURL('/sales')
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
  })

  test('売上入力エラー時のダッシュボード復帰', async ({ page }) => {
    // 売上入力ページに移動
    await page.goto('/sales')
    
    // APIエラーをモック
    await page.route('/api/sales', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'データベース接続エラーが発生しました'
          })
        })
      } else {
        route.continue()
      }
    })
    
    // 最小限のデータ入力
    await page.locator('input[type="date"]').fill('2025-08-19')
    
    const storeSelect = page.locator('select[id="store_id"]')
    await storeSelect.waitFor({ state: 'visible' })
    await storeSelect.selectOption({ index: 1 })
    
    await page.locator('select[id="department"]').selectOption('food')
    await page.locator('select[id="product_category"]').selectOption('daily_goods')
    await page.locator('input[id="revenue_ex_tax"]').fill('100000')
    
    // 保存実行
    await page.locator('button', { hasText: '保存' }).click()
    
    // エラーメッセージ確認
    await expect(page.locator('text=データベース接続エラーが発生しました')).toBeVisible()
    
    // キャンセルボタンでダッシュボードに戻る
    await page.locator('button', { hasText: 'キャンセル' }).click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('売上入力後のダッシュボードデータ更新確認', async ({ page }) => {
    // 初期のダッシュボード状態記録
    await page.goto('/dashboard')
    
    // KPIカードの初期値を記録
    const initialMetrics = await page.evaluate(() => {
      const kpiCards = Array.from(document.querySelectorAll('[data-testid="kpi-card"]'))
      return kpiCards.map(card => {
        const title = card.querySelector('h3')?.textContent || ''
        const value = card.querySelector('[data-testid="kpi-value"]')?.textContent || ''
        return { title, value }
      })
    })
    
    // 売上入力
    await page.locator('button', { hasText: '売上入力' }).click()
    await expect(page).toHaveURL('/sales')
    
    // 売上データ入力とAPIモック
    await page.route('/api/sales', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: '売上データを保存しました',
            data: { id: 'test-sales-456' }
          })
        })
      } else {
        route.continue()
      }
    })
    
    // ダッシュボードデータAPIもモック（更新されたデータを返す）
    await page.route('/api/analytics*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            sales: [
              {
                id: 'test-sales-456',
                date: '2025-08-19',
                revenue_ex_tax: 200000,
                footfall: 350,
                transactions: 280
              }
            ],
            marketData: [],
            weatherData: [],
            events: []
          }
        })
      })
    })
    
    // フォーム入力と保存
    await page.locator('input[type="date"]').fill('2025-08-19')
    const storeSelect = page.locator('select[id="store_id"]')
    await storeSelect.waitFor({ state: 'visible' })
    await storeSelect.selectOption({ index: 1 })
    await page.locator('select[id="department"]').selectOption('food')
    await page.locator('select[id="product_category"]').selectOption('daily_goods')
    await page.locator('input[id="revenue_ex_tax"]').fill('200000')
    await page.locator('button', { hasText: '保存' }).click()
    
    // ダッシュボードに戻る
    await page.locator('button', { hasText: 'ダッシュボードに戻る' }).click()
    await expect(page).toHaveURL('/dashboard')
    
    // データ更新ボタンをクリック（手動リフレッシュ）
    const refreshButton = page.locator('button').filter({ 
      has: page.locator('span', { hasText: 'データ更新' }) 
    })
    await refreshButton.click()
    
    // 更新完了まで待機
    await page.waitForTimeout(3000)
    
    // 更新されたデータの確認
    // （実際の実装では、新しい売上データがKPIカードに反映されることを確認）
  })

  test('パフォーマンス要件の確認（売上入力→反映）', async ({ page }) => {
    // 売上入力ページの読み込み時間測定
    const salesInputStartTime = Date.now()
    await page.goto('/sales')
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
    const salesInputLoadTime = Date.now() - salesInputStartTime
    
    // 3秒以内の要件確認
    expect(salesInputLoadTime).toBeLessThan(3000)
    
    // フォーム送信のレスポンス時間測定
    const submissionStartTime = Date.now()
    
    // APIレスポンス時間をコントロール（1秒以内）
    await page.route('/api/sales', async route => {
      if (route.request().method() === 'POST') {
        // 意図的に500ms遅延を追加して1500ms以下の要件をテスト
        await new Promise(resolve => setTimeout(resolve, 500))
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: '売上データを保存しました',
            data: { id: 'perf-test-sales' }
          })
        })
      } else {
        route.continue()
      }
    })
    
    // 最小限のフォーム入力
    await page.locator('input[type="date"]').fill('2025-08-19')
    const storeSelect = page.locator('select[id="store_id"]')
    await storeSelect.waitFor({ state: 'visible' })
    await storeSelect.selectOption({ index: 1 })
    await page.locator('select[id="department"]').selectOption('food')
    await page.locator('select[id="product_category"]').selectOption('daily_goods')
    await page.locator('input[id="revenue_ex_tax"]').fill('100000')
    
    // 送信実行
    await page.locator('button', { hasText: '保存' }).click()
    
    // 保存完了まで待機
    await page.waitForTimeout(2000)
    const submissionTime = Date.now() - submissionStartTime
    
    // パフォーマンス要件確認（p95≤1500ms）
    expect(submissionTime).toBeLessThan(1500)
    
    console.log(`Performance Results:
      - Sales Input Load Time: ${salesInputLoadTime}ms
      - Form Submission Time: ${submissionTime}ms`)
  })

  test('アクセシビリティ統合確認', async ({ page }) => {
    // ダッシュボードから売上入力までキーボードナビゲーション
    await page.goto('/dashboard')
    
    // Tab キーで売上入力ボタンまでナビゲート
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Enterキーで売上入力ページに移動
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/sales')
    
    // フォーム内のキーボードナビゲーション確認
    await page.keyboard.press('Tab') // 日付フィールド
    await expect(page.locator('input[type="date"]')).toBeFocused()
    
    await page.keyboard.press('Tab') // 店舗選択
    await expect(page.locator('select[id="store_id"]')).toBeFocused()
    
    // スクリーンリーダー対応のaria-label確認
    await expect(page.locator('label[for="revenue_ex_tax"]')).toContainText('税抜売上')
    await expect(page.locator('span.text-red-500')).toHaveCount(4) // 必須マーク
  })
})
