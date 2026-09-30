import { expect, test, type Page } from '@playwright/test';

const selector = (page: Page) => page.getByLabel('Preview template', { exact: true });
const preview = (page: Page) => page.getByRole('region', { name: 'Import live preview' });
const state = (page: Page) => page.evaluate(() => (window as any).importTest.state());
const saved = (page: Page) => page.evaluate(() => (window as any).importTest.saved());
const captions = (page: Page) => preview(page).locator('canvas[aria-label="Captions"]');

async function openImport(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/tests/import-template.html');
  await expect(selector(page).locator('option[value="saved:saved-box"]')).toHaveCount(1);
  await expect(preview(page).locator('video').first()).toBeVisible();
  await expect(captions(page)).toBeVisible();
}

test('both libraries replace the sliders and premade/saved choices change actual preview rendering', async ({ page }, info) => {
  await openImport(page);
  await expect(page.getByText('Subtitle Settings', { exact: true })).toHaveCount(0);
  const count = await page.evaluate(() => (window as any).importTest.presetCount);
  await expect(selector(page).locator('optgroup').first().locator('option')).toHaveCount(count);
  await expect(selector(page).locator('optgroup').last().locator('option')).toHaveCount(3);
  const before = await saved(page);
  await selector(page).selectOption('pod_clean_captions');
  await expect(preview(page).getByText('Clean Captions', { exact: true })).toBeVisible();
  // Disabled titles retain their canvas node but draw no pixels.
  await expect.poll(() => preview(page).locator('canvas[aria-label="Keep my custom headline"]').evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  })).toBe(false);
  const cleanCaption = await captions(page).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await selector(page).selectOption('pod_boxed_video');
  await expect(preview(page).locator('[data-preview-layout]')).toHaveAttribute('data-preview-layout', 'boxed');
  await expect(preview(page).locator('canvas[aria-label="Keep my custom headline"]')).toBeVisible();
  await expect.poll(() => captions(page).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).not.toBe(cleanCaption);
  await selector(page).selectOption('saved:saved-box');
  await expect(preview(page).getByText('Saved Brand', { exact: true })).toBeVisible();
  // Check the rendered inset geometry, not just the selected label.
  const boxWidth = await preview(page).locator('video').evaluate((video) => {
    const box = video.parentElement!;
    return box.getBoundingClientRect().width / box.parentElement!.getBoundingClientRect().width;
  });
  expect(boxWidth).toBeCloseTo(.64, 2);
  await page.screenshot({ path: info.outputPath('import-template-desktop.png'), fullPage: true });
  expect((await saved(page)).clips).toEqual(before.clips);
  expect((await saved(page)).styles).toEqual(before.styles);
});

test('saved split and PIP layouts render, apply persists styles, and project preview uses fresh clip edits', async ({ page }) => {
  await openImport(page);
  await selector(page).selectOption('saved:saved-split');
  await expect(preview(page).locator('[data-preview-layout]')).toHaveAttribute('data-preview-layout', 'split-2h');
  await expect(preview(page).locator('video')).toHaveCount(2);
  await selector(page).selectOption('saved:saved-pip');
  await expect(preview(page).locator('[data-preview-layout]')).toHaveAttribute('data-preview-layout', 'pip');
  await expect(preview(page).locator('video')).toHaveCount(2);
  await selector(page).selectOption('saved:saved-split');
  await page.getByRole('button', { name: 'Apply to all clips', exact: true }).click();
  await expect(page.getByText('Applied Saved Split to 2 clips.', { exact: true })).toBeVisible();
  const result = await saved(page);
  expect(result.styles.export).toMatchObject({ width: 1080, height: 1920, crf: 18 });
  expect(result.styles.subtitle).toMatchObject({ preset: 'minimal', primary_color: '#00FF00' });
  expect(result.clips[0].edits).toMatchObject({ layout: 'split-2h', layoutRange: { start: 0, end: 3 }, customTitle: 'Keep my custom headline', cutRanges: [{ start: 1, end: 1.2 }] });
  expect(result.clips[0].edits.regionCrops).toHaveLength(2);
  expect(result.clips[0].edits.titleFont).toBeUndefined();
  expect((await state(page)).assignments['import-one']).toBeNull();
  await selector(page).selectOption('');
  await expect(preview(page).locator('video')).toHaveCount(2);
  await page.evaluate(() => (window as any).importTest.editTitle());
  await expect(preview(page).locator('canvas[aria-label="Freshly edited headline"]')).toBeVisible();
  await preview(page).getByRole('button', { name: 'Next Clip' }).click();
  await expect(preview(page).locator('canvas[aria-label="Second custom headline"]')).toBeVisible();
});

test('source-only sample previews selected templates and stays responsive', async ({ page }, info) => {
  await openImport(page);
  await page.evaluate(() => (window as any).importTest.clearClips());
  await selector(page).selectOption('pod_boxed_video');
  await expect(preview(page).locator('video')).toBeVisible();
  await expect(preview(page).locator('canvas[aria-label="Your next great clip"]')).toBeVisible();
  await expect(page.getByText('Previewing a sample. Load clips to apply this template.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply to all clips' })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await selector(page).scrollIntoViewIfNeeded();
  await expect(selector(page)).toBeVisible();
  const bounds = await selector(page).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('import-template-mobile.png'), fullPage: true });
});

test('saved library refresh and project switching do not leak preview choices', async ({ page }) => {
  await openImport(page);
  await page.evaluate(() => (window as any).importTest.addSaved());
  await page.getByRole('button', { name: 'Refresh saved templates' }).click();
  await expect(selector(page).locator('option[value="saved:new-template"]')).toHaveCount(1);
  await selector(page).selectOption('saved:new-template');
  await page.evaluate(() => (window as any).importTest.switchProject());
  await expect(selector(page)).toHaveValue('');
  await expect(preview(page).getByText('Current project style', { exact: true })).toBeVisible();
});

test('template writes are atomic and applying is locked during export', async ({ page }) => {
  await openImport(page);
  const before = await saved(page);
  expect(await page.evaluate(() => (window as any).importTest.failTransaction())).toBe('aborted');
  const after = await saved(page);
  expect(after.clips).toEqual(before.clips);
  expect(after.styles).toEqual(before.styles);
  await selector(page).selectOption('pod_boxed_video');
  await page.evaluate(() => (window as any).importTest.processing(true));
  await expect(page.getByRole('button', { name: 'Apply to all clips' })).toBeDisabled();
  await expect(page.getByText('Wait for the current export to finish before applying.')).toBeVisible();
});
