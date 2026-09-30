import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { WORKFLOW_CHAPTER_PREVIEW_FRAME, WORKFLOW_DURATION, WORKFLOW_STEP_FRAMES, WORKFLOW_STEPS, workflowStepAtFrame, workflowTime } from '../src/components/landing/workflow/workflowData';
import { STORY } from '../src/components/landing/workflow/workflowScenes';

async function openWalkthrough(page: Page) {
  await page.goto('/');
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
  await page.locator('#workflow').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Play walkthrough', exact: true })).toBeVisible();
}

test('timeline has seven contiguous, bounded chapters', () => {
  expect(WORKFLOW_DURATION).toBe(1260);
  expect(workflowTime(WORKFLOW_DURATION)).toBe('0:42');
  expect(workflowStepAtFrame(-1)).toBe(0);
  expect(workflowStepAtFrame(WORKFLOW_DURATION)).toBe(6);
  for (let index = 0; index < 7; index++) {
    expect(workflowStepAtFrame(index * WORKFLOW_STEP_FRAMES)).toBe(index);
    expect(workflowStepAtFrame((index + 1) * WORKFLOW_STEP_FRAMES - 1)).toBe(index);
  }
});

test('plays, pauses, seeks, finishes, and replays the Remotion tour', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openWalkthrough(page);
  const video = page.locator('.workflow-video');
  const progress = page.getByRole('slider', { name: 'Walkthrough progress' });
  await expect(video).toHaveAttribute('data-playing', 'false');
  const artwork = page.locator('.workflow-film-active [data-artwork]');
  const initialArtwork = await artwork.innerHTML();
  await page.getByRole('button', { name: 'Play walkthrough', exact: true }).click();
  await page.clock.runFor(1200);
  await expect(video).toHaveAttribute('data-playing', 'true');
  expect(Number(await progress.inputValue())).toBeGreaterThan(30);
  expect(await artwork.innerHTML()).not.toBe(initialArtwork);
  await page.getByRole('button', { name: 'Pause walkthrough', exact: true }).click();
  const paused = await progress.inputValue();
  await page.clock.runFor(600);
  await expect(progress).toHaveValue(paused);
  await progress.fill(String(WORKFLOW_DURATION - 20));
  await expect(page.locator('.workflow-chapter[aria-current]')).toHaveAttribute('aria-label', 'Step 7: Download your videos');
  await page.getByRole('button', { name: 'Play walkthrough', exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: 'Replay walkthrough', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Replay walkthrough', exact: true }).click();
  await page.clock.runFor(400);
  await expect(page.locator('.workflow-chapter[aria-current]')).toHaveAttribute('aria-label', 'Step 1: Import your video');
  await page.getByRole('button', { name: 'Restart walkthrough', exact: true }).click();
  await expect(progress).toHaveValue('0');
  await expect(video).toHaveAttribute('data-playing', 'false');
});

test('all chapters seek while paused; keyboard controls and workspace CTA work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWalkthrough(page);
  for (const [index, step] of WORKFLOW_STEPS.entries()) {
    const chapter = page.getByRole('button', { name: `Step ${index + 1}: ${step.title}`, exact: true });
    await chapter.click();
    await expect(chapter).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('slider', { name: 'Walkthrough progress' })).toHaveValue(String(index * WORKFLOW_STEP_FRAMES + WORKFLOW_CHAPTER_PREVIEW_FRAME));
    await expect(page.locator('#workflow-current')).toContainText(step.description);
    await expect(page.locator('.workflow-video')).toHaveAttribute('data-playing', 'false');
  }
  const first = page.getByRole('button', { name: 'Step 1: Import your video', exact: true });
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Try it with your video', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Start with your video.' })).toBeVisible();
});

test('pauses offscreen and when reduced-motion preference changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await openWalkthrough(page);
  const video = page.locator('.workflow-video');
  await page.getByRole('button', { name: 'Play walkthrough', exact: true }).click();
  await expect(video).toHaveAttribute('data-playing', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(video).toHaveAttribute('data-playing', 'false');
  await page.getByRole('button', { name: 'Play walkthrough', exact: true }).click();
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute('data-playing', 'false');
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute('data-playing', 'false');
});

test('reduced-motion holds the finished scene; normal motion progresses deterministically', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWalkthrough(page);
  const progress = page.getByRole('slider', { name: 'Walkthrough progress' });
  // Reduced motion exposes the finished story without spatial or typing animation.
  await progress.fill('61');
  const artwork = page.locator('.workflow-film-active [data-artwork]');
  const start = await artwork.innerHTML();
  await progress.fill('105');
  expect(await artwork.innerHTML()).toBe(start);
  await expect(artwork).toContainText('Your recording is ready');
  await expect(page.locator('.workflow-canvas img')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await progress.fill('61');
  const moving = await artwork.innerHTML();
  await progress.fill('105');
  expect(await artwork.innerHTML()).not.toBe(moving);
  await progress.fill('61');
  expect(await artwork.innerHTML()).toBe(moving);
});

