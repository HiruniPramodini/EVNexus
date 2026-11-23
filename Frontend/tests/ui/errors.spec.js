import { test, expect } from '../fixtures/ui.js';

test('ERR-01 negative: empty charging history has an understandable empty state @mocked', async ({ page, ui }) => {
  await ui.session('driver', '/history');
  await expect(page.getByText('You have no completed charging sessions yet.', { exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('ERR-02 negative: history API failure is displayed @mocked', async ({ page, ui }) => {
  ui.respond('/api/map/driver/sessions/history', { success: false, message: 'History temporarily unavailable.' }, 503);
  await ui.session('driver', '/history');
  await expect(page.getByText('History temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByText('You have no completed charging sessions yet.', { exact: true })).toHaveCount(0);
});

test('ERR-03 negative: wallet API failure supports successful retry @mocked', async ({ page, ui }) => {
  ui.respond('/api/payment/wallet', { success: false, message: 'Wallet temporarily unavailable.' }, 503);
  await ui.session('driver', '/wallet');
  await expect(page.getByRole('heading', { name: 'Unable to Load Wallet' })).toBeVisible();
  await expect(page.getByText('Wallet temporarily unavailable.', { exact: true })).toBeVisible();
  ui.respond('/api/payment/wallet', { success: true, data: { balance: 1500, currency: 'LKR' } });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recent Transactions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No transactions yet.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unable to Load Wallet' })).toHaveCount(0);
});

test('ERR-04 negative: station discovery failure does not display fabricated stations @mocked', async ({ page, ui }) => {
  ui.respond('/api/driver/stations/nearby', { success: false, message: 'Station service unavailable.' }, 503);
  await ui.session('driver', '/map');
  await expect(page.getByText('Station service unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'UI Colombo Charger' })).toHaveCount(0);
});

test('ERR-05 negative: empty station discovery and search @mocked', async ({ page, ui }) => {
  ui.setStations([]);
  await ui.session('driver', '/map');
  await expect(page.getByRole('heading', { name: 'No stations found.' })).toBeVisible();
});

test('ERR-06 negative: wallet network failure shows a retry action @mocked', async ({ page, ui }) => {
  ui.failNetwork('/api/payment/wallet');
  await ui.session('driver', '/wallet');
  await expect(page.getByRole('heading', { name: 'Unable to Load Wallet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
});
