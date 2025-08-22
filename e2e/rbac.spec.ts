/**
 * E2E Tests: Role-Based Access Control (RBAC)
 * Task #015: E2E Test Comprehensive Implementation
 * 
 * Test Coverage:
 * - Multi-role access control (admin/manager/analyst/viewer)
 * - Store-level permissions (view/edit/export)
 * - UI permission guards and restrictions
 * - API endpoint protection
 * - Real-time permission updates
 * - Permission escalation prevention
 * - Audit trail for permission changes
 * - Role hierarchy enforcement
 */

import { test, expect, Page } from '@playwright/test';

test.describe('RBAC - Role-Based Access Control', () => {
  let page: Page;

  // Test users for different roles
  const testUsers = {
    admin: {
      email: 'admin@example.com',
      role: 'admin',
      stores: ['store-001', 'store-002', 'store-003'],
      permissions: ['view', 'edit', 'export', 'manage']
    },
    manager: {
      email: 'manager@example.com', 
      role: 'manager',
      stores: ['store-001', 'store-002'],
      permissions: ['view', 'edit', 'export']
    },
    analyst: {
      email: 'analyst@example.com',
      role: 'analyst', 
      stores: ['store-001'],
      permissions: ['view', 'export']
    },
    viewer: {
      email: 'viewer@example.com',
      role: 'viewer',
      stores: ['store-001'],
      permissions: ['view']
    }
  };

  test.describe('Admin Role Tests', () => {
    test.beforeEach(async ({ page: testPage }) => {
      page = testPage;
      // Mock admin authentication
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.admin);
      
      await page.goto('/dashboard');
      await expect(page.locator('h1')).toContainText('ダッシュボード');
    });

    test('admin should have access to all areas', async () => {
      // Verify admin can access all main sections
      const adminAreas = [
        { path: '/dashboard', title: 'ダッシュボード' },
        { path: '/sales', title: '売上入力' },
        { path: '/analytics', title: '相関・比較分析' },
        { path: '/export', title: 'エクスポート' },
        { path: '/audit', title: '監査ログ' }
      ];

      for (const area of adminAreas) {
        await page.goto(area.path);
        await expect(page.locator('h1')).toContainText(area.title);
        
        // Verify no access denied messages
        await expect(page.locator('[data-testid="access-denied"]')).not.toBeVisible();
      }
    });

    test('admin should see all store data', async () => {
      await page.goto('/dashboard');
      
      // Check store filter options
      await page.click('[data-testid="store-filter"]');
      
      // Verify all stores are available
      for (const store of testUsers.admin.stores) {
        await expect(page.locator(`option[value="${store}"]`)).toBeVisible();
      }
      
      // Test data access for different stores
      for (const store of testUsers.admin.stores) {
        await page.selectOption('[data-testid="store-filter"]', store);
        
        // Verify data loads without restrictions
        await expect(page.locator('[data-testid="sales-chart"]')).toBeVisible();
        await expect(page.locator('[data-testid="kpi-cards"]')).toBeVisible();
      }
    });

    test('admin should have full CRUD permissions', async () => {
      // Test sales input access
      await page.goto('/sales');
      await expect(page.locator('[data-testid="sales-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled();
      
      // Test export access
      await page.goto('/export');
      await expect(page.locator('[data-testid="export-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-button"]')).toBeEnabled();
      
      // Test analytics access
      await page.goto('/analytics');
      await expect(page.locator('[data-testid="analyze-button"]')).toBeEnabled();
    });

    test('admin should access user management features', async () => {
      await page.goto('/dashboard');
      
      // Verify admin menu is available
      await page.click('[data-testid="user-menu"]');
      await expect(page.locator('[data-testid="admin-panel"]')).toBeVisible();
      
      // Test user management access if available
      const userManagementLink = page.locator('[data-testid="user-management"]');
      if (await userManagementLink.isVisible()) {
        await userManagementLink.click();
        await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
      }
    });
  });

  test.describe('Manager Role Tests', () => {
    test.beforeEach(async ({ page: testPage }) => {
      page = testPage;
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.manager);
      
      await page.goto('/dashboard');
    });

    test('manager should have limited store access', async () => {
      await page.goto('/dashboard');
      
      // Check store filter shows only assigned stores
      await page.click('[data-testid="store-filter"]');
      
      // Verify only assigned stores are available
      for (const store of testUsers.manager.stores) {
        await expect(page.locator(`option[value="${store}"]`)).toBeVisible();
      }
      
      // Verify restricted stores are not available
      await expect(page.locator('option[value="store-003"]')).not.toBeVisible();
    });

    test('manager should access sales input and export', async () => {
      // Test sales input access
      await page.goto('/sales');
      await expect(page.locator('[data-testid="sales-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled();
      
      // Test export access
      await page.goto('/export');
      await expect(page.locator('[data-testid="export-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-button"]')).toBeEnabled();
      
      // Test analytics access
      await page.goto('/analytics');
      await expect(page.locator('[data-testid="analyze-button"]')).toBeEnabled();
    });

    test('manager should not access admin features', async () => {
      await page.goto('/dashboard');
      
      // Verify admin menu is not available or restricted
      await page.click('[data-testid="user-menu"]');
      await expect(page.locator('[data-testid="admin-panel"]')).not.toBeVisible();
      
      // Test that user management is not accessible
      await page.goto('/admin/users');
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });

    test('manager should see appropriate navigation items', async () => {
      // Verify navigation items for manager role
      const managerNavItems = ['dashboard', 'sales', 'analytics', 'export', 'audit'];
      
      for (const item of managerNavItems) {
        await expect(page.locator(`[data-testid="nav-${item}"]`)).toBeVisible();
      }
      
      // Verify admin-only items are hidden
      await expect(page.locator('[data-testid="nav-admin"]')).not.toBeVisible();
    });
  });

  test.describe('Analyst Role Tests', () => {
    test.beforeEach(async ({ page: testPage }) => {
      page = testPage;
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.analyst);
      
      await page.goto('/dashboard');
    });

    test('analyst should have read-only dashboard access', async () => {
      await page.goto('/dashboard');
      
      // Verify dashboard is visible
      await expect(page.locator('[data-testid="sales-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="kpi-cards"]')).toBeVisible();
      
      // Verify no edit capabilities
      await expect(page.locator('[data-testid="edit-button"]')).not.toBeVisible();
    });

    test('analyst should access analytics but not sales input', async () => {
      // Test analytics access
      await page.goto('/analytics');
      await expect(page.locator('[data-testid="correlation-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="analyze-button"]')).toBeEnabled();
      
      // Test that sales input is restricted
      await page.goto('/sales');
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
      await expect(page.locator('[data-testid="access-denied"]')).toContainText(/権限がありません/);
    });

    test('analyst should have limited export access', async () => {
      await page.goto('/export');
      
      // Verify export form is available but limited
      await expect(page.locator('[data-testid="export-form"]')).toBeVisible();
      
      // Check that only read-only exports are available
      await expect(page.locator('[data-testid="data-type-sales"]')).toBeChecked();
      await expect(page.locator('[data-testid="data-type-sales"]')).toBeDisabled();
      
      // Verify export button is enabled for read operations
      await expect(page.locator('[data-testid="export-button"]')).toBeEnabled();
    });

    test('analyst should only see assigned store data', async () => {
      await page.goto('/dashboard');
      
      // Check store filter shows only assigned store
      await page.click('[data-testid="store-filter"]');
      
      // Verify only assigned store is available
      await expect(page.locator('option[value="store-001"]')).toBeVisible();
      await expect(page.locator('option[value="store-002"]')).not.toBeVisible();
      await expect(page.locator('option[value="store-003"]')).not.toBeVisible();
    });
  });

  test.describe('Viewer Role Tests', () => {
    test.beforeEach(async ({ page: testPage }) => {
      page = testPage;
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.viewer);
      
      await page.goto('/dashboard');
    });

    test('viewer should have read-only access to dashboard', async () => {
      await page.goto('/dashboard');
      
      // Verify dashboard is visible
      await expect(page.locator('[data-testid="sales-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="kpi-cards"]')).toBeVisible();
      
      // Verify all interactive elements are disabled or hidden
      await expect(page.locator('[data-testid="edit-button"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="add-button"]')).not.toBeVisible();
    });

    test('viewer should not access sales input or analytics', async () => {
      // Test sales input restriction
      await page.goto('/sales');
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
      
      // Test analytics restriction
      await page.goto('/analytics');
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
      
      // Test export restriction
      await page.goto('/export');
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });

    test('viewer should have minimal navigation options', async () => {
      // Verify only dashboard navigation is available
      await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
      
      // Verify other navigation items are hidden or disabled
      await expect(page.locator('[data-testid="nav-sales"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="nav-analytics"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="nav-export"]')).not.toBeVisible();
    });

    test('viewer should see permission warnings', async () => {
      // Attempt to access restricted area
      await page.goto('/sales');
      
      // Verify permission warning message
      await expect(page.locator('[data-testid="permission-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="permission-warning"]')).toContainText(/表示権限のみ/);
      
      // Verify contact admin message
      await expect(page.locator('[data-testid="contact-admin"]')).toBeVisible();
    });
  });

  test.describe('Permission Guards & UI Controls', () => {
    test('should hide buttons based on permissions', async () => {
      // Test with viewer role
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.viewer);
      
      await page.goto('/dashboard');
      
      // Verify action buttons are hidden for viewer
      await expect(page.locator('[data-testid="add-sales-button"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="export-button"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="edit-settings"]')).not.toBeVisible();
    });

    test('should disable buttons based on permissions', async () => {
      // Test with analyst role
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.analyst);
      
      await page.goto('/dashboard');
      
      // Verify some buttons are disabled but visible
      const restrictedButtons = page.locator('[data-testid="edit-mode-toggle"]');
      if (await restrictedButtons.isVisible()) {
        await expect(restrictedButtons).toBeDisabled();
      }
    });

    test('should show permission tooltips', async () => {
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.viewer);
      
      await page.goto('/dashboard');
      
      // Hover over disabled element
      const disabledElement = page.locator('[data-testid="restricted-action"]');
      if (await disabledElement.isVisible()) {
        await disabledElement.hover();
        
        // Verify permission tooltip
        await expect(page.locator('[data-testid="permission-tooltip"]')).toBeVisible();
        await expect(page.locator('[data-testid="permission-tooltip"]')).toContainText(/権限が必要/);
      }
    });
  });

  test.describe('API Endpoint Protection', () => {
    test('should protect sales API based on role', async () => {
      // Test API protection with different roles
      const testCases = [
        { user: testUsers.admin, shouldSucceed: true },
        { user: testUsers.manager, shouldSucceed: true },
        { user: testUsers.analyst, shouldSucceed: false },
        { user: testUsers.viewer, shouldSucceed: false }
      ];

      for (const testCase of testCases) {
        await page.addInitScript((user) => {
          window.localStorage.setItem('test-user', JSON.stringify(user));
        }, testCase.user);
        
        // Mock API call
        const response = await page.evaluate(async (shouldSucceed) => {
          try {
            const res = await fetch('/api/sales', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                date: '2025-08-22',
                store_id: 'store-001',
                department: 'electronics',
                revenue_ex_tax: 10000
              })
            });
            return { status: res.status, ok: res.ok };
          } catch (error) {
            return { status: 500, ok: false };
          }
        }, testCase.shouldSucceed);

        if (testCase.shouldSucceed) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(403);
        }
      }
    });

    test('should protect export API based on role', async () => {
      const testCases = [
        { user: testUsers.admin, shouldSucceed: true },
        { user: testUsers.manager, shouldSucceed: true },
        { user: testUsers.analyst, shouldSucceed: true },
        { user: testUsers.viewer, shouldSucceed: false }
      ];

      for (const testCase of testCases) {
        await page.addInitScript((user) => {
          window.localStorage.setItem('test-user', JSON.stringify(user));
        }, testCase.user);
        
        const response = await page.evaluate(async () => {
          try {
            const res = await fetch('/api/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dataType: 'sales',
                format: 'csv',
                startDate: '2025-08-01',
                endDate: '2025-08-22'
              })
            });
            return { status: res.status, ok: res.ok };
          } catch (error) {
            return { status: 500, ok: false };
          }
        });

        if (testCase.shouldSucceed) {
          expect([200, 202]).toContain(response.status);
        } else {
          expect(response.status).toBe(403);
        }
      }
    });
  });

  test.describe('Real-time Permission Updates', () => {
    test('should update UI when permissions change', async () => {
      // Start with manager role
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.manager);
      
      await page.goto('/dashboard');
      
      // Verify manager permissions
      await expect(page.locator('[data-testid="nav-sales"]')).toBeVisible();
      
      // Simulate permission change to viewer
      await page.evaluate((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
        window.dispatchEvent(new Event('rbac-update'));
      }, testUsers.viewer);
      
      // Wait for UI to update
      await page.waitForTimeout(1000);
      
      // Verify viewer restrictions applied
      await expect(page.locator('[data-testid="nav-sales"]')).not.toBeVisible();
    });

    test('should handle permission escalation prevention', async () => {
      // Start with viewer role
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.viewer);
      
      await page.goto('/dashboard');
      
      // Attempt to escalate permissions via localStorage manipulation
      await page.evaluate(() => {
        const fakeAdmin = {
          email: 'fake@admin.com',
          role: 'admin',
          stores: ['store-001', 'store-002', 'store-003'],
          permissions: ['view', 'edit', 'export', 'manage']
        };
        window.localStorage.setItem('test-user', JSON.stringify(fakeAdmin));
      });
      
      // Try to access restricted area
      await page.goto('/sales');
      
      // Should still be blocked (server-side validation)
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });
  });

  test.describe('Audit Trail for RBAC', () => {
    test('should log permission-related actions', async () => {
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.manager);
      
      // Perform action that should be audited
      await page.goto('/sales');
      await page.fill('[data-testid="revenue-input"]', '50000');
      await page.click('[data-testid="submit-button"]');
      
      // Navigate to audit logs
      await page.goto('/audit');
      
      // Search for permission-related logs
      await page.fill('[data-testid="action-filter"]', 'permission_check');
      await page.click('[data-testid="search-button"]');
      
      // Verify audit entry exists
      if (await page.locator('[data-testid="audit-entry"]').count() > 0) {
        const firstEntry = page.locator('[data-testid="audit-entry"]').first();
        await expect(firstEntry).toContainText('permission_check');
        await expect(firstEntry).toContainText('manager');
      }
    });

    test('should log access denials', async () => {
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.viewer);
      
      // Attempt to access restricted area
      await page.goto('/sales');
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
      
      // Check audit logs
      await page.goto('/audit');
      await page.fill('[data-testid="action-filter"]', 'access_denied');
      await page.click('[data-testid="search-button"]');
      
      // Verify denial was logged
      if (await page.locator('[data-testid="audit-entry"]').count() > 0) {
        const denialEntry = page.locator('[data-testid="audit-entry"]').first();
        await expect(denialEntry).toContainText('access_denied');
        await expect(denialEntry).toContainText('/sales');
      }
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should handle invalid role gracefully', async () => {
      // Set invalid role
      await page.addInitScript(() => {
        window.localStorage.setItem('test-user', JSON.stringify({
          email: 'test@example.com',
          role: 'invalid-role',
          stores: [],
          permissions: []
        }));
      });
      
      await page.goto('/dashboard');
      
      // Should show error or redirect to login
      await expect(page.locator('[data-testid="role-error"]')).toBeVisible();
    });

    test('should handle missing permissions data', async () => {
      // Set user with missing permissions
      await page.addInitScript(() => {
        window.localStorage.setItem('test-user', JSON.stringify({
          email: 'test@example.com',
          role: 'manager'
          // missing stores and permissions
        }));
      });
      
      await page.goto('/dashboard');
      
      // Should handle gracefully with default restrictions
      await expect(page.locator('[data-testid="permission-error"]')).toBeVisible();
    });

    test('should handle network errors during permission checks', async () => {
      await page.addInitScript((user) => {
        window.localStorage.setItem('test-user', JSON.stringify(user));
      }, testUsers.manager);
      
      // Simulate network error for permission API
      await page.route('/api/rbac/permissions', route => route.abort());
      
      await page.goto('/dashboard');
      
      // Should show error message or fallback to safe defaults
      await expect(page.locator('[data-testid="permission-check-error"]')).toBeVisible();
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Clean up test data
    await page.evaluate(() => {
      window.localStorage.removeItem('test-user');
    });
    
    // Capture diagnostics on failure
    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ 
        path: `test-results/rbac-failure-${testInfo.title.replace(/\s+/g, '-')}.png`,
        fullPage: true 
      });
    }
  });
});