test('chapter previews are complete and play from the beginning of the selected chapter', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openWalkthrough(page);
  await page.getByRole('button', { name: 'Step 3: Describe your clips', exact: true }).click();
  await expect(page.locator('.workflow-film-active')).toContainText('Make each clip worth sharing.');
  await expect(page.locator('.workflow-film-active')).toContainText('Titles on');
  await page.getByRole('button', { name: 'Play walkthrough', exact: true }).click();
  await page.clock.runFor(300);
  const frame = Number(await page.getByRole('slider', { name: 'Walkthrough progress' }).inputValue());
  expect(frame).toBeGreaterThanOrEqual(2 * WORKFLOW_STEP_FRAMES);
  expect(frame).toBeLessThan(2 * WORKFLOW_STEP_FRAMES + 30);
});

test('each animated chapter settles into its intended result', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openWalkthrough(page);
  const progress = page.getByRole('slider', { name: 'Walkthrough progress' });
  const results = ['Your recording is ready', 'Every word, with timestamps.', 'Titles on', 'Paste the reply. Load your clips.', 'Logo added', '3 clips rendered', '3 videos. Ready to share.'];
  for (let index = 0; index < WORKFLOW_STEPS.length; index++) {
    await progress.fill(String(index * WORKFLOW_STEP_FRAMES + 75));
    await page.locator('.workflow-canvas').screenshot({ path: testInfo.outputPath(`motion-${index + 1}.png`) });
    await progress.fill(String(index * WORKFLOW_STEP_FRAMES + 160));
    await expect(page.locator('.workflow-film-active')).toContainText(results[index]);
  }
});

for (const width of [320, 390, 640, 768, 1024, 1440]) {
  test(`all seven scenes fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1050 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openWalkthrough(page);
    await expect(page.locator('.workflow-video')).toHaveAttribute('data-layout', width < 640 ? 'portrait' : 'landscape');
    for (const [index, step] of WORKFLOW_STEPS.entries()) {
      const progress = page.getByRole('slider', { name: 'Walkthrough progress' });
      await progress.fill(String(index * WORKFLOW_STEP_FRAMES + 165));
      await expect(page.locator('#workflow-current h3')).toHaveText(step.title);
      await expect(page.locator('.workflow-canvas [data-scene]')).toHaveAttribute('data-scene', step.id);
      await expect(page.locator('.workflow-film-active .workflow-film-title')).toHaveText(STORY[index].title);
      const clipped = await page.locator('.workflow-canvas').evaluate((canvas) => {
        const failures: string[] = [];
        const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (!node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          let parent = node.parentElement;
          let hidden = false;
          while (parent && parent !== canvas) {
            if (getComputedStyle(parent).opacity === '0') { hidden = true; break; }
            parent = parent.parentElement;
          }
          if (hidden) continue;
          parent = node.parentElement;
          while (parent) {
            if (getComputedStyle(parent).overflow === 'hidden' || parent === canvas) {
              const bounds = parent.getBoundingClientRect();
              if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2 || rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2) {
                failures.push(node.textContent.trim());
                break;
              }
            }
            if (parent === canvas) break;
            parent = parent.parentElement;
          }
        }
        return failures;
      });
      expect(clipped, `Clipped text in ${step.title} at ${width}px`).toEqual([]);
      if (width === 390 || width === 1440) {
        await page.locator('.workflow-player-shell').screenshot({ path: testInfo.outputPath(`scene-${index + 1}-${width}.png`) });
      }
    }
    const bounds = (await page.locator('.workflow-player-shell').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await expect(page.locator('#workflow .lucide-sparkles, #workflow .lucide-star, #workflow .lucide-wand-sparkles')).toHaveCount(0);
    const screenshot = PNG.sync.read(await page.locator('.workflow-player-shell').screenshot());
    let coloredPixels = 0;
    for (let pixel = 0; pixel < screenshot.data.length; pixel += 4) {
      if (Math.max(screenshot.data[pixel], screenshot.data[pixel + 1], screenshot.data[pixel + 2]) - Math.min(screenshot.data[pixel], screenshot.data[pixel + 1], screenshot.data[pixel + 2]) > 2) coloredPixels++;
    }
    expect(coloredPixels).toBe(0);
    await page.locator('#workflow').screenshot({ path: testInfo.outputPath(`workflow-${width}.png`) });
  });
}
