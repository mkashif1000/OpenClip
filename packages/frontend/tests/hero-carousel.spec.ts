import { test, expect } from '@playwright/test';
import { heroOrbitPose } from '../src/components/landing/useHeroOrbit';

test.use({ viewport: { width: 1440, height: 1050 } });

test('hero accents stay monochrome across cards, controls, hover, and focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const hero = page.locator('.openclip-hero');
  const assertNeutral = async () => {
    const colored = await hero.evaluate(root => {
      const properties = ['color', 'background-color', 'background-image', 'border-color', 'box-shadow', 'outline-color'];
      return [root, ...root.querySelectorAll('*')].flatMap(element => {
        const style = getComputedStyle(element);
        return properties.flatMap(property => {
          const value = style.getPropertyValue(property);
          const colors = [...value.matchAll(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/g)];
          return colors.some(match => {
            const rgb = match.slice(1, 4).map(Number);
            return Math.max(...rgb) - Math.min(...rgb) > 4;
          }) ? [`${element.tagName}.${element.getAttribute('class')}: ${property}: ${value}`] : [];
        });
      });
    });
    expect(colored).toEqual([]);
  };
  await assertNeutral();
  const active = hero.locator('.hero-clip-card[data-active="true"]');
  await active.hover();
  await active.focus();
  await assertNeutral();
  const next = hero.getByRole('button', { name: 'Next clip preview', exact: true });
  await next.click();
  await expect(active).toContainText('Small habits create');
  await next.hover();
  await assertNeutral();
  await hero.locator('.hero-carousel-dot').first().hover();
  await assertNeutral();
});

test('orbits continuously, pauses with the control, and resumes on request', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Sample clip styles' });
  const active = carousel.locator('.hero-clip-card[data-active="true"]');
  const featured = carousel.locator('.hero-clip-card').nth(3);
  await expect(carousel).toHaveAttribute('data-playing', 'true');
  await expect(active).toContainText('This changes');
  // Sample within a single slot: motion must never wait for a slide timer.
  const xPositions: number[] = [];
  for (let sample = 0; sample < 4; sample++) {
    await page.clock.runFor(200);
    xPositions.push(await featured.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41));
  }
  for (let index = 1; index < xPositions.length; index++) {
    expect(xPositions[index]).toBeLessThan(xPositions[index - 1] - 1);
    expect(xPositions[index - 1] - xPositions[index]).toBeLessThan(35);
  }
  await page.clock.runFor(4000);
  await expect(active).toContainText('Small habits create');

  await carousel.hover({ position: { x: 10, y: 10 } });
  const transformBeforeHoverWait = await active.evaluate((element) => getComputedStyle(element).transform);
  await page.clock.runFor(800);
  const transformAfterHoverWait = await active.evaluate((element) => getComputedStyle(element).transform);
  expect(transformAfterHoverWait).not.toBe(transformBeforeHoverWait);

  await carousel.getByRole('button', { name: 'Pause carousel', exact: true }).click();
  await expect(carousel).toHaveAttribute('data-playing', 'false');
  const transformBeforePauseWait = await active.evaluate((element) => getComputedStyle(element).transform);
  await page.clock.fastForward(10000);
  const transformAfterPauseWait = await active.evaluate((element) => getComputedStyle(element).transform);
  expect(transformAfterPauseWait).toBe(transformBeforePauseWait);
  await carousel.getByRole('button', { name: 'Resume carousel', exact: true }).click();
  await expect(carousel).toHaveAttribute('data-playing', 'true');
  await page.clock.runFor(4800);
  await expect(active).toContainText('Here is a better way');

  await page.getByRole('heading', { name: 'Private by design.' }).scrollIntoViewIfNeeded();
  await expect(carousel).toHaveAttribute('data-playing', 'false');
});

