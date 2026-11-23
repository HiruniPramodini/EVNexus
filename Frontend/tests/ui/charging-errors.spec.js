import { test, expect, identities, station, charger } from '../fixtures/ui.js';

async function openDriverQr(page, ui, payload) {
  if (payload) ui.respond(`/api/map/company/stations/${station.id}/chargers/${charger.id}/qr`, { success: true, data: payload });
  await ui.session('company', '/stations');
  await page.getByRole('button', { name: 'View QR', exact: true }).click();
  const canvas = page.locator('#evnexus-qr-canvas');
  await expect(canvas).toBeVisible();
  const image = Buffer.from(await canvas.evaluate(el => el.toDataURL('image/png').split(',')[1]), 'base64');
  await page.evaluate(driver => {
    localStorage.setItem('evnexus_auth_user', JSON.stringify(driver));
  }, identities.driver);
  await page.goto('/map');
  await page.locator('.evnexus-custom-station-icon').click();
  await page.locator('.leaflet-popup-content').getByRole('button', { name: 'Scan Charger QR' }).click();
  await page.getByLabel('Upload QR Image').setInputFiles({ name: 'ui-test-qr.png', mimeType: 'image/png', buffer: image });
}

test('CH-01 negative: foreign-system QR rejected before API request @mocked', async ({ page, ui }) => {
  await openDriverQr(page, ui, { system: 'OTHER', stationId: 'not-evnexus' });
  await expect(page.getByText('This QR code is not an EVNexus charger QR code.', { exact: true })).toBeVisible();
  expect(ui.calls.filter(c => c.path === '/api/driver/stations/qr/validate')).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Start Charging', exact: true })).toHaveCount(0);
});

test('CH-02 negative: inactive station QR failure prevents charging @mocked', async ({ page, ui }) => {
  ui.respond('/api/driver/stations/qr/validate', { success: false, message: 'Station or charger is inactive.' }, 404);
  await openDriverQr(page, ui);
  await expect(page.getByText('Station or charger is inactive.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Charging', exact: true })).toHaveCount(0);
});

test('CH-03 negative: unavailable charger start failure allows recovery @mocked', async ({ page, ui }) => {
  ui.respond('/api/driver/stations/qr/validate', { success: true, data: { stationId: station.id, chargerId: charger.id, companyId: station.tenantId, stationName: station.name, address: station.address, connectorType: 'CCS2', powerKw: 22, pricePerKwh: 10, chargingCode: station.chargingCode, status: 'Available' } });
  ui.respond('/api/map/driver/sessions/start', { success: false, message: 'Charger is not available.' }, 400);
  await openDriverQr(page, ui);
  await expect(page.getByRole('heading', { name: 'Charger Verified' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Charging', exact: true }).click();
  await expect(page.getByText('Charger is not available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Charging', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Charging in Progress' })).toHaveCount(0);
});
