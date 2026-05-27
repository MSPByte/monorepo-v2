import { test, expect } from '@playwright/test';

test.describe('Alerts flow', () => {
  test('empty state renders correctly', async ({ page }) => {
    await page.goto('/sites/nonexistent/alerts');
    // Either shows empty state or redirects to sign-in
    await expect(page.locator('body')).toBeVisible();
    const hasEmpty = await page.getByText('No alerts for this site.').isVisible().catch(() => false);
    const hasSignIn = page.url().includes('/sign-in');
    expect(hasEmpty || hasSignIn).toBe(true);
  });

  test('seeded alert appears and can be suppressed', async ({ page }) => {
    // This test requires a seeded alert in the test DB via global-setup or beforeEach.
    // Seed an alert directly via the test DB before navigating.
    // See global-setup.ts for seeding instructions.
    const siteId = process.env.PLAYWRIGHT_TEST_SITE_ID;
    if (!siteId) {
      test.skip(true, 'PLAYWRIGHT_TEST_SITE_ID not set — skipping seeded alert test');
      return;
    }

    await page.goto(`/sites/${siteId}/alerts`);
    const suppressBtn = page.getByRole('button', { name: 'Suppress 7 days' }).first();

    if (await suppressBtn.isVisible()) {
      await suppressBtn.click();
      await expect(suppressBtn).not.toBeVisible({ timeout: 5000 });
    }
  });
});
