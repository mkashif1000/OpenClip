import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKFLOW_STEPS } from '../src/components/landing/workflow/workflowData';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(frontend, 'public/workflow');
const viewport = { width: 1280, height: 900 } as const;
type Rect = { x: number; y: number; width: number; height: number };
type Capture = { src: string; width: 1280; height: 900; focus: { x: number; y: number }; target: Rect; label: string };
const forbiddenIcons = '.lucide-sparkles,.lucide-star,.lucide-wand,.lucide-wand-sparkles,.lucide-wand-2';

async function openStage(page: Page, stage: string) {
  await page.goto(`/tests/workflow-capture.html?stage=${stage}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const state = (window as any).workflowCapture;
    return state?.ready || state?.error;
  });
  expect(await page.evaluate(() => (window as any).workflowCapture.error)).toBeUndefined();
  await expect(page.getByRole('button', { name: 'OpenClip home' })).toBeVisible();
  if (['brand', 'render', 'download'].includes(stage)) {
    await expect(page.getByText('3 clips ready', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open style', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Live style preview' })).toBeVisible();
  }
  if (['prompt', 'llm'].includes(stage)) {
    await expect(page.getByRole('button', { name: 'Copy Prompt', exact: true })).toBeEnabled();
    await page.getByLabel('Extra instructions', { exact: true }).fill('Find practical, high-energy moments about the creative process. Keep each clip focused on one useful idea.');
    const numbers = page.locator('input[type="number"]');
    await numbers.nth(0).fill('3');
    await numbers.nth(1).fill('30');
    await numbers.nth(2).fill('60');
  }
}

async function position(page: Page, locator: Locator, top: number) {
  await expect(locator).toBeVisible();
  await locator.evaluate((element, desiredTop) => {
    window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - desiredTop);
  }, top);
}

async function settle(page: Page) {
  await page.mouse.move(1278, 898);
  await expect(page.locator('.animate-spin:visible')).toHaveCount(0, { timeout: 20_000 });
  await page.evaluate(async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    for (const textarea of document.querySelectorAll('textarea')) {
      textarea.scrollTop = 0;
      textarea.scrollLeft = 0;
    }
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
    for (const video of document.querySelectorAll('video')) video.pause();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await page.waitForFunction(() => [...document.querySelectorAll('video')].every((video) => video.readyState >= 2), undefined, { timeout: 15_000 });
  await expect(page.locator('[aria-label="Loading video"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 1280)).toBe(true);
  expect(await page.locator(forbiddenIcons).evaluateAll((icons) => icons.every((icon) => getComputedStyle(icon).visibility === 'hidden'))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).filter)).toBe('grayscale(1)');
}

async function capture(page: Page, id: string, target: Locator, focus: Locator | Locator[]): Promise<Capture> {
  await settle(page);
  const bounds = await target.boundingBox();
  expect(bounds, `${id} main control is measurable`).not.toBeNull();
  const box = bounds!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  const areas = await Promise.all((Array.isArray(focus) ? focus : [focus]).map((locator) => locator.boundingBox()));
  const visible = areas.filter((area): area is Rect => area !== null);
  expect(visible.length).toBeGreaterThan(0);
  const left = Math.max(0, Math.min(...visible.map((area) => area.x)));
  const right = Math.min(viewport.width, Math.max(...visible.map((area) => area.x + area.width)));
  const top = Math.max(70, Math.min(...visible.map((area) => area.y)));
  const bottom = Math.min(viewport.height, Math.max(...visible.map((area) => area.y + area.height)));
  const round = (value: number) => Math.round(value * 100) / 100;
  const file = path.join(destination, `${id}.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'disabled', caret: 'hide', scale: 'css' });
  console.log(`${id}.png: 1280 × 900, ${(await stat(file)).size} bytes; target ${JSON.stringify(box)}`);
  return {
    src: `/workflow/${id}.png`, ...viewport,
    focus: { x: round((left + right) / 2), y: round((top + bottom) / 2) },
    target: { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) },
    label: WORKFLOW_STEPS.find((step) => step.id === id)!.title,
  };
}

test.skip(process.env.CAPTURE_WORKFLOW !== '1', 'Opt-in asset generation: CAPTURE_WORKFLOW=1');

