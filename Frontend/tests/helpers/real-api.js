import { expect } from '@playwright/test';
import { assertIsolatedStack } from '../../../Infrastructure/docker/e2e-local.mjs';

export function requireLocalEnvironment(keys = []) {
  const required = ['E2E_ALLOW_MUTATIONS', 'E2E_API_URL', ...keys];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw new Error(`BLOCKED: missing test-environment variables: ${missing.join(', ')}. See docs/UI_E2E_TESTING.md. No real API requests were made.`);
  if (process.env.E2E_ALLOW_MUTATIONS !== 'local-test-only') throw new Error('BLOCKED: E2E_ALLOW_MUTATIONS must be local-test-only.');
  let isolated;
  try { isolated = assertIsolatedStack(); }
  catch (error) { throw new Error(error.status ? 'BLOCKED: Docker isolation verification failed.' : error.message); }
  if (process.env.E2E_API_URL !== isolated.apiURL) throw new Error(`BLOCKED: E2E_API_URL must target the attested isolated gateway ${isolated.apiURL}.`);
  for (const value of [process.env.E2E_API_URL, process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100']) {
    const url = new URL(value);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) {
      throw new Error('BLOCKED: real E2E tests are restricted to local, dedicated test services.');
    }
  }
  return isolated;
}

export async function api(request, path, { token, method = 'GET', data } = {}) {
  const response = await request.fetch(`${process.env.E2E_API_URL}${path}`, {
    method, data, timeout: 15_000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  // Do not include response bodies: login responses contain tokens and personal data.
  expect(response.ok(), `${method} ${path}: HTTP ${response.status()}`).toBeTruthy();
  const body = await response.json();
  expect(body.success, `${method} ${path}: expected success=true`).toBe(true);
  return body;
}

export async function realLogin(page, role) {
  const company = role === 'company';
  await page.goto(company ? '/login' : '/driver-login');
  await page.getByLabel(company ? 'Business Email' : 'Email Address', { exact: true }).fill(process.env[company ? 'E2E_COMPANY_EMAIL' : 'E2E_DRIVER_EMAIL']);
  await page.getByLabel('Password', { exact: true }).fill(process.env[company ? 'E2E_COMPANY_PASSWORD' : 'E2E_DRIVER_PASSWORD']);
  await page.getByRole('button', { name: company ? 'Sign In as Administrator' : 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(company ? '/dashboard$' : '/driver-dashboard$'));
  await expect(page.getByRole('navigation', { name: company ? 'Company portal navigation' : 'Driver portal navigation' })).toBeVisible();
  return page.evaluate(() => localStorage.getItem('evnexus_auth_token'));
}

export async function blockThirdParties(page) {
  // API traffic is never intercepted or fulfilled in the real suite.
  await page.route(/https:\/\/([^/]*\.)?(tile\.openstreetmap\.org|nominatim\.openstreetmap\.org|images\.unsplash\.com)\//, route => route.abort());
}
