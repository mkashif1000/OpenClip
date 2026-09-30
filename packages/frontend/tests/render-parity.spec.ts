import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const cases = [
  'preset=karaoke', 'preset=pop', 'preset=box', 'preset=minimal',
  'preset=box&zero&normal', 'preset=pop&transparent',
  'layout=pip&preset=box', 'layout=hybrid&frame=12', 'layout=hybrid&frame=27',
  'layout=split-2v', 'layout=split-2h&custom', 'layout=split-3&width=362',
  'layout=split-4', 'layout=gameplay', 'layout=boxed',
  'layout=split-2h&range&frame=27', 'width=1080&height=1920&defaults',
  'width=640&height=360&defaults&transparent',
  ...['classic', 'punch', 'paper', 'mint', 'cyan', 'violet', 'editorial', 'red',
    'film', 'word', 'sunset', 'soft', 'blue', 'slant', 'mono', 'pink'].map((id) => `look=${id}`),
  'preset=plain&advanced', 'preset=word&advanced&align=right', 'hidden',
  ...['headline', 'newsroom', 'editorial', 'violet', 'electric', 'yellow', 'red', 'white', 'paper',
    'rose', 'mono', 'midnight', 'outline', 'purple', 'cinema'].map((id) => `titleLook=${id}`),
  'titleLook=cinema&titleAdvanced',
];

for (const query of cases) {
  test(`preview matches export: ${query}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`/tests/render-parity.html?${query}`);
    await expect(page.locator('video').first()).toBeVisible();
    await page.evaluate(() => (window as any).seek());
    await expect.poll(() => page.evaluate(() => {
      const { sourceTime } = (window as any).fixture;
      return [...document.querySelectorAll('video')].every((v) => v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - sourceTime) < 0.05);
    })).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    // Wait for the logo's asynchronous image load and paused-frame paint.
    await expect.poll(() => page.evaluate(() => {
      const c = document.querySelector('canvas[aria-label="Logo"]') as HTMLCanvasElement;
      return c && c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some((x) => x > 0);
    })).toBe(true);
    const preview = await page.getByTestId('preview').screenshot({ path: testInfo.outputPath('preview.png') });
    const exported = await page.evaluate(() => (window as any).renderExport());
    await writeFile(testInfo.outputPath('export.png'), Buffer.from(exported.split(',')[1], 'base64'));
    const a = PNG.sync.read(preview);
    const b = PNG.sync.read(Buffer.from(exported.split(',')[1], 'base64'));
    const diffImage = new PNG({ width: a.width, height: a.height });
    const diff = pixelmatch(a.data, b.data, diffImage.data, a.width, a.height,
      { threshold: 0.15, includeAA: false }) / (a.width * a.height);
    await writeFile(testInfo.outputPath('diff.png'), PNG.sync.write(diffImage));
    await testInfo.attach('preview', { body: preview, contentType: 'image/png' });
    await testInfo.attach('export', { body: Buffer.from(exported.split(',')[1], 'base64'), contentType: 'image/png' });
    // CSS video and drawImage resample fractional crops differently. The grid
    // bounds those edge differences to 2%; overlays have a separate 0.1% limit.
    expect(diff, 'video geometry and composited frame').toBeLessThan(0.02);
    const offscreen = await page.evaluate(() => (window as any).renderExport(true));
    expect(PNG.sync.read(Buffer.from(offscreen.split(',')[1], 'base64')).data.equals(b.data)).toBe(true);
    await page.locator('video').evaluateAll((videos) => videos.forEach((v) => { v.style.opacity = '0'; }));
    const overlayPreview = PNG.sync.read(await page.getByTestId('preview').screenshot());
    const overlayExportUrl = await page.evaluate(() => (window as any).renderExport(false, true));
    const overlayExport = PNG.sync.read(Buffer.from(overlayExportUrl.split(',')[1], 'base64'));
    const overlayDiff = pixelmatch(overlayPreview.data, overlayExport.data, null, a.width, a.height,
      { threshold: 0.05, includeAA: true }) / (a.width * a.height);
    expect(overlayDiff, 'captions, title and logo positions/colors').toBeLessThan(0.001);
    if (query === 'preset=karaoke' || query === 'preset=box&zero&normal' || query.includes('look=') || query.includes('advanced') || query.includes('titleLook=')) {
      const workerUrl = await page.evaluate(() => (window as any).renderWorkerOverlay());
      const workerPixels = PNG.sync.read(Buffer.from(workerUrl.split(',')[1], 'base64'));
      expect(pixelmatch(workerPixels.data, overlayExport.data, null, a.width, a.height,
        { threshold: 0.05, includeAA: true }) / (a.width * a.height), 'worker font metrics and overlays').toBeLessThan(0.001);
    }
    expect(errors).toEqual([]);
  });
}

test('layout geometry and zero-valued style settings stay stable', async ({ page }) => {
  await page.goto('/tests/render-parity.html');
  const result = await page.evaluate(() => {
    const g = (window as any).geometry;
    const regions = g.getSplitRegions('split-3').map((r: any) => g.getRegionRect(r.out, 362, 640));
    return { regions, title: g.resolveTitleStyle({}, 1080, 1920),
      subtitle: g.resolveSubtitleStyle({ marginV: 0, outlineWidth: 0 }, 1080, 1920) };
  });
  expect(result.regions).toEqual([
    { x: 0, y: 0, w: 121, h: 640 }, { x: 121, y: 0, w: 120, h: 640 }, { x: 241, y: 0, w: 121, h: 640 },
  ]);
  expect(result.title.fontSize).toBe(32);
  expect(result.subtitle.fontSize).toBe(62);
  expect(result.subtitle.marginV).toBe(0);
  expect(result.subtitle.outlineWidth).toBe(0);
});
