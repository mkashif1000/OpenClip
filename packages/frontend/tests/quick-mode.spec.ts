import { test, expect, type Page } from '@playwright/test';

async function openQuick(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/tests/quick-mode.html');
  await expect(page.getByText('2 clips ready', { exact: true })).toBeVisible();
}
const saved = (page: Page) => page.evaluate(() => (window as any).quickTest.saved());
const state = (page: Page) => page.evaluate(() => (window as any).quickTest.state());

test('transcript wording, AI finder with existing clips, and non-destructive invalid input', async ({ page }) => {
  await openQuick(page);
  await expect(page.getByRole('heading', { name: 'Find clips with AI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy Prompt' })).toBeEnabled();
  await expect(page.getByText('How would you like to find your clips?', { exact: true })).toHaveCount(0);
  const ai = await page.getByRole('heading', { name: 'Find clips with AI' }).boundingBox();
  const shortlist = await page.getByText('Your shortlist', { exact: true }).boundingBox();
  expect(ai!.y).toBeLessThan(shortlist!.y);
  await page.locator('summary').filter({ hasText: 'Find automatically' }).click();
  await page.getByRole('button', { name: 'Find again', exact: true }).click();
  await expect(page.getByLabel('AI clip reply')).toBeVisible();
  await page.getByLabel('AI clip reply').fill('[]');
  await page.getByRole('button', { name: 'Load Clips', exact: true }).click();
  await expect(page.getByText('2 clips ready', { exact: true })).toBeVisible();
  expect((await saved(page)).clips).toHaveLength(2);
  await page.getByRole('button', { name: 'Transcript', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add your transcript once.' })).toBeVisible();
  await expect(page.getByText('Transcript ready', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Regenerate transcript' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SRT' }).click();
  expect((await download).suggestedFilename()).toBe('transcript.srt');
});

test('AI reply reload keeps the finder visible and continues to Style', async ({ page }) => {
  await openQuick(page);
  await page.getByLabel('AI clip reply').fill(JSON.stringify([{ title: 'Fresh AI suggestion', start: '00:00:00', end: '00:00:04' }]));
  await page.getByRole('button', { name: 'Load Clips', exact: true }).click();
  await expect(page.getByText('Loaded 1 clip.', { exact: true })).toBeVisible();
  await expect(page.locator('.quick-workspace .lucide-star, .quick-workspace .lucide-sparkles, .quick-workspace .lucide-wand, .quick-workspace .lucide-wand-2, .quick-workspace .lucide-wand-sparkles')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Find clips with AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Style', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Live style preview' })).toBeVisible();
});

test('premade and saved preview layouts match applied styles without overwriting quality', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openQuick(page);
  await page.getByRole('button', { name: 'Open style', exact: true }).click();
  await expect(page.locator('[data-preview-layout] video').first()).toBeVisible();
  await page.getByRole('button', { name: 'Use Clean Captions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use Clean Captions', exact: true })).toHaveAttribute('data-template-card', 'podcast');
  await expect(page.getByRole('heading', { name: 'Creator Styles', exact: true })).toBeVisible();
  expect(await page.locator('[data-template-card="creator"]').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Use Title + Captions', exact: true }).click();
  expect((await state(page)).clips[0].edits.customTitle).toBe('My custom headline');
  await page.getByRole('button', { name: 'Use Boxed Video', exact: true }).click();
  await expect(page.locator('[data-preview-layout]')).toHaveAttribute('data-preview-layout', 'boxed');
  expect((await saved(page)).clips[0].edits.layout).toBe('split-2v');
  await page.getByRole('button', { name: /Saved templates/ }).click();
  await page.getByRole('button', { name: 'Use Saved Split', exact: true }).click();
  await expect(page.locator('[data-preview-layout]')).toHaveAttribute('data-preview-layout', 'split-2h');
  await page.getByRole('button', { name: 'Use Saved Brand', exact: true }).click();
  await page.getByLabel('Preview clip', { exact: true }).selectOption('quick-two');
  await page.screenshot({ path: info.outputPath('quick-style-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Apply style & continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Render and save your clips.' })).toBeVisible();
  const result = await saved(page);
  expect(result.styles.export).toMatchObject({ width: 1080, height: 1920, crf: 18, box_width: 76 });
  expect(result.styles.subtitle.preset).toBe('minimal');
  expect(result.clips[0].edits).toMatchObject({ customTitle: 'My custom headline', layout: 'boxed', cutRanges: [{ start: 1, end: 1.2 }] });
  expect(result.clips[0].edits.titleFont).toBeUndefined();
  expect((await state(page)).assignments['quick-one']).toBeNull();
  expect(errors).toEqual([]);
});

