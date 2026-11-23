import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { requireLocalEnvironment, realLogin, api, blockThirdParties } from '../helpers/real-api.js';
import { navigate } from '../fixtures/ui.js';
import { fillStation } from '../helpers/stations.js';

test('REAL-STATION-01 positive: company creates a real station and default charger @real', async ({ page, request }, testInfo) => {
  requireLocalEnvironment(['E2E_COMPANY_EMAIL', 'E2E_COMPANY_PASSWORD']);
  await blockThirdParties(page);
  const token = await realLogin(page, 'company');
  const name = `E2E-UI-${randomUUID()}`;
  let createdId;
  // Capture the ID even if a later UI assertion fails, so cleanup is still scoped.
  const capture = async response => {
    if (response.url().endsWith('/api/map/company/stations') && response.request().method() === 'POST' && response.ok()) {
      const body = await response.json();
      createdId = body.id;
    }
  };
  page.on('response', capture);
  try {
    await navigate(page, 'Station Management');
    await page.getByRole('button', { name: 'Add Station', exact: true }).click();
    await fillStation(page, name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Station created successfully!', { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(1);
    expect(createdId).toBeTruthy();
    const chargers = (await api(request, `/api/map/company/stations/${createdId}/chargers`, { token })).data;
    expect(chargers).toHaveLength(1);
    expect(chargers[0].status).toBe('Available');
    expect(Number(chargers[0].powerKw)).toBe(22);
  } finally {
    page.off('response', capture);
    if (createdId) {
      const actual = (await api(request, `/api/map/company/stations/${createdId}`, { token })).data;
      expect(actual.name, 'Cleanup must match the exact unique name created by this test').toBe(name);
      const response = await request.delete(`${process.env.E2E_API_URL}/api/map/company/stations/${createdId}`, { headers: { Authorization: `Bearer ${token}` } });
      await testInfo.attach('cleanup-status', { body: `Deactivate test-created station ${createdId}: HTTP ${response.status()}`, contentType: 'text/plain' });
      expect(response.ok(), 'Test-created station deactivation must succeed').toBeTruthy();
    }
  }
});
