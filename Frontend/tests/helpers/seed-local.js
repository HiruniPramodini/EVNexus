import { loadEnv } from 'vite';
import { randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { requireLocalEnvironment } from './real-api.js';
import { saveLocalEnv } from './local-env.js';

for (const [key, value] of Object.entries(loadEnv('test', process.cwd(), ''))) process.env[key] ??= value;
const isolated = requireLocalEnvironment(['E2E_COMPANY_EMAIL', 'E2E_COMPANY_PASSWORD', 'E2E_DRIVER_EMAIL', 'E2E_DRIVER_PASSWORD']);
let existing;
try {
  existing = JSON.parse(await readFile('.e2e-seed.json', 'utf8'));
  if (existing.apiURL !== isolated.apiURL || existing.gatewayId !== isolated.state.gatewayId) throw new Error('Existing seed belongs to another environment; refusing to overwrite or adopt it.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

async function call(path, method = 'GET', token, data) {
  const response = await fetch(`${process.env.E2E_API_URL}${path}`, {
    method, signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}. No response body logged to protect secrets.`);
  const body = await response.json();
  if (!body.success) throw new Error(`${method} ${path}: success was not true`);
  return body;
}

const company = (await call('/api/auth/company/login', 'POST', null, { businessEmail: process.env.E2E_COMPANY_EMAIL, password: process.env.E2E_COMPANY_PASSWORD })).data;
const driver = (await call('/api/auth/driver/login', 'POST', null, { email: process.env.E2E_DRIVER_EMAIL, password: process.env.E2E_DRIVER_PASSWORD })).data;
if (!company.isEmailVerified || !driver.isEmailVerified) throw new Error('Verify both dedicated accounts before seeding.');
const active = await call('/api/map/driver/sessions/active', 'GET', driver.accessToken);
if (active.data) throw new Error('Dedicated driver already has an active session; seed will not stop it.');
const wallet = (await call('/api/payment/wallet', 'GET', driver.accessToken)).data;
if (Number(wallet.balance) < 1000) throw new Error('Prepare >=1000 test wallet units through the local wallet UI, then seed. No automatic financial adjustment is performed.');

if (existing) {
  const savedStation = (await call(`/api/map/company/stations/${existing.stationId}`, 'GET', company.accessToken)).data;
  const savedChargers = (await call(`/api/map/company/stations/${existing.stationId}/chargers`, 'GET', company.accessToken)).data;
  if (savedStation.name !== existing.stationName || !savedStation.isActive || !savedChargers.some(c => c.id === existing.chargerId && c.status === 'Available')) throw new Error('Existing seed is incomplete/inactive/busy; inspect it manually. No data changed.');
  saveLocalEnv({ E2E_STATION_ID: existing.stationId, E2E_CHARGER_ID: existing.chargerId });
  console.log('Verified and reused the attested isolated station/charger; .env.test IDs are configured.');
} else {
  const name = `E2E-${randomUUID()}`;
  const created = await call('/api/map/company/stations', 'POST', company.accessToken, { name, address: 'Colombo E2E Test Location', latitude: 6.9271, longitude: 79.8612, connectorType: 'CCS2', capacityKw: 22, pricePerKwh: 10 });
  // Persist the exact created ID immediately so partial failures leave recoverable evidence.
  const manifest = { project: isolated.project, apiURL: isolated.apiURL, gatewayId: isolated.state.gatewayId, stationId: created.id, stationName: name, companyId: company.tenantId, createdAt: new Date().toISOString() };
  await writeFile('.e2e-seed.json', JSON.stringify(manifest, null, 2), { flag: 'wx' });
  const charger = await call(`/api/map/company/stations/${created.id}/chargers`, 'POST', company.accessToken, { type: 'CCS2', powerKw: 22, pricePerKwh: 10 });
  manifest.chargerId = charger.id;
  await writeFile('.e2e-seed.json', JSON.stringify(manifest, null, 2));
  saveLocalEnv({ E2E_STATION_ID: created.id, E2E_CHARGER_ID: charger.id });
  console.log(`Seeded dedicated test station ${name}; actual station/charger IDs saved to ignored .env.test.`);
  console.log('No accounts, sessions or database records were deleted. Retire the station through its company UI when finished.');
}
