import { test, expect } from '@playwright/test'

// Note: This E2E test requires a test Supabase project with email testing enabled
// For CI/CD, we use mock authentication or test with email providers like Ethereal

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies()
    await page.context().clearPermissions()
  })

  test('should redirect unauthenticated users to auth page', async ({ page }) => {
    // Given: User is not authenticated
    // When: User tries to access dashboard
    await page.goto('/dashboard')

    // Then: User should be redirected to auth page
    await expect(page).toHaveURL('/auth')
    await expect(page.locator('h2')).toContainText('経営戦略ダッシュボード')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('should display auth page correctly', async ({ page }) => {
    // Given: User navigates to auth page
    await page.goto('/auth')

    // Then: Auth page should display correctly
    await expect(page.locator('h2')).toContainText('経営戦略ダッシュボード')
    await expect(page.locator('p')).toContainText('メールアドレスでサインイン')
    
    // Check form elements
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('placeholder', 'メールアドレス')
    
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toContainText('マジックリンクを送信')
    
    // Button should be disabled when email is empty
    await expect(submitButton).toBeDisabled()
  })

  test('should validate email input', async ({ page }) => {
    await page.goto('/auth')
    
    const emailInput = page.locator('input[type="email"]')
    const submitButton = page.locator('button[type="submit"]')

    // Test empty email
    await expect(submitButton).toBeDisabled()

    // Test invalid email format
    await emailInput.fill('invalid-email')
    await expect(submitButton).toBeDisabled()

    // Test valid email format
    await emailInput.fill('test@example.com')
    await expect(submitButton).toBeEnabled()
  })

  test('should handle magic link request', async ({ page }) => {
    await page.goto('/auth')
    
    const emailInput = page.locator('input[type="email"]')
    const submitButton = page.locator('button[type="submit"]')

    // Fill in email and submit
    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Should show loading state
    await expect(submitButton).toContainText('送信中...')
    await expect(submitButton).toBeDisabled()

    // Wait for response (success or error)
    await page.waitForTimeout(2000)

    // Check for success or error message
    const messageDiv = page.locator('[role="status"], [role="alert"]')
    await expect(messageDiv).toBeVisible()
  })

  test('should handle auth callback flow', async ({ page }) => {
    // Given: User clicks magic link (simulate callback with valid session)
    // Note: In real testing, this would require email integration
    
    await page.goto('/auth/callback')

    // Should show loading state initially
    await expect(page.locator('h2')).toContainText('認証処理中...')
    await expect(page.locator('p')).toContainText('サインインを完了しています')

    // Wait for auth processing
    await page.waitForTimeout(3000)

    // Should either redirect to dashboard (success) or show error
    const currentUrl = page.url()
    const isOnDashboard = currentUrl.includes('/dashboard')
    const isOnError = page.locator('h2').textContent().then(text => text?.includes('認証エラー'))

    if (isOnDashboard) {
      // Success case: redirected to dashboard
      await expect(page).toHaveURL('/dashboard')
    } else {
      // Error case: should show error message with retry option
      await expect(page.locator('h2')).toContainText('認証エラー')
      await expect(page.locator('button')).toContainText('ログインページに戻る')
    }
  })

  test('should redirect authenticated users away from auth page', async ({ page, context }) => {
    // Note: This test requires setting up a mock authenticated session
    // For demo purposes, we'll test the redirect logic assumption
    
    // Skip this test if we can't set up auth state
    // In a real implementation, you would:
    // 1. Set up authenticated cookies/session
    // 2. Visit /auth
    // 3. Expect redirect to /dashboard
    
    test.skip(true, 'Requires auth session setup')
  })

  test('should display dashboard for authenticated users', async ({ page }) => {
    // Note: This test requires authenticated session
    // Skip for now, implement when auth session mocking is available
    
    test.skip(true, 'Requires auth session setup')
    
    // When implemented, should test:
    // - Dashboard displays user email
    // - Logout button is visible
    // - Session indicator shows
    // - Dashboard content loads
  })

  test('should handle logout flow', async ({ page }) => {
    // Note: This test requires authenticated session
    test.skip(true, 'Requires auth session setup')
    
    // When implemented, should test:
    // - Click logout button
    // - Should redirect to auth page
    // - Should clear session
    // - Should not be able to access dashboard without re-auth
  })

  test('should handle session timeout', async ({ page }) => {
    // Note: This test would require session manipulation
    test.skip(true, 'Requires session timeout simulation')
    
    // When implemented, should test:
    // - User is authenticated
    // - Session expires (simulate 30+ minutes)
    // - User tries to access protected resource
    // - Should redirect to auth page
  })
})

test.describe('Authentication Accessibility', () => {
  test('auth page should be accessible', async ({ page }) => {
    await page.goto('/auth')

    // Check for proper labels and ARIA attributes
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toHaveAttribute('aria-describedby')
    
    // Check for screen reader friendly elements
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toHaveAttribute('aria-describedby')
    
    // Check heading hierarchy
    const mainHeading = page.locator('h2')
    await expect(mainHeading).toBeVisible()
    
    // Verify form has proper structure
    const form = page.locator('form')
    await expect(form).toBeVisible()
  })

  test('auth callback should provide feedback for screen readers', async ({ page }) => {
    await page.goto('/auth/callback')
    
    // Should have live regions for status updates
    const statusElements = page.locator('[aria-live="polite"], [role="status"]')
    await expect(statusElements.first()).toBeVisible()
  })
})

test.describe('Authentication Performance', () => {
  test('auth page should load quickly', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/auth')
    
    // Wait for main content to be visible
    await expect(page.locator('h2')).toBeVisible()
    
    const loadTime = Date.now() - startTime
    
    // Should load within 3 seconds (as per PRD requirement)
    expect(loadTime).toBeLessThan(3000)
  })

  test('auth callback should process quickly', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/auth/callback')
    
    // Wait for either success redirect or error display
    await page.waitForFunction(
      () => {
        return window.location.pathname !== '/auth/callback' || 
               document.querySelector('h2')?.textContent?.includes('認証エラー')
      },
      { timeout: 5000 }
    )
    
    const processTime = Date.now() - startTime
    
    // Auth processing should complete within 5 seconds
    expect(processTime).toBeLessThan(5000)
  })
})
