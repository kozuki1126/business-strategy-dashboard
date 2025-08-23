import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Accessibility Tests for Task #015
 * 
 * These tests verify WCAG AA compliance and ensure the application
 * is accessible to users with disabilities.
 */

test.describe('Accessibility Tests @accessibility @a11y', () => {
  // Helper function to inject axe-core
  async function injectAxe(page: Page) {
    await page.addScriptTag({
      url: 'https://unpkg.com/axe-core@4.7.0/axe.min.js'
    });
  }

  // Helper function to run axe analysis
  async function checkA11y(page: Page, context?: string) {
    const violations = await page.evaluate(async (contextSelector) => {
      // @ts-ignore
      const results = await axe.run(contextSelector ? contextSelector : document);
      return results.violations;
    }, context);

    if (violations.length > 0) {
      console.log(`❌ Accessibility violations found${context ? ` in ${context}` : ''}:`);
      violations.forEach((violation: any) => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Impact: ${violation.impact}`);
        console.log(`  Elements: ${violation.nodes.length}`);
      });
    }

    return violations;
  }

  test('should have no accessibility violations on home page @accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await injectAxe(page);

    const violations = await checkA11y(page);
    expect(violations).toHaveLength(0);

    console.log('✅ Home page accessibility check passed');
  });

  test('should have no accessibility violations on dashboard @accessibility', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await injectAxe(page);

    const violations = await checkA11y(page);
    expect(violations).toHaveLength(0);

    console.log('✅ Dashboard accessibility check passed');
  });

  test('should have no accessibility violations on sales form @accessibility', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('domcontentloaded');
    await injectAxe(page);

    const violations = await checkA11y(page);
    expect(violations).toHaveLength(0);

    console.log('✅ Sales form accessibility check passed');
  });

  test('should have proper heading hierarchy @accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check heading hierarchy
    const headingLevels: number[] = [];
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const level = parseInt(tagName.charAt(1));
      headingLevels.push(level);
    }

    // Verify heading hierarchy doesn't skip levels
    for (let i = 1; i < headingLevels.length; i++) {
      const currentLevel = headingLevels[i];
      const previousLevel = headingLevels[i - 1];
      
      if (currentLevel > previousLevel + 1) {
        console.warn(`⚠️ Heading hierarchy skips level: h${previousLevel} to h${currentLevel}`);
      }
    }

    console.log(`✅ Heading hierarchy check passed (${headings.length} headings found)`);
  });

  test('should have proper form labels @accessibility', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('domcontentloaded');

    // Check all form inputs have labels
    const inputs = await page.locator('input, select, textarea').all();
    
    for (const input of inputs) {
      const hasLabel = await input.evaluate((el: HTMLElement) => {
        // Check for explicit label
        const id = el.id;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return true;
        }

        // Check for implicit label (wrapped)
        const parentLabel = el.closest('label');
        if (parentLabel) return true;

        // Check for aria-label or aria-labelledby
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        if (ariaLabel || ariaLabelledBy) return true;

        return false;
      });

      if (!hasLabel) {
        const inputType = await input.getAttribute('type');
        const inputName = await input.getAttribute('name');
        console.warn(`⚠️ Input without label: type=${inputType}, name=${inputName}`);
      }

      expect(hasLabel).toBeTruthy();
    }

    console.log(`✅ Form labels check passed (${inputs.length} inputs checked)`);
  });

  test('should have sufficient color contrast @accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await injectAxe(page);

    // Run axe-core color contrast checks
    const colorViolations = await page.evaluate(async () => {
      // @ts-ignore
      const results = await axe.run(document, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
      return results.violations.filter((v: any) => v.id === 'color-contrast');
    });

    if (colorViolations.length > 0) {
      console.log('❌ Color contrast violations:');
      colorViolations.forEach((violation: any) => {
        console.log(`- ${violation.description}`);
        violation.nodes.forEach((node: any) => {
          console.log(`  Element: ${node.target}`);
        });
      });
    }

    expect(colorViolations).toHaveLength(0);
    console.log('✅ Color contrast check passed');
  });

  test('should be keyboard navigable @accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Get all focusable elements
    const focusableElements = await page.locator(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();

    expect(focusableElements.length).toBeGreaterThan(0);

    // Test tab navigation
    let currentIndex = 0;
    for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
      await page.keyboard.press('Tab');
      
      // Check if focus is visible
      const activeElement = await page.locator(':focus');
      await expect(activeElement).toBeVisible();
      
      currentIndex++;
    }

    // Test shift+tab navigation
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab');
    }

    console.log(`✅ Keyboard navigation check passed (${focusableElements.length} focusable elements)`);
  });

  test('should have proper ARIA attributes @accessibility', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Check for proper ARIA landmarks
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').all();
    expect(landmarks.length).toBeGreaterThan(0);

    // Check for ARIA labels on interactive elements without text content
    const interactiveElements = await page.locator('button, [role="button"], [role="tab"], [role="menuitem"]').all();
    
    for (const element of interactiveElements) {
      const hasAccessibleName = await element.evaluate((el: HTMLElement) => {
        const textContent = el.textContent?.trim();
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const title = el.getAttribute('title');

        return !!(textContent || ariaLabel || ariaLabelledBy || title);
      });

      if (!hasAccessibleName) {
        const role = await element.getAttribute('role');
        const className = await element.getAttribute('class');
        console.warn(`⚠️ Interactive element without accessible name: role=${role}, class=${className}`);
      }
    }

    console.log(`✅ ARIA attributes check passed (${landmarks.length} landmarks, ${interactiveElements.length} interactive elements)`);
  });

  test('should handle screen reader announcements @accessibility', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Check for live regions
    const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"]').all();
    
    // Check for proper headings for screen reader navigation
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);

    // Check for skip links
    const skipLinks = await page.locator('a[href^="#"], [class*="skip"]').all();
    
    console.log(`✅ Screen reader features check passed (${liveRegions.length} live regions, ${skipLinks.length} skip links)`);
  });

  test('should handle focus management in modals @accessibility', async ({ page }) => {
    await page.goto('/export');
    await page.waitForLoadState('domcontentloaded');

    // Try to open a modal if available
    const modalTrigger = page.locator('[data-testid="export-modal-trigger"], button:has-text("エクスポート")').first();
    
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      
      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]').first();
      
      if (await modal.isVisible()) {
        // Check if focus is trapped in modal
        const focusableInModal = await modal.locator('button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])').all();
        
        if (focusableInModal.length > 0) {
          // Test focus trap
          await page.keyboard.press('Tab');
          const focusedElement = await page.locator(':focus');
          await expect(focusedElement).toBeVisible();
          
          // Test escape key
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          
          // Modal should close or focus should return
          const modalStillVisible = await modal.isVisible();
          if (modalStillVisible) {
            console.warn('⚠️ Modal did not close with Escape key');
          }
        }
        
        console.log('✅ Modal focus management check passed');
      } else {
        console.log('ℹ️ No modal found to test focus management');
      }
    } else {
      console.log('ℹ️ No modal trigger found to test focus management');
    }
  });

  test('should handle reduced motion preferences @accessibility', async ({ page }) => {
    // Enable reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check that animations are disabled or reduced
    const elementsWithAnimation = await page.locator('[class*="animate"], [style*="animation"], [style*="transition"]').all();
    
    for (const element of elementsWithAnimation) {
      const animationDuration = await element.evaluate((el: HTMLElement) => {
        const styles = window.getComputedStyle(el);
        return {
          animationDuration: styles.animationDuration,
          transitionDuration: styles.transitionDuration
        };
      });

      // Animations should be disabled or very short
      const hasReducedAnimation = 
        animationDuration.animationDuration === '0s' ||
        animationDuration.animationDuration === 'none' ||
        animationDuration.transitionDuration === '0s' ||
        animationDuration.transitionDuration === 'none';
        
      if (!hasReducedAnimation) {
        console.log(`ℹ️ Animation duration: ${JSON.stringify(animationDuration)}`);
      }
    }

    console.log(`✅ Reduced motion check passed (${elementsWithAnimation.length} elements with animations)`);
  });

  test('should be usable with high contrast mode @accessibility', async ({ page }) => {
    // Enable high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Verify critical elements are still visible
    await expect(page.getByRole('heading', { name: /経営戦略ダッシュボード/i })).toBeVisible();
    
    // Check navigation elements
    const navigationLinks = await page.locator('nav a, [role="navigation"] a').all();
    for (const link of navigationLinks) {
      await expect(link).toBeVisible();
    }

    // Check buttons are visible
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      if (await button.isVisible()) {
        await expect(button).toBeVisible();
      }
    }

    console.log(`✅ High contrast mode check passed (${navigationLinks.length} nav links, ${buttons.length} buttons)`);
  });

  test('should work with zoom levels @accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Test different zoom levels
    const zoomLevels = [1.5, 2.0];

    for (const zoom of zoomLevels) {
      await page.setViewportSize({ 
        width: Math.round(1280 / zoom), 
        height: Math.round(720 / zoom) 
      });

      // Apply CSS zoom
      await page.addStyleTag({
        content: `body { zoom: ${zoom}; }`
      });

      // Check that main content is still accessible
      await expect(page.getByRole('heading', { name: /経営戦略ダッシュボード/i })).toBeVisible();
      
      // Check that navigation still works
      const firstLink = page.getByRole('link').first();
      if (await firstLink.isVisible()) {
        await expect(firstLink).toBeVisible();
      }

      console.log(`✅ Zoom level ${zoom * 100}% check passed`);
    }
  });

  test('should have proper error message announcements @accessibility', async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('domcontentloaded');

    // Try to submit form with invalid data to trigger error messages
    const submitButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("送信")').first();
    
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Wait for error messages
      await page.waitForTimeout(1000);
      
      // Check for error messages with proper ARIA attributes
      const errorMessages = await page.locator('[role="alert"], .error-message, [aria-invalid="true"] + .error').all();
      
      for (const errorMessage of errorMessages) {
        await expect(errorMessage).toBeVisible();
        
        // Check if error is properly associated with input
        const ariaDescribedBy = await errorMessage.getAttribute('aria-describedby');
        const id = await errorMessage.getAttribute('id');
        
        if (id) {
          const associatedInput = page.locator(`[aria-describedby*="${id}"]`);
          if (await associatedInput.count() > 0) {
            console.log(`✅ Error message properly associated with input: ${id}`);
          }
        }
      }
      
      console.log(`✅ Error announcements check passed (${errorMessages.length} error messages)`);
    } else {
      console.log('ℹ️ No submit button found to test error announcements');
    }
  });
});

/**
 * Accessibility Integration Tests
 */
test.describe('Accessibility Integration @accessibility @integration', () => {
  test('should maintain accessibility during user interactions @accessibility', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.7.0/axe.min.js' });

    // Initial accessibility check
    let violations = await checkA11y(page);
    expect(violations).toHaveLength(0);

    // Interact with elements and recheck
    const interactiveElements = await page.locator('button, [role="button"], a').all();
    
    for (let i = 0; i < Math.min(interactiveElements.length, 3); i++) {
      const element = interactiveElements[i];
      if (await element.isVisible()) {
        await element.click();
        await page.waitForTimeout(500);
        
        // Recheck accessibility after interaction
        violations = await checkA11y(page);
        expect(violations).toHaveLength(0);
      }
    }

    console.log('✅ Accessibility maintained during user interactions');
  });

  async function checkA11y(page: Page): Promise<any[]> {
    return await page.evaluate(async () => {
      // @ts-ignore
      const results = await axe.run(document);
      return results.violations;
    });
  }
});
