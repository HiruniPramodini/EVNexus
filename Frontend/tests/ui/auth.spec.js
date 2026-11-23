import { randomUUID } from 'node:crypto';
import { test, expect, identities, navigate } from '../fixtures/ui.js';

for (const role of ['driver', 'company']) {
  const company = role === 'company';
  const prefix = company ? 'CA' : 'DA';
  const path = company ? '/login' : '/driver-login';
  const emailLabel = company ? 'Business Email' : 'Email Address';
  const submitName = company ? 'Sign In as Administrator' : 'Sign In';
  const endpoint = `/api/auth/${role}/login`;
  const required = company ? 'Business email is required.' : 'Email address is required.';
  const invalid = company ? 'Please enter a valid business email address.' : 'Please enter a valid email address.';
  const cases = [
    ['01', 'both fields empty', '', '', [required, 'Password is required.']],
    ['02', 'email empty', '', 'generated', [required]],
    ['03', 'password empty', 'user@ui.invalid', '', ['Password is required.']],
    ['04', 'invalid email format', 'invalid-email', 'generated', [invalid]],
  ];
  for (const [id, scenario, email, password, messages] of cases) {
    test(`${prefix}-${id} negative: ${scenario} @mocked`, async ({ page, ui }) => {
      await page.goto(path);
      await page.getByLabel(emailLabel, { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password ? randomUUID() : '');
      await page.getByRole('button', { name: submitName, exact: true }).click();
      for (const message of messages) await expect(page.getByText(message, { exact: true })).toBeVisible();
      expect(ui.calls.filter(c => c.path === endpoint)).toHaveLength(0);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }
  test(`${prefix}-05 negative: wrong credentials show error @mocked`, async ({ page, ui }) => {
    ui.respond(endpoint, { success: false, message: 'Invalid email or password.' }, 401);
    await page.goto(path);
    await page.getByLabel(emailLabel, { exact: true }).fill('user@ui.invalid');
    await page.getByLabel('Password', { exact: true }).fill(randomUUID());
    await page.getByRole('button', { name: submitName, exact: true }).click();
    await expect(page.getByText('Invalid email or password.', { exact: true })).toBeVisible();
    await expect(page.getByText('Authentication Failed', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    expect(await page.evaluate(() => localStorage.getItem('evnexus_auth_token'))).toBeNull();
  });
  test(`${prefix}-06 positive: mocked login, dashboard, logout and refresh protection @mocked`, async ({ page, ui }) => {
    await page.goto(path);
    await page.getByLabel(emailLabel, { exact: true }).fill(company ? identities.company.businessEmail : identities.driver.email);
    await page.getByLabel('Password', { exact: true }).fill(randomUUID());
    await page.getByRole('button', { name: submitName, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(company ? '/dashboard$' : '/driver-dashboard$'));
    await expect(page.getByRole('navigation', { name: /portal navigation/ })).toBeVisible();
    await expect(page.getByText(company ? 'UI Charging Company' : 'UI Driver', { exact: true }).first()).toBeVisible();
    await navigate(page, 'Logout');
    expect(await page.evaluate(() => localStorage.getItem('evnexus_auth_token'))).toBeNull();
    await page.goto(company ? '/stations' : '/wallet');
    await page.reload();
    await expect(page.getByRole('navigation', { name: /portal navigation/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: company ? 'Add Station' : 'Top Up Wallet', exact: true })).toHaveCount(0);
  });
  test(`${prefix}-07 negative: network failure is recoverable @mocked`, async ({ page, ui }) => {
    ui.failNetwork(endpoint);
    await page.goto(path);
    await page.getByLabel(emailLabel, { exact: true }).fill('user@ui.invalid');
    await page.getByLabel('Password', { exact: true }).fill(randomUUID());
    await page.getByRole('button', { name: submitName, exact: true }).click();
    await expect(page.getByText('Authentication Failed', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: submitName, exact: true })).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

test('AUTH-01 positive: password toggle and keyboard submission @mocked', async ({ page, ui }) => {
  await page.goto('/driver-login');
  const email = page.getByLabel('Email Address', { exact: true });
  const password = page.getByLabel('Password', { exact: true });
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Show password', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Email address is required.', { exact: true })).toBeVisible();
  expect(ui.calls.filter(c => c.path.includes('/login'))).toHaveLength(0);
});
