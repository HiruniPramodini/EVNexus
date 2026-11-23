import { test, expect } from '@playwright/test';
import { requireLocalEnvironment, realLogin, blockThirdParties } from '../helpers/real-api.js';
import { navigate } from '../fixtures/ui.js';
import { randomUUID } from 'node:crypto';

for (const role of ['driver', 'company']) {
  const company = role === 'company';
  test(`REAL-AUTH-${role}-01 positive: real login, logout and route protection @real`, async ({ page }) => {
    requireLocalEnvironment([company ? 'E2E_COMPANY_EMAIL' : 'E2E_DRIVER_EMAIL', company ? 'E2E_COMPANY_PASSWORD' : 'E2E_DRIVER_PASSWORD']);
    await blockThirdParties(page);
    const token = await realLogin(page, role);
    expect(token).toBeTruthy();
    await navigate(page, 'Logout');
    expect(await page.evaluate(() => localStorage.getItem('evnexus_auth_token'))).toBeNull();
    await page.goto(company ? '/stations' : '/wallet');
    await page.reload();
    await expect(page.getByRole('navigation', { name: /portal navigation/ })).toHaveCount(0);
  });
  test(`REAL-AUTH-${role}-02 negative: real service rejects wrong password @real`, async ({ page }) => {
    requireLocalEnvironment([company ? 'E2E_COMPANY_EMAIL' : 'E2E_DRIVER_EMAIL']);
    await page.goto(company ? '/login' : '/driver-login');
    await page.getByLabel(company ? 'Business Email' : 'Email Address', { exact: true }).fill(process.env[company ? 'E2E_COMPANY_EMAIL' : 'E2E_DRIVER_EMAIL']);
    await page.getByLabel('Password', { exact: true }).fill(randomUUID());
    const response = page.waitForResponse(r => r.url().endsWith(`/api/auth/${role}/login`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: company ? 'Sign In as Administrator' : 'Sign In', exact: true }).click();
    expect((await response).status()).toBe(401);
    await expect(page.getByText('Authentication Failed', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('evnexus_auth_token'))).toBeNull();
  });
}

test('REAL-RBAC-01 negative: driver service denies company station management @real', async ({ page, request }) => {
  requireLocalEnvironment(['E2E_DRIVER_EMAIL', 'E2E_DRIVER_PASSWORD']);
  const token = await realLogin(page, 'driver');
  const response = await request.get(`${process.env.E2E_API_URL}/api/map/company/stations`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status()).toBe(403);
  await page.goto('/stations');
  await expect(page.getByRole('button', { name: 'Add Station', exact: true })).toHaveCount(0);
});
