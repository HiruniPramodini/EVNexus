import { test, expect, station } from '../fixtures/ui.js';
import { stationField, fillStation } from '../helpers/stations.js';

test('ST-01 positive: discover, select, inspect station and open QR upload @mocked', async ({ page, ui }) => {
  await ui.session('driver', '/map');
  await expect(page.getByRole('heading', { name: station.name })).toBeVisible();
  await page.getByPlaceholder('Search station, city, connector...').fill('missing-station');
  await expect(page.getByRole('heading', { name: 'No stations found.' })).toBeVisible();
  await page.getByPlaceholder('Search station, city, connector...').fill('');
  // Leaflet's existing marker is an image with a button role, not a named station control.
  await page.locator('.evnexus-custom-station-icon').click();
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup.getByRole('heading', { name: station.name })).toBeVisible();
  await expect(popup.getByText(/22 kW \(CCS2\)/)).toBeVisible();
  await popup.getByRole('button', { name: 'Scan Charger QR' }).click();
  await expect(page.getByRole('heading', { name: 'Scan to Charge' })).toBeVisible();
  await expect(page.getByLabel('Upload QR Image')).toHaveAttribute('accept', 'image/*');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scan to Charge' })).toHaveCount(0);
});

test('ST-02 negative: station creation requires a name and makes no POST @mocked', async ({ page, ui }) => {
  await ui.session('company', '/stations');
  await page.getByRole('button', { name: 'Add Station', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await stationField(page, /^Station Name$/).evaluate(el => el.validity.valueMissing)).toBe(true);
  expect(ui.calls.filter(c => c.method === 'POST')).toHaveLength(0);
  await expect(page.getByRole('heading', { name: 'Add New Station' })).toBeVisible();
});

test('ST-03 negative: invalid coordinates prevent station creation @mocked', async ({ page, ui }) => {
  await ui.session('company', '/stations');
  await page.getByRole('button', { name: 'Add Station', exact: true }).click();
  await fillStation(page, 'Invalid Coordinate Station');
  await page.getByPlaceholder('e.g. 6.927100 or 6°54\'45.4"N').fill('999');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Please select a valid map location or enter valid latitude (-90 to 90) and longitude (-180 to 180).', { exact: true })).toBeVisible();
  expect(ui.calls.filter(c => c.method === 'POST')).toHaveLength(0);
});

test('ST-04 positive: create station, default charger and display new row @mocked', async ({ page, ui }) => {
  await ui.session('company', '/stations');
  await page.getByRole('button', { name: 'Add Station', exact: true }).click();
  await fillStation(page, 'New UI Station');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Station created successfully!', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'New UI Station' })).toHaveCount(1);
  expect(ui.calls.filter(c => c.method === 'POST' && c.path.endsWith('/stations'))).toHaveLength(1);
  expect(ui.calls.filter(c => c.method === 'POST' && c.path.endsWith('/chargers'))).toHaveLength(1);
});

test('ST-05 positive: existing station exposes available charger details @mocked', async ({ page, ui }) => {
  await ui.session('company', '/stations');
  await page.getByRole('button', { name: 'Manage Chargers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage Chargers', exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'CCS2' }).filter({ hasText: 'Available' })).toHaveCount(1);
});

test('ST-06 negative: station creation API error preserves form and supports retry @mocked', async ({ page, ui }) => {
  await ui.session('company', '/stations');
  await page.getByRole('button', { name: 'Add Station', exact: true }).click();
  await fillStation(page, 'Rejected UI Station');
  ui.respond('/api/map/company/stations', { success: false, message: 'Station save failed.' }, 503);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Station save failed.', { exact: true })).toBeVisible();
  await expect(stationField(page, /^Station Name$/)).toHaveValue('Rejected UI Station');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});
