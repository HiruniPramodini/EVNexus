import { test, expect, navigate } from '../fixtures/ui.js';

const sizes = { desktop: { width: 1440, height: 900 }, tablet: { width: 768, height: 1024 }, mobile: { width: 375, height: 812 } };

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'Document must not overflow horizontally').toBeLessThanOrEqual(1);
}

for (const [device, viewport] of Object.entries(sizes)) {
  test(`RWD-${device}-01 positive: login forms remain operable @mocked @responsive`, async ({ page, ui }) => {
    await page.setViewportSize(viewport);
    for (const [path, label, submit] of [
      ['/driver-login', 'Email Address', 'Sign In'],
      ['/login', 'Business Email', 'Sign In as Administrator'],
    ]) {
      await page.goto(path);
      await expect(page.getByLabel(label, { exact: true })).toBeInViewport();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: submit, exact: true }).click();
      await expect(page.getByText('Password is required.', { exact: true })).toBeVisible();
      await noOverflow(page);
    }
  });
  for (const role of ['driver', 'company']) {
    test(`RWD-${device}-${role} positive: portal navigation remains usable @mocked @responsive`, async ({ page, ui }) => {
      await page.setViewportSize(viewport);
      await ui.session(role);
      const label = role === 'driver' ? 'Session History' : 'Station Management';
      await navigate(page, label);
      await expect(page.getByRole('heading', { name: role === 'driver' ? 'Charging Session History' : 'Charging Station Management', exact: true })).toBeVisible();
      await noOverflow(page);
      if (device !== 'desktop') {
        await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeInViewport();
        await expect(page.locator('.sidebar')).not.toHaveClass(/\bopen\b/);
      }
    });
  }
  test(`RWD-${device}-map positive: charger search remains inside viewport @mocked @responsive`, async ({ page, ui }) => {
    await page.setViewportSize(viewport);
    await ui.session('driver', '/map');
    const search = page.getByPlaceholder('Search station, city, connector...');
    await expect(search).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Refresh Stations' })).toBeInViewport({ ratio: 1 });
    await search.fill('unknown');
    await expect(page.getByRole('heading', { name: 'No stations found.' })).toBeVisible();
    await noOverflow(page);
  });
}
