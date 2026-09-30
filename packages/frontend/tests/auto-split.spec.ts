import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/auto-split.html');
  await expect.poll(() => page.evaluate(() => !!(window as any).splitFixture)).toBe(true);
});

test('Process parent and nested toggle persist independently and lock during processing', async ({ page }) => {
  const parent = page.getByRole('checkbox', { name: /Auto-split two faces/ });
  const captions = page.getByRole('checkbox', { name: /Center captions while split/ });
  const tracking = page.getByRole('checkbox', { name: /Auto-center speaker/ });
  await expect(parent).not.toBeChecked();
  await expect(captions).not.toBeChecked();
  await expect(captions).toBeDisabled();
  await expect(tracking).not.toBeChecked();
  await parent.check();
  await expect(captions).toBeEnabled();
  await captions.check();
  await expect(tracking).not.toBeChecked();
  await expect.poll(() => page.evaluate(async () => (await (window as any).splitFixture.saved()).auto_split_center_captions)).toBe(true);
  await parent.uncheck();
  await expect(captions).toBeDisabled();
  await expect(captions).toBeChecked();
  await parent.check();
  await page.evaluate(() => (window as any).splitFixture.processing(true));
  await expect(parent).toBeDisabled();
  await expect(captions).toBeDisabled();
});

test('screen-share toggle works independently and enables the shared caption switch', async ({ page }) => {
  const screen = page.getByRole('checkbox', { name: /Auto-split screen share/ });
  const faces = page.getByRole('checkbox', { name: /Auto-split two faces/ });
  const captions = page.getByRole('checkbox', { name: /Center captions while split/ });
  await expect(screen).not.toBeChecked();
  await screen.check();
  await expect(faces).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Auto-center speaker/ })).not.toBeChecked();
  await expect(captions).toBeEnabled();
  await captions.check();
  await expect.poll(() => page.evaluate(async () => (await (window as any).splitFixture.saved()).auto_split_screen_share)).toBe(true);
  await faces.check(); await screen.uncheck();
  await expect(captions).toBeEnabled();
  await faces.uncheck();
  await expect(captions).toBeDisabled();
  await expect(captions).toBeChecked();
});

test('optional real screen-share reference detects inset and full document', async ({ page }, testInfo) => {
  test.skip(!process.env.OPENCLIP_SCREEN_REFERENCE, 'Set OPENCLIP_SCREEN_REFERENCE to a local screenshot; never copy it into the repo.');
  test.setTimeout(90_000);
  await page.route('**/tests/screen-reference.png', route => route.fulfill({ path: process.env.OPENCLIP_SCREEN_REFERENCE!, contentType: 'image/png' }));
  const { result, detections, preview } = await page.evaluate(() => (window as any).splitFixture.reference('/tests/screen-reference.png'));
  expect(detections.length).toBe(1);
  expect(result, JSON.stringify(detections)).not.toBeNull();
  expect(result.webcam.x).toBeLessThan(.1);
  expect(result.webcam.y).toBeGreaterThan(.55);
  expect(result.crops[0].x).toBeGreaterThan(.37);
  expect(result.crops[0].w).toBeLessThan(.3);
  expect(result.crops[0].x).toBeLessThanOrEqual(.397);
  expect(result.crops[0].x + result.crops[0].w).toBeGreaterThanOrEqual(.644);
  expect(result.splitRatio).toBe(.6);
  await writeFile(testInfo.outputPath('screen-share-preview.png'), Buffer.from(preview.split(',')[1], 'base64'));
});

for (const offscreen of [false, true]) {
  test(`stacked crops and actual seam-centered captions (${offscreen ? 'OffscreenCanvas' : 'HTMLCanvas'})`, async ({ page }) => {
    const result = await page.evaluate(offscreen => (window as any).splitFixture.render({ offscreen }), offscreen);
    expect(result.top).toEqual([180, 20, 20]);
    expect(result.bottom).toEqual([20, 40, 180]);
    expect(Math.abs(result.captionCenter - 320)).toBeLessThanOrEqual(2);
    expect(result.unchanged).toBe(true);
  });
}

for (const duo of [false, true]) {
  test(`caption position restores immediately and supports wrapping (duo=${duo})`, async ({ page }) => {
    const results = await page.evaluate(duo => {
      const f = (window as any).splitFixture.render;
      const text = 'everyone can learn something new today';
      return { split: f({ duo, text }), normal: f({ duo, text, split: false }),
        off: f({ duo, text, center: false }), stale: f({ duo, text, mismatch: true }),
        hidden: f({ duo, enabled: false }) };
    }, duo);
    expect(Math.abs(results.split.captionCenter - 320)).toBeLessThanOrEqual(2);
    expect(results.normal.captionCenter).toBeGreaterThan(430);
    expect(results.off.captionCenter).toEqual(results.normal.captionCenter);
    expect(results.stale.captionCenter).toEqual(results.normal.captionCenter);
    expect(results.hidden.captionCenter).toBeNull();
    expect(Object.values(results).every((result: any) => result.unchanged)).toBe(true);
  });
}
