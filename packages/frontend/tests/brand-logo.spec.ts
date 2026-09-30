import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectBrand(brand: Locator) {
  await expect(brand).toBeVisible();
  await expect(brand.getByText('OpenClip', { exact: true })).toBeVisible();
  await expect(brand.getByText('Local AI editor', { exact: true })).toBeVisible();
  await expect(brand.locator('svg')).toHaveAttribute('viewBox', '0 0 40 40');
  await expect(brand.locator('svg rect').first()).toHaveAttribute('fill', '#ffffff');
  await expect(brand.locator('svg rect').last()).toHaveAttribute('width', '16');
  await expect(brand.locator('svg rect').last()).toHaveAttribute('rx', '5');
  await expect(brand.locator('svg rect').last()).toHaveAttribute('fill', '#08080a');
  await expect(brand.locator('svg path')).toHaveCount(0);
}

async function expectHeaderFits(page: Page) {
  const bounds = await page.locator('header').evaluate((header) => {
    const elements = [...header.querySelectorAll('button, a, select')].filter((element) => element.getClientRects().length);
    const brand = header.querySelector('button[aria-label="OpenClip home"]')!.getBoundingClientRect();
    return {
      insideViewport: elements.every((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      }),
      logoOverlaps: elements.filter((element) => element.getAttribute('aria-label') !== 'OpenClip home').some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < brand.right && rect.right > brand.left && rect.top < brand.bottom && rect.bottom > brand.top;
      }),
      controlsOverlap: elements.some((element, index) => elements.slice(index + 1).some((other) => {
        const a = element.getBoundingClientRect();
        const b = other.getBoundingClientRect();
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      })),
    };
  });
  expect(bounds).toEqual({ insideViewport: true, logoOverlaps: false, controlsOverlap: false });
}

async function expectNavbarSize(surface: Locator, width: number, singleRow: boolean) {
  const box = (await surface.boundingBox())!;
  const expectedWidth = Math.min(1280, width - (width >= 640 ? 48 : 24));
  expect(box.width).toBeCloseTo(expectedWidth, 0);
  expect(box.x).toBeCloseTo((width - expectedWidth) / 2, 0);
  expect(box.y).toBeCloseTo(width >= 640 ? 16 : 12, 0);
  if (singleRow) expect(box.height).toBe(68);
  else expect(box.height).toBeGreaterThan(68);
  // Controls must fit inside the centered bar, not merely the viewport.
  const outside = await surface.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return [...element.querySelectorAll('button, a, select')]
      .filter(control => control.getClientRects().length)
      .filter(control => {
        const rect = control.getBoundingClientRect();
        return rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom;
      })
      .map(control => control.getAttribute('aria-label') || control.textContent);
  });
  expect(outside).toEqual([]);
}

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`shared branding stays visible and navigable at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/');
    const headerBrand = page.locator('header').getByRole('button', { name: 'OpenClip home', exact: true });
    await expectBrand(headerBrand);
    await expectHeaderFits(page);
    await expectNavbarSize(page.locator('header > div').first(), width, true);
    const footerBrand = page.locator('footer').getByRole('button', { name: 'OpenClip home', exact: true });
    await footerBrand.scrollIntoViewIfNeeded();
    await expectBrand(footerBrand);
    await footerBrand.screenshot({ path: info.outputPath('landing-footer-logo.png') });
    await footerBrand.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.getByRole('button', { name: 'Open workspace', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Start with your video.' })).toBeVisible();
    await expectBrand(headerBrand);
    await expectHeaderFits(page);
    await expectNavbarSize(page.locator('header > fieldset'), width, width >= 1280);
    await page.locator('header').screenshot({ path: info.outputPath('quick-navbar.png') });

    await expect(page.getByRole('button', { name: /Landing page/i })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Quick Mode progress' })).toBeVisible();
    // Mode switching is available at every viewport, including mobile.
    await page.getByRole('button', { name: 'Advanced mode', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Workspace', exact: true })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: 'Quick mode', exact: true })).toBeVisible();
    await expect(page.locator('header').getByRole('button', { name: /Landing page/i })).toHaveCount(0);
    await expectBrand(headerBrand);
    await expectHeaderFits(page);
    await expectNavbarSize(page.locator('header'), width, width >= 1024);
    await page.locator('header').screenshot({ path: info.outputPath('advanced-navbar.png') });
    await page.locator('header').getByRole('button', { name: 'Quick mode', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Quick Mode progress' })).toBeVisible();
    await page.getByRole('button', { name: 'Advanced mode', exact: true }).click();
    await headerBrand.focus();
    await page.keyboard.press('Enter');
    await expect(footerBrand).toBeAttached();
    await expectBrand(headerBrand);
  });
}

test('workspace navbars stay aligned with a long project name and use the logo to go home', async ({ page }, info) => {
  await page.goto('/tests/quick-mode.html');
  await expect(page.getByText('2 clips ready', { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).quickTest.renameProject('My very long podcast recording project for responsive navbar testing'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open workspace', exact: true }).first().click();
  await expect(page.getByText('2 clips ready', { exact: true })).toBeVisible();

  for (const mode of ['Quick Mode progress', 'Workspace']) {
    for (const width of [1874, 1440, 1280, 1024, 768, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 950 });
      const nav = page.getByRole('navigation', { name: mode, exact: true });
      await expect(nav).toBeVisible();
      await expectHeaderFits(page);
      await expectNavbarSize(
        mode === 'Workspace' ? page.locator('header') : page.locator('header > fieldset'),
        width,
        width >= (mode === 'Workspace' ? 1024 : 1280),
      );
      if (width >= (mode === 'Workspace' ? 1024 : 1280)) {
        const box = (await nav.boundingBox())!;
        expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
      }
      await page.locator('header').screenshot({ path: info.outputPath(`${mode === 'Workspace' ? 'advanced' : 'quick'}-project-navbar-${width}.png`) });
    }
    if (mode === 'Quick Mode progress') await page.getByRole('button', { name: 'Advanced mode', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Quick mode', exact: true }).click();
  await expect(page.getByText('2 clips ready', { exact: true })).toBeVisible();
  await page.locator('header').getByRole('button', { name: 'OpenClip home' }).click();
  await expect(page.getByRole('button', { name: 'Open workspace', exact: true }).first()).toBeVisible();
});
