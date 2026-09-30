import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1050 } });

test('toolkit demos change captions, framing, and a reversible filler cut', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#features');
  await expect(page.locator('#features')).toHaveCount(1);
  await expect(page.locator('#privacy')).toHaveCount(1);
  const captions = page.getByRole('group', { name: 'Caption style preview' });
  for (const look of ['Pop', 'Minimal', 'Karaoke']) {
    const button = captions.getByRole('button', { name: look, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#toolkit-caption-preview')).toHaveAttribute('data-caption-look', look.toLowerCase());
    await expect(captions.locator('[aria-pressed="true"]')).toHaveCount(1);
  }
  const layouts = page.getByRole('group', { name: 'Video layout preview' });
  for (const [name, value] of [['Vertical', 'vertical'], ['PIP (picture-in-picture)', 'pip'], ['Split', 'split']]) {
    await layouts.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#toolkit-layout-preview')).toHaveAttribute('data-layout-look', value);
    await expect(layouts.locator('[aria-pressed="true"]')).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'Remove filler', exact: true }).click();
  await expect(page.locator('.toolkit-edit')).toHaveAttribute('data-trimmed', 'true');
  await expect(page.locator('.toolkit-filler')).toHaveCSS('opacity', '0');
  await expect(page.locator('.toolkit-edit-status')).toContainText('Filler removed');
  await page.getByRole('button', { name: 'Undo cut', exact: true }).press('Enter');
  await expect(page.locator('.toolkit-edit')).toHaveAttribute('data-trimmed', 'false');
  await expect(page.locator('.toolkit-filler')).toHaveCSS('opacity', '1');
  expect(errors).toEqual([]);
});

test('motion pauses on request, offscreen, and when the preference changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#features');
  const section = page.locator('#features');
  const word = page.locator('.toolkit-caption-word').first();
  await page.locator('.toolkit-captions').scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('data-running', 'true');
  await expect(word).toHaveCSS('animation-play-state', 'running');
  await page.getByRole('button', { name: 'Pause feature previews', exact: true }).click();
  await expect(section).toHaveAttribute('data-running', 'false');
  await expect(word).toHaveCSS('animation-play-state', 'paused');
  await expect(page.locator('.toolkit-local-connector').first()).toHaveCSS('animation-play-state', 'paused');
  await page.getByRole('button', { name: 'Resume feature previews', exact: true }).click();
  await expect(section).toHaveAttribute('data-running', 'true');
  await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('data-running', 'false');
  await page.locator('.toolkit-captions').scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute('data-running', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(section).toHaveAttribute('data-running', 'false');
  await expect(page.locator('.toolkit-motion-toggle')).toBeDisabled();
  await expect(word).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Pop', exact: true }).click();
  await expect(word).toHaveCSS('text-transform', 'uppercase');
  await expect(page.locator('.toolkit-captions')).toHaveCSS('opacity', '1');
});

test('offscreen mobile cards pause even while the section is visible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#features');
  await page.locator('.toolkit-captions').scrollIntoViewIfNeeded();
  await expect(page.locator('#features')).toHaveAttribute('data-running', 'true');
  await expect(page.locator('.toolkit-captions')).toHaveAttribute('data-in-view', 'true');
  await expect(page.locator('.toolkit-edit')).toHaveAttribute('data-in-view', 'false');
  await expect(page.locator('.toolkit-playhead')).toHaveCSS('animation-play-state', 'paused');
  await page.locator('.toolkit-edit').scrollIntoViewIfNeeded();
  await expect(page.locator('.toolkit-edit')).toHaveAttribute('data-in-view', 'true');
  await expect(page.locator('.toolkit-playhead')).toHaveCSS('animation-play-state', 'running');
  await expect(page.locator('.toolkit-captions')).toHaveAttribute('data-in-view', 'false');
  await expect(page.locator('.toolkit-caption-word').first()).toHaveCSS('animation-play-state', 'paused');
});

for (const width of [320, 375, 699, 700, 768, 1024, 1440]) {
  test(`toolkit content and controls fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1050 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#features');
    await page.locator('#toolkit-heading').scrollIntoViewIfNeeded();
    await expect(page.locator('#features')).toHaveAttribute('data-seen', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const invalidBounds = await page.locator('.toolkit-card').evaluateAll(cards => cards.flatMap(card => {
      const bounds = card.getBoundingClientRect();
      return [...card.querySelectorAll('button, .toolkit-card-copy, .toolkit-layout-note, .toolkit-local-diagram, .toolkit-card-heading > span')]
        .filter(child => {
          const rect = child.getBoundingClientRect();
          return rect.width > 0 && (rect.left < bounds.left || rect.right > bounds.right);
        })
        .map(child => child.textContent);
    }));
    expect(invalidBounds).toEqual([]);
    const heights = await page.locator('#features button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
    expect(heights.every(height => height >= 44)).toBe(true);
    for (const look of ['Pop', 'Minimal', 'Karaoke']) {
      await page.getByRole('group', { name: 'Caption style preview' }).getByRole('button', { name: look }).click();
      const fits = await page.locator('.toolkit-caption-stage').evaluate(stage => {
        const bounds = stage.getBoundingClientRect();
        return [...stage.querySelectorAll('.toolkit-caption-word')].every(word => {
          const rect = word.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right;
        });
      });
      expect(fits, `${look} captions should not be clipped`).toBe(true);
    }
    const cards = await page.locator('.toolkit-card').evaluateAll(nodes => nodes.map(node => ({ x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y })));
    if (width < 700) expect(cards[1].y).toBeGreaterThan(cards[0].y);
    else expect(cards[1].y).toBe(cards[0].y);
    await page.locator('#features').screenshot({ path: testInfo.outputPath(`toolkit-${width}.png`) });
  });
}

for (const name of ['See the tools', 'Make something worth watching']) {
  test(`"${name}" enters the workspace`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#features');
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Start with your video.' })).toBeVisible();
  });
}

test('privacy navigation targets the new card below the sticky header', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy first', exact: true }).click();
  await expect(page).toHaveURL(/#privacy$/);
  await expect(page.getByRole('heading', { name: 'Private by design.', exact: true })).toBeInViewport();
  const header = (await page.locator('header').boundingBox())!;
  const privacy = (await page.locator('#privacy').boundingBox())!;
  expect(privacy.y).toBeGreaterThanOrEqual(header.y + header.height);
});
