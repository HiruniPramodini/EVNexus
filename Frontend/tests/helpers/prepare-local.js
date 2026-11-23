import { loadEnv } from 'vite';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { assertIsolatedStack } from '../../../Infrastructure/docker/e2e-local.mjs';
import { saveLocalEnv } from './local-env.js';

async function main() {
  const isolated = assertIsolatedStack();
  for (const c of isolated.containers) if (c.State.Health && c.State.Health.Status !== 'healthy') throw new Error('Wait for isolated databases, Kafka and Mailpit to become healthy.');
  const health = [
    ['Gateway / Map', `${isolated.apiURL}/api/driver/stations/nearby?latitude=6.9271&longitude=79.8612&radiusKm=50`],
    ['Authentication', 'http://127.0.0.1:15001/swagger/v1/swagger.json'],
    ['Map', 'http://127.0.0.1:15002/health'],
    ['Payment', 'http://127.0.0.1:15003/health'],
    ['Dashboard scaffold', 'http://127.0.0.1:15004/weatherforecast'],
    ['Mailpit', `${isolated.mailURL}/readyz`],
  ];
  for (const [name, url] of health) {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`${name} readiness HTTP ${r.status}; no account setup performed.`);
    console.log(`${name}: ready`);
  }
  mkdirSync('.e2e-artifacts', { recursive: true });
  const file = '.e2e-artifacts/accounts.json';
  let state = existsSync(file) ? JSON.parse(readFileSync(file)) : null;
  if (state && state.gatewayId !== isolated.state.gatewayId) throw new Error('Account manifest belongs to another isolated environment; refusing to reuse credentials.');
  if (!state) {
    const suffix = randomBytes(6).toString('hex');
    state = { gatewayId: isolated.state.gatewayId, suffix, topupKey: `E2E-${randomUUID()}` };
    saveLocalEnv({
      VITE_API_GATEWAY_URL: isolated.apiURL,
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3100',
      PLAYWRIGHT_EXTERNAL_SERVER: '0',
      E2E_API_URL: isolated.apiURL,
      E2E_ALLOW_MUTATIONS: 'local-test-only',
      E2E_DRIVER_EMAIL: `driver-${suffix}@e2e.invalid`,
      E2E_DRIVER_PASSWORD: `Ee1!${randomBytes(24).toString('hex')}`,
      E2E_COMPANY_EMAIL: `company-${suffix}@e2e.invalid`,
      E2E_COMPANY_PASSWORD: `Ee1!${randomBytes(24).toString('hex')}`,
    });
    writeFileSync(file, JSON.stringify(state, null, 2), { flag: 'wx' });
  }
  for (const [key, value] of Object.entries(loadEnv('test', process.cwd(), ''))) process.env[key] ??= value;
  if (process.env.E2E_API_URL !== isolated.apiURL) throw new Error('Account setup URL does not match the isolated Docker stack.');
  async function call(path, data, token) {
    const r = await fetch(`${isolated.apiURL}${path}`, {
      method: data ? 'POST' : 'GET', signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, ok: r.ok && body?.success === true, data: body?.data };
  }
  async function verificationCode(email) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const r = await fetch(`${isolated.mailURL}/api/v1/messages`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(`Local mail API HTTP ${r.status}`);
      const messages = (await r.json()).messages || [];
      const mail = messages.find(m => m.To?.some(t => t.Address === email) && /Code:\s*\d{6}/.test(m.Subject));
      if (mail) return mail.Subject.match(/Code:\s*(\d{6})/)[1];
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Verification email did not arrive in isolated Mailpit; no verification bypass was attempted.');
  }
  const accounts = {};
  for (const role of ['company', 'driver']) {
    const company = role === 'company';
    const email = process.env[company ? 'E2E_COMPANY_EMAIL' : 'E2E_DRIVER_EMAIL'];
    const password = process.env[company ? 'E2E_COMPANY_PASSWORD' : 'E2E_DRIVER_PASSWORD'];
    if (!email?.endsWith('@e2e.invalid') || !password) throw new Error('Only generated local test account credentials are accepted.');
    const credentials = company ? { businessEmail: email, password } : { email, password };
    let login = await call(`/api/auth/${role}/login`, credentials);
    if (login.status === 401) {
      const registration = company
        ? { companyName: `E2E Company ${state.suffix}`, registrationNumber: `E2E-${state.suffix}`, businessEmail: email, phone: '0771234567', address: 'Colombo isolated test environment', password }
        : { name: 'E2E Test Driver', email, phone: '0771234568', password };
      const result = await call(`/api/auth/${role}/register`, registration);
      if (!result.ok) throw new Error(`${role} registration HTTP ${result.status}; response omitted to protect credentials.`);
      login = await call(`/api/auth/${role}/login`, credentials);
    }
    if (!login.ok) throw new Error(`${role} login HTTP ${login.status}; legitimate account setup is blocked.`);
    if (!login.data.isEmailVerified) {
      // Consume a code actually delivered by the real SMTP implementation.
      await call('/api/auth/resend-verification', { email });
      const code = await verificationCode(email);
      const verified = await call('/api/auth/verify-email', { email, verificationCode: code });
      if (!verified.ok) throw new Error(`${role} verification HTTP ${verified.status}; account status was not edited directly.`);
      login = await call(`/api/auth/${role}/login`, credentials);
    }
    if (!login.ok || !login.data.isEmailVerified || login.data.role !== (company ? 'CompanyAdmin' : 'Driver')) throw new Error(`Unexpected ${role} identity/verification state.`);
    accounts[role] = login.data;
    console.log(`${role}: registered/authenticated and email verified through real API + local SMTP`);
  }
  const active = await call('/api/map/driver/sessions/active', null, accounts.driver.accessToken);
  if (!active.ok || active.data) throw new Error('Dedicated driver has a pre-existing active session; it was not stopped.');
  let wallet = await call('/api/payment/wallet', null, accounts.driver.accessToken);
  if (!wallet.ok) throw new Error(`Wallet readiness HTTP ${wallet.status}`);
  if (Number(wallet.data.balance) < 1000) {
    wallet = await call('/api/payment/wallet/topup', { amount: 2000, idempotencyKey: state.topupKey }, accounts.driver.accessToken);
    if (!wallet.ok || Number(wallet.data.balance) < 1000) throw new Error('Isolated test-wallet funding failed.');
  }
  console.log('Dedicated test wallet is funded via the real idempotent wallet API; local environment is ready for station seeding. No password/token was printed.');
}
try { await main(); } catch (error) {
  console.error(error.status ? 'Docker isolation verification failed.' : error.message);
  process.exitCode = 1;
}
