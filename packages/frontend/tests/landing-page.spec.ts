import { test, expect } from '@playwright/test';

test('landing page opens Quick Mode and exposes the Advanced workspace escape hatch', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  // 1. Verify Landing Page is visible
  await expect(page.getByText('Turn long videos into')).toBeVisible();
  await expect(page.getByText('clips people watch.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open workspace' }).first()).toBeVisible();

  // 2. Click "Open workspace" button to enter Quick Mode
  await page.getByRole('button', { name: 'Open workspace' }).first().click();

  // 3. Verify workspace header is revealed
  await expect(page.getByText('OpenClip', { exact: true })).toBeVisible();
  await expect(page.locator('header').getByText('Local AI editor', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Landing page/i })).toHaveCount(0);

  // 4. Quick Mode starts with a guided source step, not the Advanced sidebar.
  await expect(page.getByRole('heading', { name: 'Start with your video.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose video' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Advanced mode', exact: true })).toBeVisible();

  // 5. The navbar logo returns to the landing page.
  await page.locator('header').getByRole('button', { name: 'OpenClip home' }).click();
  await expect(page.getByText('Turn long videos into')).toBeVisible();

  // No unhandled page errors
  expect(errors).toEqual([]);
});
