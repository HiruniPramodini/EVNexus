import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/ui.js';

async function waitForEntranceAnimations(page) {
  // Scan the settled interface, not a transient low-opacity frame of its fade-in.
  // Infinite loading/status animations must not block accessibility checks.
  await page.evaluate(() => Promise.all(document.getAnimations()
    .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations))
    .map(animation => animation.finished.catch(() => {}))));
}

for (const [id, role, path, ready] of [
  ['01', null, '/driver-login', 'Welcome Back'],
  ['02', null, '/login', 'Company Administrator'],
  ['03', 'driver', '/driver-dashboard', 'Find your next charging station'],
  ['04', 'company', '/dashboard', null],
  ['05', 'driver', '/map', 'Charging Stations'],
  ['06', 'company', '/stations', 'Charging Station Management'],
]) {
  test(`AX-${id} quality: ${path} accessibility @mocked @a11y`, async ({ page, ui }, testInfo) => {
    if (role) await ui.session(role, path);
    else await page.goto(path);
    if (ready) await expect(page.getByRole('heading', { name: ready, exact: true })).toBeVisible();
    else await expect(page.getByText('Total Revenue', { exact: true })).toBeVisible();
    await waitForEntranceAnimations(page);
    // No excluded rules, excluded elements, or known-issue allowlist.
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await testInfo.attach('axe-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), null, 2)).toEqual([]);
  });
}

test('AX-07 quality: station creation form accessible names @mocked @a11y', async ({ page, ui }, testInfo) => {
  await ui.session('company', '/stations');
  await page.getByRole('button', { name: 'Add Station', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add New Station', exact: true })).toBeVisible();
  await waitForEntranceAnimations(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await testInfo.attach('axe-results', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results.violations, JSON.stringify(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), null, 2)).toEqual([]);
});
