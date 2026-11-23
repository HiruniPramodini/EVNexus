import { test, expect, navigate } from '../fixtures/ui.js';

test('NAV-01 positive: driver dashboard and all existing destinations @mocked', async ({ page, ui }) => {
  await ui.session('driver');
  await expect(page.getByRole('heading', { name: 'Find your next charging station' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active Session', exact: true })).toBeVisible();
  for (const [label, path, heading] of [
    ['Find Chargers', 'map', 'Charging Stations'],
    ['My Wallet', 'wallet', 'Recent Transactions'],
    ['Session History', 'history', 'Charging Session History'],
    ['My Account', 'account', 'Driver Account & Vehicles'],
    ['Settings', 'settings', 'Driver Account & Vehicles'],
  ]) {
    await navigate(page, label);
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});

test('NAV-02 positive: company KPIs, station management, live sessions, revenue, profile and settings @mocked', async ({ page, ui }) => {
  await ui.session('company');
  await expect(page.getByText('Total Revenue', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Energy', { exact: true })).toBeVisible();
  for (const [label, path, heading] of [
    ['Station Management', 'stations', 'Charging Station Management'],
    ['Live Sessions', 'live', 'Live Charging Sessions'],
    ['Revenue', 'finance', 'Company Revenue & Financials'],
    ['Company Profile', 'company', 'Company Profile'],
    ['Settings', 'settings', 'Application & Operational Settings'],
  ]) {
    await navigate(page, label);
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});

test('NAV-03 negative: driver cannot render company station management @mocked', async ({ page, ui }) => {
  await ui.session('driver', '/stations');
  await expect(page).toHaveURL(/\/driver-dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Driver portal navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Find your next charging station' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Station', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Station Management', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Find your next charging station' })).toBeVisible();
  // Browser history can also contain a URL from a different role.
  await page.evaluate(() => {
    history.pushState({ view: 'stations' }, '', '/stations');
    dispatchEvent(new PopStateEvent('popstate', { state: { view: 'stations' } }));
  });
  await expect(page).toHaveURL(/\/driver-dashboard$/);
  await expect(page.getByRole('heading', { name: 'Find your next charging station' })).toBeVisible();
});

test('NAV-04 negative: anonymous company route does not expose management @mocked', async ({ page, ui }) => {
  await page.goto('/stations');
  await expect(page.getByRole('navigation', { name: 'Company portal navigation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Station', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});
