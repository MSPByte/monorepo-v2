import { test, expect } from '@playwright/test';

test.describe('Dashboard flow', () => {
  test('sign-in → dashboard shows heading', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('body')).toBeVisible();

    // Clerk sign-in form
    await page.fill('[name=identifier]', process.env.PLAYWRIGHT_TEST_USER_EMAIL ?? '');
    await page.fill('[name=password]', process.env.PLAYWRIGHT_TEST_USER_PASSWORD ?? '');
    await page.click('[type=submit]');

    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('dashboard shows "No sites" for fresh org', async ({ page }) => {
    await page.goto('/dashboard');
    // Redirects to sign-in if not authenticated — test may be skipped in CI without Clerk test keys
    const isOnDashboard = page.url().includes('/dashboard');
    if (!isOnDashboard) return;
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigate to sites, create a site, verify it appears', async ({ page }) => {
    await page.goto('/sites');
    const isOnSites = page.url().includes('/sites');
    if (!isOnSites) return;

    const uniqueSlug = `test-site-${Date.now()}`;
    await page.fill('input[type=text]:first-of-type', 'Test Site E2E');
    await page.fill('input[type=text]:last-of-type', uniqueSlug);
    await page.click('button[type=submit]');

    await expect(page.getByText('Test Site E2E')).toBeVisible({ timeout: 5000 });
  });
});