test('arc geometry is symmetric, raised at the ends, and recycles invisibly', () => {
  const center = heroOrbitPose(3, 3, 7, 640, 340);
  const left = heroOrbitPose(0, 3, 7, 640, 340);
  const right = heroOrbitPose(6, 3, 7, 640, 340);
  expect(center.x).toBe(0);
  expect(center.y).toBe(0);
  expect(left.x).toBeCloseTo(-right.x);
  expect(left.y).toBeCloseTo(right.y);
  expect(left.y).toBeLessThan(-250);
  expect(heroOrbitPose(0, 3.5, 7, 640, 340).opacity).toBe(0);
  const before = heroOrbitPose(0, 3.4999, 7, 640, 340);
  const after = heroOrbitPose(0, 3.5001, 7, 640, 340);
  expect(before.opacity).toBeLessThan(0.001);
  expect(after.opacity).toBeLessThan(0.001);
  expect(heroOrbitPose(4, 3.25, 7, 640, 340)).toEqual(heroOrbitPose(4, 10.25, 7, 640, 340));
});

test('desktop cards form a deep U while keeping the upload button accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const cards = page.locator('.hero-clip-card');
  const center = await cards.nth(3).boundingBox();
  const left = await cards.nth(0).boundingBox();
  const right = await cards.nth(6).boundingBox();
  expect(center!.y - left!.y).toBeGreaterThan(180);
  expect(center!.y - right!.y).toBeGreaterThan(180);
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Start with a video' }).click();
  expect((await fileChooser).isMultiple()).toBe(false);
});

test('manual navigation wraps, supports keyboard, and keeps media as placeholders', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Sample clip styles' });
  const active = carousel.locator('.hero-clip-card[data-active="true"]');
  await expect(carousel).toHaveAttribute('data-playing', 'false');
  await expect(carousel.getByRole('button', { name: 'Resume carousel', exact: true })).toBeVisible();
  await expect(carousel.locator('img, video')).toHaveCount(0);
  await expect(page.locator('.openclip-hero .lucide-sparkles, .openclip-hero .lucide-star')).toHaveCount(0);

  const next = carousel.getByRole('button', { name: 'Next clip preview' });
  await next.click();
  await expect(active).toContainText('Small habits create');
  await next.press('ArrowLeft');
  await expect(active).toContainText('This changes');
  await next.press('End');
  await expect(active).toContainText('Focus on what actually');
  await next.click();
  await expect(active).toContainText('The mindset shift');
  await carousel.getByRole('button', { name: 'Previous clip preview' }).click();
  await expect(active).toContainText('Focus on what actually');
  await carousel.getByRole('button', { name: 'Show build a system preview' }).click();
  await expect(active).toContainText('You do not need more time');
  await expect(carousel.locator('.hero-clip-card[aria-hidden="true"]')).toHaveCount(6);
});

test('completes a full orbit without duplicating cards or a reset jump', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Sample clip styles' });
  await expect(carousel).toHaveAttribute('data-playing', 'true');
  const card = carousel.locator('.hero-clip-card').nth(3);
  const start = await card.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41);
  await page.clock.runFor(33600);
  const end = await card.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41);
  expect(Math.abs(end - start)).toBeLessThan(35);
  await expect(carousel.locator('.hero-clip-card')).toHaveCount(7);
  await expect(carousel.locator('.hero-clip-card[data-active="true"]')).toContainText('This changes');
  await page.clock.runFor(200);
  const afterLoop = await card.evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).m41);
  expect(afterLoop).toBeLessThan(end - 1);
});

test('phone swipe changes the sample without a synthetic click selecting the wrong card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const active = page.locator('.hero-clip-card[data-active="true"]');
  await active.scrollIntoViewIfNeeded();
  const box = (await active.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2 + 65, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 65, y + 4, { steps: 8 });
  await page.mouse.up();
  await expect(active).toContainText('Small habits create');
  await expect(page.getByRole('button', { name: 'Resume carousel', exact: true })).toBeVisible();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`hero fits a ${width}px viewport without horizontal overflow`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1050 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const active = page.locator('.hero-clip-card[data-active="true"]');
    await expect(active).toBeVisible();
    // Measure before the orbit's rotation/scale: every card is a 9:16 frame.
    const sizes = await page.locator('.hero-clip-card').evaluateAll((cards) => cards.map((card) => {
      const style = getComputedStyle(card);
      return { width: parseFloat(style.width), height: parseFloat(style.height) };
    }));
    expect(sizes).toHaveLength(7);
    for (const size of sizes) expect(Math.abs(size.height - size.width * 16 / 9)).toBeLessThan(0.05);
    const bounds = await active.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Start with a video' })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`hero-${width}.png`), fullPage: false });
  });
}