test('capture the seven real OpenClip workflow screens', async ({ page, context }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize(viewport);
  // Stay entirely local, including any font/model requests from real components.
  const externalRequests: string[] = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith('http') && url.origin !== 'http://127.0.0.1:5179') {
      externalRequests.push(`${url.origin}${url.pathname}`);
      await route.abort();
    } else await route.continue();
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir(destination, { recursive: true });
  const captures: Capture[] = [];

  await openStage(page, 'import');
  await expect(page.getByRole('heading', { name: 'Start with your video.' })).toBeVisible();
  const dropzone = page.getByRole('button', { name: /Drop your video here/ });
  captures.push(await capture(page, 'import', dropzone, dropzone));

  await openStage(page, 'transcript');
  await expect(page.getByRole('heading', { name: 'Add your transcript once.' })).toBeVisible();
  const generate = page.getByRole('button', { name: 'Generate transcript', exact: true });
  const local = page.getByRole('button', { name: /On-device Whisper/ });
  const api = page.getByRole('button', { name: /AssemblyAI/ });
  captures.push(await capture(page, 'transcript', generate, [local, api, generate]));

  await openStage(page, 'prompt');
  await position(page, page.getByRole('heading', { name: 'Find clips with AI' }), 105);
  const instructions = page.getByLabel('Extra instructions', { exact: true });
  captures.push(await capture(page, 'prompt', instructions, instructions.locator('..')));

  await openStage(page, 'llm');
  await page.getByLabel('AI clip reply').fill('[\n  { "title": "Start small", "start": "00:00:00", "end": "00:00:30" },\n  { "title": "Make it useful", "start": "00:00:30", "end": "00:01:00" },\n  { "title": "Share the story", "start": "00:01:00", "end": "00:01:30" }\n]');
  await position(page, page.getByText('Run it in a free chatbot', { exact: true }), 250);
  const reply = page.getByLabel('AI clip reply');
  captures.push(await capture(page, 'llm', reply, [page.getByRole('button', { name: 'Copy Prompt', exact: true }), reply]));

  await openStage(page, 'brand');
  await expect(page.getByRole('img', { name: 'Current brand logo' })).toBeVisible();
  const audio = page.getByRole('region', { name: 'Background audio', exact: true });
  const logo = page.getByRole('region', { name: 'Brand logo', exact: true });
  await position(page, audio, 115);
  captures.push(await capture(page, 'brand', page.getByRole('button', { name: 'Import background audio', exact: true }), [audio, logo]));

  await openStage(page, 'render');
  await page.getByRole('button', { name: 'Use Title + Captions', exact: true }).click();
  await page.getByRole('button', { name: 'Apply style & continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Render and save your clips.' })).toBeVisible();
  // Real per-clip template selectors remain visible beside the export action.
  const queue = page.getByRole('heading', { name: 'Active Queue', exact: true }).locator('xpath=ancestor::section[1]');
  const template = queue.locator('select').filter({ has: page.locator('option[value="pod_title_captions"]') }).first();
  await template.selectOption('pod_title_captions');
  const renderButton = page.getByRole('button', { name: 'Process All Clips', exact: true });
  await position(page, page.getByText('Export queue', { exact: true }), 118);
  await renderButton.scrollIntoViewIfNeeded();
  captures.push(await capture(page, 'render', renderButton, [queue, renderButton]));

  await openStage(page, 'download');
  await page.getByRole('button', { name: 'Apply style & continue', exact: true }).click();
  const gallery = page.getByRole('heading', { name: 'Rendered Clips', exact: true }).locator('xpath=ancestor::section[1]');
  await expect(page.getByRole('button', { name: 'Download All (.ZIP)', exact: true })).toBeVisible();
  await position(page, gallery, 150);
  const finishedCards = [0, 1, 2].map((index) => gallery.locator('video').nth(index).locator('../..'));
  captures.push(await capture(page, 'download', page.getByRole('button', { name: 'Download All (.ZIP)', exact: true }), finishedCards));

  expect(captures.map((item) => item.src)).toEqual(WORKFLOW_STEPS.map((step) => `/workflow/${step.id}.png`));
  expect(errors).toEqual([]);
  // Blocked font requests are reported rather than silently contacting a CDN.
  if (externalRequests.length) console.log('External requests blocked:', [...new Set(externalRequests)]);
  const manifest = `/** Generated by tests/workflow-capture.spec.ts from actual QuickModeWorkspace UI.
 * Media, transcript, and completed outputs are synthetic capture-fixture data.
 * Coordinates are measured after final scroll in the 1280 × 900 screenshot.
 */
export interface WorkflowCapture {
  src: string;
  width: 1280;
  height: 900;
  focus: { x: number; y: number };
  target: { x: number; y: number; width: number; height: number };
  label: string;
}

export const WORKFLOW_CAPTURES: readonly WorkflowCapture[] = ${JSON.stringify(captures, null, 2)};
`;
  await writeFile(path.join(frontend, 'src/components/landing/workflow/workflowCaptures.ts'), manifest);
});
