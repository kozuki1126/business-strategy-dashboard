import { test, expect } from '@playwright/test'

test.describe('Sales Input Form E2E Tests', () => {
  // テスト前にログインしておく
  test.beforeEach(async ({ page }) => {
    // 認証ページに移動
    await page.goto('/auth')
    
    // メール入力フォームを探す
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    
    // テスト用メールアドレスを入力
    await emailInput.fill('test@example.com')
    
    // マジックリンク送信ボタンをクリック
    const sendButton = page.locator('button', { hasText: 'マジックリンクを送信' })
    await sendButton.click()
    
    // 送信完了メッセージを確認
    await expect(page.locator('text=マジックリンクを送信しました')).toBeVisible()
    
    // テスト環境では直接ダッシュボードに移動（実際のマジックリンク認証をスキップ）
    await page.goto('/dashboard')
    
    // ダッシュボードが表示されることを確認
    await expect(page.locator('h1', { hasText: '経営戦略ダッシュボード' })).toBeVisible()
  })

  test('売上入力フォームの基本表示確認', async ({ page }) => {
    // 売上入力ページに移動
    await page.goto('/sales')
    
    // ページタイトル確認
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
    
    // 説明文確認
    await expect(page.locator('text=日々の売上データを入力してください（税抜金額で管理）')).toBeVisible()
    
    // フォーム要素の存在確認
    await expect(page.locator('label', { hasText: '日付' })).toBeVisible()
    await expect(page.locator('label', { hasText: '店舗' })).toBeVisible()
    await expect(page.locator('label', { hasText: '部門' })).toBeVisible()
    await expect(page.locator('label', { hasText: '商品カテゴリ' })).toBeVisible()
    await expect(page.locator('label', { hasText: '税抜売上' })).toBeVisible()
    await expect(page.locator('label', { hasText: '客数' })).toBeVisible()
    await expect(page.locator('label', { hasText: '取引数' })).toBeVisible()
    await expect(page.locator('label', { hasText: '割引額' })).toBeVisible()
    await expect(page.locator('label', { hasText: '備考' })).toBeVisible()
    
    // ボタン確認
    await expect(page.locator('button', { hasText: 'ダッシュボードに戻る' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'キャンセル' })).toBeVisible()
    await expect(page.locator('button', { hasText: '保存' })).toBeVisible()
  })

  test('フォーム入力とバリデーション', async ({ page }) => {
    await page.goto('/sales')
    
    // 保存ボタンを押して必須バリデーション確認
    await page.locator('button', { hasText: '保存' }).click()
    
    // エラーメッセージ確認
    await expect(page.locator('text=店舗を選択してください')).toBeVisible()
    await expect(page.locator('text=部門を選択してください')).toBeVisible()
    await expect(page.locator('text=商品カテゴリを選択してください')).toBeVisible()
    await expect(page.locator('text=税抜売上は1円以上で入力してください')).toBeVisible()
  })

  test('正常な売上データ入力フロー', async ({ page }) => {
    await page.goto('/sales')
    
    // 日付を入力
    await page.locator('input[type="date"]').fill('2025-08-19')
    
    // 店舗を選択（最初の店舗を選択）
    const storeSelect = page.locator('select[id="store_id"]')
    await storeSelect.waitFor({ state: 'visible' })
    
    // 店舗データが読み込まれるまで待機
    await expect(storeSelect.locator('option').nth(1)).toBeVisible()
    await storeSelect.selectOption({ index: 1 })
    
    // 部門を選択
    const departmentSelect = page.locator('select[id="department"]')
    await departmentSelect.selectOption('food')
    
    // 商品カテゴリを選択
    const categorySelect = page.locator('select[id="product_category"]')
    await categorySelect.selectOption('daily_goods')
    
    // 税抜売上を入力
    await page.locator('input[id="revenue_ex_tax"]').fill('120000')
    
    // 客数を入力
    await page.locator('input[id="footfall"]').fill('250')
    
    // 取引数を入力
    await page.locator('input[id="transactions"]').fill('180')
    
    // 割引額を入力
    await page.locator('input[id="discounts"]').fill('5000')
    
    // 備考を入力
    await page.locator('textarea[id="notes"]').fill('E2Eテストデータ')
    
    // 保存ボタンをクリック
    await page.locator('button', { hasText: '保存' }).click()
    
    // 保存中の表示確認
    await expect(page.locator('text=保存中...')).toBeVisible()
    
    // 成功メッセージまたはリダイレクト確認
    // Note: 実際のAPIが動作している場合は成功メッセージ、モック環境では適切にハンドリング
    await page.waitForTimeout(2000) // API レスポンス待機
  })

  test('数値入力の境界値テスト', async ({ page }) => {
    await page.goto('/sales')
    
    // 負の値入力テスト
    await page.locator('input[id="revenue_ex_tax"]').fill('-1000')
    await page.locator('input[id="footfall"]').fill('-10')
    await page.locator('input[id="transactions"]').fill('-5')
    await page.locator('input[id="discounts"]').fill('-100')
    
    await page.locator('button', { hasText: '保存' }).click()
    
    // バリデーションエラー確認
    await expect(page.locator('text=税抜売上は1円以上で入力してください')).toBeVisible()
    await expect(page.locator('text=客数は0以上で入力してください')).toBeVisible()
    await expect(page.locator('text=取引数は0以上で入力してください')).toBeVisible()
    await expect(page.locator('text=割引額は0以上で入力してください')).toBeVisible()
    
    // 正の値に修正
    await page.locator('input[id="revenue_ex_tax"]').fill('1')
    await page.locator('input[id="footfall"]').fill('0')
    await page.locator('input[id="transactions"]').fill('0')
    await page.locator('input[id="discounts"]').fill('0')
    
    // エラーメッセージが消えることを確認
    await expect(page.locator('text=税抜売上は1円以上で入力してください')).not.toBeVisible()
    await expect(page.locator('text=客数は0以上で入力してください')).not.toBeVisible()
    await expect(page.locator('text=取引数は0以上で入力してください')).not.toBeVisible()
    await expect(page.locator('text=割引額は0以上で入力してください')).not.toBeVisible()
  })

  test('ナビゲーション機能テスト', async ({ page }) => {
    await page.goto('/sales')
    
    // ダッシュボードに戻るボタンテスト
    await page.locator('button', { hasText: 'ダッシュボードに戻る' }).click()
    await expect(page).toHaveURL('/dashboard')
    
    // 再度売上入力ページに戻る
    await page.goto('/sales')
    
    // キャンセルボタンテスト
    await page.locator('button', { hasText: 'キャンセル' }).click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('レスポンシブデザイン確認', async ({ page }) => {
    // モバイルサイズ
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/sales')
    
    // フォームが適切に表示されることを確認
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
    await expect(page.locator('input[type="date"]')).toBeVisible()
    await expect(page.locator('button', { hasText: '保存' })).toBeVisible()
    
    // タブレットサイズ
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    
    // レイアウトが適切に調整されることを確認
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
    
    // デスクトップサイズ
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.reload()
    
    // デスクトップレイアウト確認
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
  })

  test('パフォーマンステスト', async ({ page }) => {
    // ページ読み込み時間測定
    const startTime = Date.now()
    await page.goto('/sales')
    await expect(page.locator('h1', { hasText: '売上入力' })).toBeVisible()
    const loadTime = Date.now() - startTime
    
    // 3秒以内に読み込まれることを確認（要件: ≤ 3.0s）
    expect(loadTime).toBeLessThan(3000)
    
    // フォーム操作のレスポンス時間測定
    const interactionStart = Date.now()
    
    // 複数の操作を連続実行
    await page.locator('input[type="date"]').fill('2025-08-19')
    await page.locator('input[id="revenue_ex_tax"]').fill('100000')
    await page.locator('input[id="footfall"]').fill('200')
    
    const interactionTime = Date.now() - interactionStart
    
    // インタラクションが1秒以内に完了することを確認
    expect(interactionTime).toBeLessThan(1000)
  })

  test('フォーム状態の永続性確認', async ({ page }) => {
    await page.goto('/sales')
    
    // フォームに値を入力
    await page.locator('input[type="date"]').fill('2025-08-19')
    await page.locator('input[id="revenue_ex_tax"]').fill('150000')
    await page.locator('textarea[id="notes"]').fill('テスト入力データ')
    
    // 他のページに移動してから戻る
    await page.goto('/dashboard')
    await page.goto('/sales')
    
    // フォームの値がリセットされていることを確認（新規入力フォームの期待動作）
    await expect(page.locator('input[id="revenue_ex_tax"]')).toHaveValue('0')
    await expect(page.locator('textarea[id="notes"]')).toHaveValue('')
  })

  test('アクセシビリティ基本確認', async ({ page }) => {
    await page.goto('/sales')
    
    // フォーカス可能な要素の確認
    await page.keyboard.press('Tab')
    await expect(page.locator('input[type="date"]')).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(page.locator('select[id="store_id"]')).toBeFocused()
    
    // ラベルとフォームコントロールの関連確認
    await expect(page.locator('label[for="date"]')).toBeVisible()
    await expect(page.locator('label[for="store_id"]')).toBeVisible()
    await expect(page.locator('label[for="revenue_ex_tax"]')).toBeVisible()
    
    // 必須フィールドのマーク確認
    await expect(page.locator('span.text-red-500', { hasText: '*' })).toHaveCount(4) // 4つの必須フィールド
  })

  test('エラーハンドリング確認', async ({ page }) => {
    await page.goto('/sales')
    
    // ネットワークエラーをシミュレート
    await page.route('/api/sales', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: '内部サーバーエラーが発生しました'
        })
      })
    })
    
    // フォームに必要最小限のデータを入力
    await page.locator('input[type="date"]').fill('2025-08-19')
    
    // 店舗選択（モック環境での操作）
    const storeSelect = page.locator('select[id="store_id"]')
    await storeSelect.selectOption({ index: 1 })
    
    const departmentSelect = page.locator('select[id="department"]')
    await departmentSelect.selectOption('food')
    
    const categorySelect = page.locator('select[id="product_category"]')
    await categorySelect.selectOption('daily_goods')
    
    await page.locator('input[id="revenue_ex_tax"]').fill('100000')
    
    // 保存ボタンをクリック
    await page.locator('button', { hasText: '保存' }).click()
    
    // エラーメッセージの表示確認
    await expect(page.locator('text=内部サーバーエラーが発生しました')).toBeVisible()
  })
})
