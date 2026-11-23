import { test, expect } from '@playwright/test';
import { requireLocalEnvironment, realLogin, api, blockThirdParties } from '../helpers/real-api.js';
import { navigate } from '../fixtures/ui.js';

test('REAL-CHARGE-01 positive: real QR charging, history and wallet settlement @real', async ({ page, browser, request }, testInfo) => {
  test.setTimeout(150_000);
  requireLocalEnvironment(['E2E_DRIVER_EMAIL', 'E2E_DRIVER_PASSWORD', 'E2E_COMPANY_EMAIL', 'E2E_COMPANY_PASSWORD', 'E2E_STATION_ID', 'E2E_CHARGER_ID']);
  await blockThirdParties(page);
  // Obtain the actual QR rendered by the company portal, not a forged QR payload.
  const companyContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 } });
  let sessionId;
  let driverToken;
  let stopped = false;
  try {
    const companyPage = await companyContext.newPage();
    await blockThirdParties(companyPage);
    const companyToken = await realLogin(companyPage, 'company');
    const seeded = (await api(request, `/api/map/company/stations/${encodeURIComponent(process.env.E2E_STATION_ID)}`, { token: companyToken })).data;
    expect(seeded.name, 'Only explicitly prepared E2E stations can be used').toMatch(/^E2E-/);
    expect(Number(seeded.latitude)).toBeCloseTo(6.9271, 2);
    expect(Number(seeded.longitude)).toBeCloseTo(79.8612, 2);
    const chargers = (await api(request, `/api/map/company/stations/${encodeURIComponent(seeded.id)}/chargers`, { token: companyToken })).data;
    const selected = chargers.find(c => c.id === process.env.E2E_CHARGER_ID);
    expect(selected, 'Configured test charger must belong to the seeded station').toBeTruthy();
    expect(selected.status).toBe('Available');
    await navigate(companyPage, 'Station Management');
    await companyPage.getByRole('row').filter({ hasText: seeded.name }).getByRole('button', { name: 'Manage Chargers', exact: true }).click();
    // Charger rows expose a shortened ID; scope using the exact unique prefix.
    await companyPage.getByRole('row').filter({ hasText: selected.id.slice(0, 8) }).getByRole('button', { name: 'View QR', exact: true }).click();
    const qr = companyPage.locator('#evnexus-qr-canvas');
    await expect(qr).toBeVisible();
    const image = Buffer.from(await qr.evaluate(canvas => canvas.toDataURL('image/png').split(',')[1]), 'base64');

    driverToken = await realLogin(page, 'driver');
    const active = await api(request, '/api/map/driver/sessions/active', { token: driverToken });
    expect(active.data, 'Dedicated driver must have no active session before this test').toBeNull();
    const before = (await api(request, '/api/payment/wallet', { token: driverToken })).data;
    expect(Number(before.balance), 'Prepare at least 1000 test wallet units before execution').toBeGreaterThanOrEqual(1000);
    await navigate(page, 'Find Chargers');
    await page.getByPlaceholder('Search station, city, connector...').fill(seeded.name);
    await expect(page.getByRole('heading', { name: seeded.name, exact: true })).toBeVisible();
    // Filtering leaves only the seeded station plus the user's location marker.
    await page.locator('.evnexus-custom-station-icon').click();
    await page.locator('.leaflet-popup-content').getByRole('button', { name: 'Scan Charger QR' }).click();
    await page.getByLabel('Upload QR Image').setInputFiles({ name: 'test-charger.png', mimeType: 'image/png', buffer: image });
    await expect(page.getByRole('heading', { name: 'Charger Verified' })).toBeVisible();
    const startResponse = page.waitForResponse(r => r.url().endsWith('/api/map/driver/sessions/start') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Start Charging', exact: true }).click();
    const startedResponse = await startResponse;
    expect(startedResponse.ok()).toBeTruthy();
    const started = await startedResponse.json();
    sessionId = started.data.id;
    expect(sessionId).toBeTruthy();
    expect(started.data.chargerId).toBe(selected.id);
    await expect(page.getByRole('heading', { name: 'Charging in Progress' })).toBeVisible();
    await expect.poll(async () => (await api(request, '/api/map/driver/sessions/active', { token: driverToken })).data?.id).toBe(sessionId);

    await page.getByRole('button', { name: 'Stop Charging', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Stop Charging?' })).toBeVisible();
    const stopResponse = page.waitForResponse(r => r.url().endsWith(`/sessions/${sessionId}/stop`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Stop Session', exact: true }).click();
    const stop = await stopResponse;
    expect(stop.ok()).toBeTruthy();
    const completed = (await stop.json()).data;
    stopped = true;
    expect(completed.status).toBe('Completed');
    const cost = Number(completed.totalCost);
    expect(Number.isFinite(cost)).toBe(true);
    expect(cost).toBeGreaterThan(0);

    // Kafka settlement may lag the session response. Poll the real authenticated endpoint.
    let payment;
    await expect.poll(async () => {
      const response = await request.get(`${process.env.E2E_API_URL}/api/payment/session/${sessionId}/status`, { headers: { Authorization: `Bearer ${driverToken}` } });
      if (response.status() === 404) return 'NOT_YET_CREATED';
      expect(response.ok(), `Payment status HTTP ${response.status()}`).toBeTruthy();
      payment = (await response.json()).data;
      return payment?.status;
    }, { timeout: 60_000, intervals: [500, 1000, 2000], message: 'Real payment must settle as COMPLETED; no manual completion API is called' }).toBe('COMPLETED');
    expect(Number(payment.amount)).toBeCloseTo(cost, 2);
    await expect(page.getByRole('heading', { name: 'Charging Complete', exact: true })).toBeVisible({ timeout: 35_000 });
    await page.getByRole('button', { name: 'View Charging History', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Charging Session History' })).toBeVisible();
    const history = (await api(request, '/api/map/driver/sessions/history', { token: driverToken })).data;
    expect(history.some(item => item.session.id === sessionId && item.session.status === 'Completed')).toBe(true);
    const row = page.getByRole('row').filter({ hasText: seeded.name }).first();
    await expect(row).toBeVisible();
    await row.getByRole('button').click();
    await expect(page.getByText(sessionId.split('-')[0], { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close Receipt', exact: true }).click();
    await expect.poll(async () => Number((await api(request, '/api/payment/wallet', { token: driverToken })).data.balance), { timeout: 15_000 }).toBeCloseTo(Number(before.balance) - cost, 2);
    await navigate(page, 'My Wallet');
    await expect(page.getByRole('heading', { name: 'Recent Transactions' })).toBeVisible();
    const transactions = (await api(request, '/api/payment/wallet/transactions?page=1&pageSize=100', { token: driverToken })).data;
    expect(transactions.some(tx => tx.referenceId === sessionId && tx.type === 'CHARGING_PAYMENT' && Math.abs(Number(tx.amount) + cost) < 0.01)).toBe(true);
    await testInfo.attach('settlement-summary', { body: JSON.stringify({ sessionId, status: payment.status, cost, before: before.balance, expectedAfter: Number(before.balance) - cost }, null, 2), contentType: 'application/json' });
  } finally {
    // Stop only a session created by this test; preserve records for audit/reporting.
    if (sessionId && driverToken && !stopped) {
      const response = await request.post(`${process.env.E2E_API_URL}/api/map/driver/sessions/${sessionId}/stop`, { headers: { Authorization: `Bearer ${driverToken}` } });
      await testInfo.attach('cleanup-status', { body: `Stop test-created session ${sessionId}: HTTP ${response.status()}`, contentType: 'text/plain' });
      expect(response.ok(), 'Cleanup failed: inspect the dedicated test driver active session').toBeTruthy();
    }
    await companyContext.close();
  }
});
