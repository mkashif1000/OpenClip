import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = resolve('packages/frontend/tests/fixtures/grid.mp4');

async function openFixture(page: Page) {
  await page.goto('/tests/import-template.html');
  await expect(page.getByLabel('Preview template', { exact: true }).locator('option[value="saved:saved-box"]')).toHaveCount(1);
}

async function dropFiles(page: Page, files: Array<{ name: string; type: string; bytes: number[] }>) {
  const transfer = await page.evaluateHandle(items => {
    const data = new DataTransfer();
    for (const item of items) data.items.add(new File([new Uint8Array(item.bytes)], item.name, { type: item.type }));
    return data;
  }, files);
  await page.locator('.import-source-card').dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

async function expectContentFits(page: Page) {
  const violations = await page.locator('.advanced-import').evaluate(root => {
    const bounds = root.getBoundingClientRect();
    return [...root.querySelectorAll('button, select, textarea, .advanced-step-card, .advanced-side-panel, .import-source-card')]
      .filter(element => element.getClientRects().length)
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.left < bounds.left - 1 || rect.right > bounds.right + 1;
      })
      .map(element => element.getAttribute('aria-label') || element.className);
  });
  expect(violations).toEqual([]);
}

for (const width of [320, 390, 768, 1440]) {
  test(`empty and loaded Import layouts fit ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1050 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
    await page.getByRole('button', { name: 'Advanced mode', exact: true }).click();
    // Use the existing sidebar collapse control when working on small screens.
    if (width < 900) await page.locator('button').filter({ has: page.locator('.lucide-chevron-left') }).click();
    await expect(page.getByRole('heading', { name: 'Set up your clips', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose video', exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Import workflow' }).locator('[aria-current="step"]')).toContainText('Video');
    await expect(page.locator('.advanced-step-card[data-state="pending"]')).toHaveCount(2);
    await expectContentFits(page);
    await page.screenshot({ path: info.outputPath(`import-empty-${width}.png`) });

    await openFixture(page);
    await expect(page.getByRole('region', { name: 'Import live preview' })).toBeVisible();
    await expectContentFits(page);
    await expect(page.getByRole('button', { name: 'Replace Video', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`import-loaded-${width}.png`), fullPage: true });
  });
}

test('validates drops, imports once, and keeps SRT/JSON and provider controls working', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openFixture(page);
  await page.evaluate(() => (window as any).importTest.emptyProject());
  await page.evaluate(() => (window as any).importTest.watchImports());
  const invalid = { name: 'notes.txt', type: 'text/plain', bytes: [65] };
  await dropFiles(page, [invalid]);
  await expect(page.getByRole('alert')).toContainText('Choose an MP4');
  await dropFiles(page, [invalid, invalid]);
  await expect(page.getByRole('alert')).toContainText('one video at a time');
  expect(await page.evaluate(() => (window as any).importTest.importCalls())).toBe(0);
  await dropFiles(page, [{ name: 'recording.mp4', type: 'video/mp4', bytes: Array.from(readFileSync(fixture)) }]);
  await expect(page.getByRole('heading', { name: 'Your video is ready' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).importTest.importCalls())).toBe(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Import workflow' }).locator('[aria-current="step"]')).toContainText('Subtitles');
  await page.getByRole('button', { name: /AssemblyAI Cloud processing/ }).click();
  await expect(page.getByText('Audio is sent to AssemblyAI for transcription.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate AI', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /AI On-device Whisper/ }).click();
  await page.getByLabel('Transcript language', { exact: true }).selectOption('en');
  await expect(page.getByLabel('Transcript language', { exact: true })).toHaveValue('en');
  const srtChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload SRT', exact: true }).click();
  await (await srtChooser).setFiles({ name: 'new-transcript.srt', mimeType: 'text/plain', buffer: Buffer.from('1\n00:00:00,000 --> 00:00:04,000\nA moment worth sharing.\n') });
  await expect(page.getByLabel('AI clip reply', { exact: true })).toBeVisible();
  await page.locator('.advanced-json-import > summary').click();
  const jsonChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose JSON File', exact: true }).click();
  await (await jsonChooser).setFiles({ name: 'clips.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ title: 'First moment', start: '00:00:00', end: '00:00:04' }])) });
  await expect(page.getByRole('heading', { name: 'All set. Make them yours.' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).importTest.importCalls())).toBe(3);
});

test('replacement shows progress, locks repeated drops, and saves only once', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => (window as any).importTest.watchImports('paused'));
  const video = { name: 'replacement.mp4', type: 'video/mp4', bytes: Array.from(readFileSync(fixture)) };
  await dropFiles(page, [video]);
  await expect(page.getByRole('progressbar', { name: 'video import progress' })).toHaveAttribute('aria-valuenow', '37');
  await expect(page.getByRole('button', { name: 'Replace Video', exact: true })).toBeDisabled();
  await dropFiles(page, [video]);
  expect(await page.evaluate(() => (window as any).importTest.importCalls())).toBe(1);
  await page.evaluate(() => (window as any).importTest.releaseImport());
  await expect(page.getByRole('button', { name: 'Replace Video', exact: true })).toBeEnabled();
  await expect(page.locator('.import-source-file')).toContainText('replacement.mp4');
  await expect(page.getByRole('progressbar', { name: 'video import progress' })).toHaveCount(0);
});

test('quota feedback retains the original source and allows retry', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => (window as any).importTest.watchImports('quota'));
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Replace Video', exact: true }).click();
  await (await chooser).setFiles(fixture);
  await expect(page.getByRole('alert')).toContainText('Browser storage is full.');
  await expect(page.getByRole('alert')).toContainText('1.00 GB');
  await expect(page.locator('.import-source-file')).toContainText('grid.mp4');
  await expect(page.getByRole('button', { name: 'Replace Video', exact: true })).toBeEnabled();
  await page.evaluate(() => (window as any).importTest.watchImports());
  const retry = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Replace Video', exact: true }).click();
  await (await retry).setFiles(fixture);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Replace Video', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => (window as any).importTest.importCalls())).toBe(1);
});