function silentWav(): Buffer {
  const data = Buffer.alloc(44 + 8000 * 2);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24); data.writeUInt32LE(16000, 28); data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(data.length - 44, 40);
  return data;
}

test('audio and logo import, preview, replacement, removal and persistence', async ({ page }) => {
  await openQuick(page);
  await page.getByRole('button', { name: 'Open style', exact: true }).click();
  await page.locator('input[type=file][aria-label="Import background audio"]').setInputFiles({ name: 'background.wav', mimeType: 'audio/wav', buffer: silentWav() });
  await expect(page.getByLabel('Background audio track')).not.toHaveValue('');
  await expect(page.getByLabel('Background audio volume')).toBeEnabled();
  await page.getByLabel('Background audio volume').fill('25');
  await expect.poll(async () => (await saved(page)).music_tracks[0].volume).toBe(0.25);
  const logo = { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64') };
  await page.getByLabel('Import logo', { exact: true }).setInputFiles(logo);
  await expect(page.getByRole('img', { name: 'Current brand logo' })).toBeVisible();
  const firstId = (await saved(page)).logo_config.file_id;
  await expect(page.getByLabel('Logo X position')).toBeEnabled();
  await page.getByLabel('Logo X position').fill('70');
  await expect.poll(async () => (await saved(page)).logo_config.x).toBe(70);
  await page.getByLabel('Import logo', { exact: true }).setInputFiles({ ...logo, name: 'replacement.png' });
  await expect.poll(async () => (await saved(page)).logo_config.file_id).not.toBe(firstId);
  await expect(page.getByRole('button', { name: 'Remove logo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Open style', exact: true }).click();
  await expect(page.getByLabel('Logo X position')).toHaveValue('70');
  await expect(page.getByLabel('Background audio volume')).toHaveValue('25');
  await page.getByRole('button', { name: 'Remove logo' }).click();
  await expect(page.getByRole('button', { name: 'Add logo', exact: true })).toBeVisible();
  await expect(page.getByLabel('Background audio track')).toBeEnabled();
  await page.getByLabel('Background audio track').selectOption('');
  await expect.poll(async () => (await saved(page)).music_tracks[0].selected).toBe(false);
  expect((await saved(page)).logo_config).toBeUndefined();
});

test('mobile Style has no horizontal overflow and keeps branding controls accessible', async ({ page }, info) => {
  await openQuick(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open style', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Live style preview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: /Saved templates/ }).click();
  await page.getByRole('button', { name: 'Use Saved Brand', exact: true }).click();
  await page.getByRole('button', { name: 'Add logo', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Add logo', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('quick-style-mobile.png'), fullPage: true });
});

test('shared gallery cards retain the Advanced template editor interaction', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open workspace', exact: true }).first().click();
  await page.getByRole('button', { name: 'Advanced mode', exact: true }).click();
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Templates', exact: true }).click();
  const card = page.locator('[data-template-card="podcast"]').filter({ hasText: 'Boxed Video' });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('region', { name: 'Boxed Video', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Templates', exact: true })).toBeVisible();
});
