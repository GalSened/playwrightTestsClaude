import { test, expect, Page } from '@playwright/test';

test.describe('Role-Based Access Control (RBAC) System', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test('Admin role full access', async () => {
    // Login as Admin
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Verify admin role indicator
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Administrator');
    
    // Test access to all sections
    const adminSections = [
      { url: '/test-bank', testId: 'test-bank-page' },
      { url: '/analytics', testId: 'analytics-page' },
      { url: '/reports', testId: 'reports-page' },
      { url: '/settings/users', testId: 'user-management' },
      { url: '/settings/system', testId: 'system-settings' },
      { url: '/settings/audit', testId: 'audit-logs' }
    ];
    
    for (const section of adminSections) {
      await page.goto(section.url);
      await expect(page.locator(`[data-testid="${section.testId}"]`)).toBeVisible({ timeout: 10000 });
    }
    
    // Test admin-only actions
    await page.goto('/settings/users');
    
    // Verify admin can create users
    const createUserButton = page.locator('[data-testid="create-user"]');
    await expect(createUserButton).toBeVisible();
    
    // Test user creation
    await createUserButton.click();
    await page.fill('[data-testid="new-user-email"]', 'newuser@demo.com');
    await page.fill('[data-testid="new-user-name"]', 'New Test User');
    await page.selectOption('[data-testid="new-user-role"]', 'Tester');
    await page.click('[data-testid="save-user"]');
    
    // Verify user is created
    await expect(page.locator('text=newuser@demo.com')).toBeVisible();
    
    // Test admin can delete users
    const deleteButton = page.locator('[data-testid="delete-user"]').last();
    await expect(deleteButton).toBeVisible();
    
    // Test system configuration access
    await page.goto('/settings/system');
    
    // Admin should be able to modify system settings
    const systemSettings = [
      'max-concurrent-runs',
      'default-timeout',
      'retention-period',
      'backup-frequency'
    ];
    
    for (const setting of systemSettings) {
      const settingField = page.locator(`[data-testid="${setting}"]`);
      await expect(settingField).toBeEnabled();
    }
  });

  test('Tester role limited access', async () => {
    // Login as Tester
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'tester@demo.com');
    await page.fill('[name="password"]', 'tester123');
    await page.click('button:has-text("Login")');
    
    // Verify tester role
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Tester');
    
    // Test access to allowed sections
    await page.goto('/test-bank');
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Verify tester can create and run test suites
    await page.locator('[data-testid="test-checkbox"]').first().check();
    await page.fill('[data-testid="suite-name-input"]', 'Tester Suite');
    await page.click('[data-testid="create-suite-button"]');
    
    await expect(page.locator('text=Tester Suite')).toBeVisible();
    
    // Verify tester can execute tests
    const runButton = page.locator('[data-testid="run-single-test"]').first();
    await expect(runButton).toBeEnabled();
    
    // Test access to reports
    await page.goto('/reports');
    await expect(page.locator('[data-testid="reports-page"]')).toBeVisible();
    
    // Verify tester can view their own test runs
    const runsTable = page.locator('[data-testid="runs-table"]');
    await expect(runsTable).toBeVisible();
    
    // Test restricted access - should NOT have access to user management
    await page.goto('/settings/users');
    
    // Should be redirected or show access denied
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 }).catch(async () => {
      // Or should be redirected to dashboard
      expect(page.url()).not.toContain('/settings/users');
    });
    
    // Test restricted access - should NOT have system settings access
    await page.goto('/settings/system');
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 }).catch(async () => {
      expect(page.url()).not.toContain('/settings/system');
    });
    
    // Verify limited analytics access
    await page.goto('/analytics');
    
    // Should see basic analytics but not advanced admin features
    await expect(page.locator('[data-testid="coverage-overview"]')).toBeVisible();
    
    // Should NOT see system administration analytics
    await expect(page.locator('[data-testid="system-admin-analytics"]')).not.toBeVisible();
  });

  test('Viewer role read-only access', async () => {
    // Login as Viewer
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'viewer@demo.com');
    await page.fill('[name="password"]', 'viewer123');
    await page.click('button:has-text("Login")');
    
    // Verify viewer role
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Viewer');
    
    // Test read-only access to test bank
    await page.goto('/test-bank');
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Verify viewer CANNOT create suites
    await page.locator('[data-testid="test-checkbox"]').first().check();
    
    const createSuiteButton = page.locator('[data-testid="create-suite-button"]');
    await expect(createSuiteButton).toBeDisabled();
    
    // Verify viewer CANNOT run tests
    const runButtons = page.locator('[data-testid="run-single-test"]');
    const buttonCount = await runButtons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      await expect(runButtons.nth(i)).toBeDisabled();
    }
    
    // Test read-only access to reports
    await page.goto('/reports');
    await expect(page.locator('[data-testid="reports-page"]')).toBeVisible();
    
    // Verify viewer can see reports but cannot delete or modify
    const reportActions = page.locator('[data-testid="run-actions"]');
    if (await reportActions.count() > 0) {
      // Rerun and Delete buttons should be disabled or hidden
      const rerunButtons = page.locator('[data-testid="rerun-suite"]');
      const deleteButtons = page.locator('[data-testid="delete-run"]');
      
      if (await rerunButtons.count() > 0) {
        await expect(rerunButtons.first()).toBeDisabled();
      }
      
      if (await deleteButtons.count() > 0) {
        await expect(deleteButtons.first()).toBeDisabled();
      }
    }
    
    // Test read-only analytics access
    await page.goto('/analytics');
    await expect(page.locator('[data-testid="analytics-page"]')).toBeVisible();
    
    // Can view charts and data
    await expect(page.locator('[data-testid="coverage-overview"]')).toBeVisible();
    
    // Cannot modify analytics settings
    const analyticsSettings = page.locator('[data-testid="analytics-settings"]');
    if (await analyticsSettings.isVisible()) {
      await expect(analyticsSettings).toBeDisabled();
    }
    
    // No access to settings at all
    await page.goto('/settings');
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 }).catch(async () => {
      expect(page.url()).not.toContain('/settings');
    });
  });

  test('Custom role creation and assignment', async () => {
    // Login as Admin to create custom role
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Navigate to role management
    await page.goto('/settings/roles');
    
    // Create new custom role
    await page.click('[data-testid="create-role"]');
    
    await page.fill('[data-testid="role-name"]', 'Test Lead');
    await page.fill('[data-testid="role-description"]', 'Can manage test suites and view analytics');
    
    // Configure permissions
    const permissions = [
      { permission: 'test-bank-read', should: true },
      { permission: 'test-bank-write', should: true },
      { permission: 'test-execution', should: true },
      { permission: 'analytics-read', should: true },
      { permission: 'analytics-write', should: false },
      { permission: 'user-management', should: false },
      { permission: 'system-settings', should: false }
    ];
    
    for (const { permission, should } of permissions) {
      const checkbox = page.locator(`[data-testid="permission-${permission}"]`);
      
      if (should) {
        await checkbox.check();
      } else {
        await checkbox.uncheck();
      }
    }
    
    // Save custom role
    await page.click('[data-testid="save-role"]');
    
    // Verify role is created
    await expect(page.locator('text=Test Lead')).toBeVisible();
    
    // Assign custom role to user
    await page.goto('/settings/users');
    
    const userRow = page.locator('[data-testid="user-row"]').filter({ hasText: 'tester@demo.com' });
    await userRow.locator('[data-testid="edit-user"]').click();
    
    await page.selectOption('[data-testid="user-role-select"]', 'Test Lead');
    await page.click('[data-testid="save-user-changes"]');
    
    // Verify role assignment
    await expect(userRow.locator('[data-testid="user-role-badge"]')).toContainText('Test Lead');
    
    // Logout and login as user with custom role
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout"]');
    
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'tester@demo.com');
    await page.fill('[name="password"]', 'tester123');
    await page.click('button:has-text("Login")');
    
    // Verify custom role is active
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Test Lead');
    
    // Test custom role permissions
    await page.goto('/test-bank');
    await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
    
    // Should be able to create suites (has test-bank-write)
    await page.locator('[data-testid="test-checkbox"]').first().check();
    await page.fill('[data-testid="suite-name-input"]', 'Test Lead Suite');
    
    const createButton = page.locator('[data-testid="create-suite-button"]');
    await expect(createButton).toBeEnabled();
    
    // Should NOT have user management access
    await page.goto('/settings/users');
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 }).catch(async () => {
      expect(page.url()).not.toContain('/settings/users');
    });
  });

  test('Permission verification across features', async () => {
    const roleTests = [
      {
        role: 'Administrator',
        email: 'admin@demo.com',
        password: 'demo123',
        permissions: {
          'test-bank-read': true,
          'test-bank-write': true,
          'test-execution': true,
          'analytics-read': true,
          'analytics-write': true,
          'user-management': true,
          'system-settings': true,
          'audit-logs': true
        }
      },
      {
        role: 'Tester',
        email: 'tester@demo.com',
        password: 'tester123',
        permissions: {
          'test-bank-read': true,
          'test-bank-write': true,
          'test-execution': true,
          'analytics-read': true,
          'analytics-write': false,
          'user-management': false,
          'system-settings': false,
          'audit-logs': false
        }
      },
      {
        role: 'Viewer',
        email: 'viewer@demo.com',
        password: 'viewer123',
        permissions: {
          'test-bank-read': true,
          'test-bank-write': false,
          'test-execution': false,
          'analytics-read': true,
          'analytics-write': false,
          'user-management': false,
          'system-settings': false,
          'audit-logs': false
        }
      }
    ];
    
    for (const roleTest of roleTests) {
      // Login with specific role
      await page.goto('/auth/login');
      await page.fill('[name="email"]', roleTest.email);
      await page.fill('[name="password"]', roleTest.password);
      await page.click('button:has-text("Login")');
      
      // Verify role display
      await expect(page.locator('[data-testid="user-role"]')).toContainText(roleTest.role);
      
      // Test each permission
      for (const [permission, hasAccess] of Object.entries(roleTest.permissions)) {
        switch (permission) {
          case 'test-bank-read':
            await page.goto('/test-bank');
            if (hasAccess) {
              await expect(page.locator('[data-testid="test-bank-page"]')).toBeVisible();
            } else {
              await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 });
            }
            break;
            
          case 'test-bank-write':
            if (hasAccess) {
              await page.goto('/test-bank');
              await page.locator('[data-testid="test-checkbox"]').first().check();
              await expect(page.locator('[data-testid="create-suite-button"]')).toBeEnabled();
            }
            break;
            
          case 'user-management':
            await page.goto('/settings/users');
            if (hasAccess) {
              await expect(page.locator('[data-testid="user-management"]')).toBeVisible();
            } else {
              await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 }).catch(() => {
                expect(page.url()).not.toContain('/settings/users');
              });
            }
            break;
            
          case 'system-settings':
            await page.goto('/settings/system');
            if (hasAccess) {
              await expect(page.locator('[data-testid="system-settings"]')).toBeVisible();
            } else {
              await expect(page.locator('[data-testid="access-denied"]')).toBeVisible({ timeout: 5000 }).catch(() => {
                expect(page.url()).not.toContain('/settings/system');
              });
            }
            break;
        }
      }
      
      // Logout for next role test
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout"]');
    }
  });

  test('Audit trail generation for role changes', async () => {
    // Login as Admin
    await page.goto('/auth/login');
    await page.fill('[name="email"]', 'admin@demo.com');
    await page.fill('[name="password"]', 'demo123');
    await page.click('button:has-text("Login")');
    
    // Navigate to audit logs
    await page.goto('/settings/audit');
    
    // Record initial audit count
    const initialAuditCount = await page.locator('[data-testid="audit-entry"]').count();
    
    // Make role changes that should generate audit entries
    await page.goto('/settings/users');
    
    const userRow = page.locator('[data-testid="user-row"]').filter({ hasText: 'tester@demo.com' });
    await userRow.locator('[data-testid="edit-user"]').click();
    
    // Change user role
    await page.selectOption('[data-testid="user-role-select"]', 'Viewer');
    await page.click('[data-testid="save-user-changes"]');
    
    // Create a new user
    await page.click('[data-testid="create-user"]');
    await page.fill('[data-testid="new-user-email"]', 'audit-test@demo.com');
    await page.fill('[data-testid="new-user-name"]', 'Audit Test User');
    await page.selectOption('[data-testid="new-user-role"]', 'Tester');
    await page.click('[data-testid="save-user"]');
    
    // Check audit trail
    await page.goto('/settings/audit');
    
    // Wait for audit entries to be updated
    await page.waitForTimeout(2000);
    
    const finalAuditCount = await page.locator('[data-testid="audit-entry"]').count();
    expect(finalAuditCount).toBeGreaterThan(initialAuditCount);
    
    // Verify specific audit entries
    const recentAudits = page.locator('[data-testid="audit-entry"]').first();
    
    // Should contain information about role changes
    await expect(recentAudits).toContainText(/role change|user created|permission modified/i);
    
    // Verify audit entry structure
    await expect(recentAudits.locator('[data-testid="audit-timestamp"]')).toBeVisible();
    await expect(recentAudits.locator('[data-testid="audit-user"]')).toContainText('admin@demo.com');
    await expect(recentAudits.locator('[data-testid="audit-action"]')).toBeVisible();
    
    // Test audit filtering
    await page.selectOption('[data-testid="audit-filter"]', 'user_management');
    await page.waitForTimeout(1000);
    
    // Verify filtered results only show user management actions
    const filteredAudits = page.locator('[data-testid="audit-entry"]');
    const auditCount = await filteredAudits.count();
    
    for (let i = 0; i < Math.min(auditCount, 5); i++) {
      const auditText = await filteredAudits.nth(i).textContent();
      expect(auditText).toMatch(/user|role|permission/i);
    }
  });

  test.afterEach(async () => {
    await page.close();
  });
});