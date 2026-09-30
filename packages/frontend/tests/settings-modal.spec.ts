import { test, expect, type Page } from '@playwright/test';

const providers = [
  { name: 'AssemblyAI', tab: 'Transcription', storage: 'openclip_assemblyai_key' },
  { name: 'Pexels', tab: 'Stock footage', storage: 'openclip_pexels_key' },
  { name: 'Pixabay', tab: 'Stock footage', storage: 'openclip_pixabay_key' },
];

async function enterWorkspace(page: Page, advanced = false) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
  if (advanced) await page.getByRole('button', { name: 'Advanced mode', exact: true }).click();
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Open settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
}

test('provider keys save explicitly, survive reopening/reload, and can be removed', async ({ page }) => {
  await enterWorkspace(page);
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  for (const provider of providers) {
    await dialog.getByRole('tab', { name: provider.tab, exact: true }).click();
    const input = dialog.getByLabel(`${provider.name} API key`, { exact: true });
    const save = dialog.getByRole('button', { name: `Save ${provider.name} key`, exact: true });
    await expect(save).toBeDisabled();
    await expect(input).toHaveAttribute('type', 'password');
    // Deliberately fake test-only values; tests run in isolated browser profiles.
    await input.fill(`  test-only-${provider.name}-not-a-real-key  `);
    expect(await page.evaluate(key => localStorage.getItem(key), provider.storage)).toBeNull();
    await input.press('Enter');
    await expect(save).toBeDisabled();
    await expect(dialog.getByRole('status', { name: `${provider.name} key update` })).toContainText('Connection not verified.');
    expect(await page.evaluate(key => localStorage.getItem(key), provider.storage)).toBe(`test-only-${provider.name}-not-a-real-key`);
    await expect(dialog.getByLabel(`${provider.name}: Key saved, not verified`, { exact: true })).toBeVisible();
  }
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await enterWorkspace(page);
  await openSettings(page);
  for (const provider of providers) {
    await dialog.getByRole('tab', { name: provider.tab, exact: true }).click();
    const input = dialog.getByLabel(`${provider.name} API key`, { exact: true });
    await expect(input).toHaveValue(`test-only-${provider.name}-not-a-real-key`);
    await expect(input).toHaveAttribute('type', 'password');
    await dialog.getByRole('button', { name: `Remove ${provider.name} key`, exact: true }).click();
    await expect(input).toHaveValue('');
    expect(await page.evaluate(key => localStorage.getItem(key), provider.storage)).toBeNull();
    await expect(dialog.getByRole('button', { name: `Remove ${provider.name} key`, exact: true })).toBeDisabled();
  }
});

test('drafts survive tab switches but discard on close; key reveal is temporary', async ({ page }) => {
  await enterWorkspace(page, true);
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  const input = dialog.getByLabel('AssemblyAI API key', { exact: true });
  await input.fill('test-only-unsaved-placeholder');
  await dialog.getByRole('button', { name: 'Show AssemblyAI key', exact: true }).click();
  await expect(input).toHaveAttribute('type', 'text');
  await dialog.getByRole('tab', { name: 'Stock footage', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Transcription', exact: true }).click();
  await expect(input).toHaveValue('test-only-unsaved-placeholder');
  await expect(input).toHaveAttribute('type', 'password');
  await dialog.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await openSettings(page);
  await expect(input).toHaveValue('');
  await expect(input).toHaveAttribute('type', 'password');
  await expect(dialog.getByRole('tab', { name: 'Transcription', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('dialog supports keyboard tabs, focus containment, Escape and backdrop dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await enterWorkspace(page);
  const opener = page.getByRole('button', { name: 'Open settings', exact: true });
  const before = await page.evaluate(() => ({ body: document.body.style.overflow, root: document.documentElement.style.overflow }));
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByRole('tab', { name: 'Transcription', exact: true })).toBeFocused();
  expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
  await page.keyboard.press('ArrowDown');
  await expect(dialog.getByRole('tab', { name: 'Stock footage', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(dialog.getByRole('tab', { name: 'Privacy & storage', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(dialog.getByRole('tab', { name: 'Transcription', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Done', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close settings', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => ({ body: document.body.style.overflow, root: document.documentElement.style.overflow }))).toEqual(before);
  await openSettings(page);
  await dialog.getByRole('heading', { name: 'Settings', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

for (const [width, height] of [[320, 568], [390, 844], [768, 600], [1440, 1000], [900, 420]]) {
  test(`settings fits ${width}x${height} with scrollable content and reachable actions`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enterWorkspace(page, true);
    await openSettings(page);
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    for (const name of ['Transcription', 'Stock footage', 'Privacy & storage']) {
      await dialog.getByRole('tab', { name, exact: true }).click();
      const panel = dialog.getByRole('tabpanel', { name, exact: true });
      await expect(panel).toBeVisible();
      expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      if (name === 'Stock footage') {
        await panel.getByLabel('Pixabay API key', { exact: true }).scrollIntoViewIfNeeded();
        await expect(panel.getByLabel('Pixabay API key', { exact: true })).toBeInViewport();
      }
      await expect(dialog.getByRole('button', { name: 'Done', exact: true })).toBeInViewport();
      await expect(dialog.getByRole('button', { name: 'Close settings', exact: true })).toBeInViewport();
      const interactiveFits = await panel.evaluate(element => {
        const panelBounds = element.getBoundingClientRect();
        return [...element.querySelectorAll('input, button, a')].every(control => {
          const rect = control.getBoundingClientRect();
          return rect.left >= panelBounds.left && rect.right <= panelBounds.right;
        });
      });
      expect(interactiveFits).toBe(true);
      if (width === 1440) await dialog.screenshot({ path: info.outputPath(`settings-${name.split(' ')[0].toLowerCase()}.png`) });
    }
    if (width <= 640) {
      await dialog.getByRole('tab', { name: 'Transcription', exact: true }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(dialog.getByRole('tab', { name: 'Stock footage', exact: true })).toBeFocused();
    }
    await dialog.getByRole('tab', { name: 'Transcription', exact: true }).click();
    await dialog.screenshot({ path: info.outputPath(`settings-${width}.png`) });
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}

test('provider links stay explicit and security information is available without exposing keys', async ({ page }) => {
  await enterWorkspace(page);
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByRole('link', { name: 'Get AssemblyAI key', exact: true })).toHaveAttribute('href', 'https://www.assemblyai.com/dashboard/api-keys');
  await expect(dialog.getByRole('link', { name: 'View AssemblyAI sign-up offer', exact: true })).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(dialog.getByText(/\$100|400 hours/)).toHaveCount(0);
  await dialog.getByRole('tab', { name: 'Privacy & storage', exact: true }).click();
  await expect(dialog.getByText('unencrypted in localStorage', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/not included in project files or backups/)).toBeVisible();
  await expect(dialog.getByText(/revoke it with its provider/)).toBeVisible();
});
