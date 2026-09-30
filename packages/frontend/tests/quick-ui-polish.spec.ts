import { expect, test, type Page, type TestInfo } from '@playwright/test';

const starIcons = '.lucide-star, .lucide-stars, .lucide-sparkle, .lucide-sparkles, .lucide-wand, .lucide-wand-2, .lucide-wand-sparkles';

async function checkScreen(page: Page, info: TestInfo, name: string) {
  await expect(page.locator('.quick-workspace')).toBeVisible();
  // Hidden shared panels count too: there must not be a star waiting to appear.
  await expect(page.locator(`.quick-workspace :is(${starIcons})`)).toHaveCount(0);
  // Check interface colors, without desaturating the user's footage or templates.
  for (const selector of ['.quick-workspace', '.quick-icon', '.quick-kicker', '.quick-workspace .text-success']) {
    const colors = await page.locator(selector).evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
    for (const color of colors) {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(1);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const panel of await page.locator('.quick-workspace .animate-rise').all()) {
    await expect(panel).toHaveCSS('opacity', '1');
  }
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

for (const width of [1440, 768, 390, 320]) {
  test(`all five Quick Mode steps are polished and star-free at ${width}px`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/tests/quick-mode.html');
    await expect(page.getByText('2 clips ready', { exact: true })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Quick Mode progress' });

    await nav.getByRole('button', { name: /Import$/ }).click();
    await expect(page.getByText('Video ready', { exact: true })).toBeVisible();
    await expect(page.getByText('grid.mp4', { exact: true })).toBeVisible();
    await checkScreen(page, info, '01-import');

    await nav.getByRole('button', { name: /Transcript$/ }).click();
    await expect(page.getByRole('button', { name: 'Regenerate transcript', exact: true })).toBeVisible();
    await checkScreen(page, info, '02-transcript');
    await page.getByRole('button', { name: /AssemblyAI/ }).click();
    await expect(page.getByText(/AssemblyAI needs your own API key/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Regenerate transcript', exact: true })).toBeDisabled();
    await checkScreen(page, info, '02-cloud-transcript');

    await nav.getByRole('button', { name: /Find clips$/ }).click();
    await page.locator('summary').filter({ hasText: 'Find automatically' }).click();
    await expect(page.getByRole('heading', { name: 'Automatic clip finder', exact: true })).toBeVisible();
    await checkScreen(page, info, '03-local-clips');
    await page.locator('summary').filter({ hasText: 'Find automatically' }).click();
    await expect(page.getByRole('button', { name: 'Copy Prompt', exact: true })).toBeEnabled();
    await checkScreen(page, info, '03-ai-clips');

    await page.getByRole('button', { name: 'Open style', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Live style preview' }).locator('video').first()).toBeVisible();
    await page.getByRole('button', { name: 'Use Boxed Video', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use Boxed Video', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await checkScreen(page, info, '04-style');
    await page.getByRole('button', { name: /Saved templates/ }).click();
    await page.getByRole('button', { name: 'Use Saved Brand', exact: true }).click();
    await checkScreen(page, info, '04-saved-style');

    await page.getByRole('button', { name: 'Apply style & continue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Render and save your clips.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Process All Clips', exact: true })).toBeEnabled();
    await checkScreen(page, info, '05-export');
    await page.getByRole('button', { name: 'Favorite clip', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Remove favorite', exact: true })).toBeVisible();
    await page.getByLabel('Filter clips', { exact: true }).selectOption('favorite');
    await expect(page.getByLabel('Select clip 1', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Select clip 2', { exact: true })).toHaveCount(0);
    await expect(page.locator(`.quick-workspace :is(${starIcons})`)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('empty import keeps its file picker and readable focus state', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open workspace', exact: true }).first().click();
  await checkScreen(page, info, 'import-empty-desktop');
  const choose = page.getByRole('button', { name: /Choose video/ });
  await choose.focus();
  await expect(choose).toBeFocused();
  const picker = page.waitForEvent('filechooser');
  await choose.press('Enter');
  expect((await picker).isMultiple()).toBe(false);
  await page.setViewportSize({ width: 320, height: 844 });
  await checkScreen(page, info, 'import-empty-mobile');
  await expect(page.getByRole('button', { name: 'Continue to transcript', exact: true })).toBeDisabled();
});
