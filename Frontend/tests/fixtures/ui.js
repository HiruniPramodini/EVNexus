import { test as base, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Synthetic UI identities only. These credentials never reach a real service.
export const identities = {
  driver: { driverId: 'DRV-UI', name: 'UI Driver', email: 'driver@ui.invalid', role: 'Driver', walletBalance: 1500, currency: 'LKR', isEmailVerified: true },
  company: { tenantId: 'TEN-UI', companyName: 'UI Charging Company', businessEmail: 'company@ui.invalid', role: 'CompanyAdmin', isEmailVerified: true },
};
export const station = { id: 'STN-UI', tenantId: 'TEN-UI', name: 'UI Colombo Charger', address: 'Colombo Test Location', latitude: 6.9271, longitude: 79.8612, connectorType: 'CCS2', capacityKw: 22, pricePerKwh: 10, isActive: true, status: 'Active', chargingCode: 'UI-CODE' };
export const charger = { id: 'CHG-UI', stationId: station.id, type: 'CCS2', powerKw: 22, pricePerKwh: 10, status: 'Available' };

export const test = base.extend({
  ui: async ({ page }, use) => {
    const calls = [];
    const overrides = new Map();
    const unknown = [];
    const syntheticToken = randomUUID();
    const syntheticRefresh = randomUUID();
    let stations = [station];
    const api = {
      calls,
      respond(path, body, status = 200) { overrides.set(path, { body, status }); },
      failNetwork(path) { overrides.set(path, { abort: true }); },
      setStations(value) { stations = value; },
      async session(role = 'driver', path = role === 'driver' ? '/driver-dashboard' : '/dashboard') {
        const user = identities[role];
        const origin = new URL(test.info().project.use.baseURL || test.info().config.use?.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100').origin;
        // Origin-scoped cookies/storage prevent identities leaking to third parties.
        await page.context().addInitScript(({ user, origin, syntheticToken }) => {
          if (location.origin !== origin || sessionStorage.getItem('ui-initialized')) return;
          localStorage.setItem('evnexus_auth_token', syntheticToken);
          localStorage.setItem('evnexus_auth_user', JSON.stringify(user));
          sessionStorage.setItem('ui-initialized', '1');
        }, { user, origin, syntheticToken });
        await page.goto(path);
      },
    };
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (!path.startsWith('/api/')) {
        if (/openstreetmap|nominatim|unsplash|fonts\.google/.test(url.hostname)) return route.abort();
        return route.continue();
      }
      calls.push({ path, method: route.request().method(), body: route.request().postDataJSON() });
      const override = overrides.get(path);
      if (override?.abort) return route.abort('failed');
      if (override) return route.fulfill({ status: override.status, json: override.body });
      let data;
      if (path === '/api/auth/driver/login' || path === '/api/auth/company/login') {
        const role = path.includes('/company/') ? 'company' : 'driver';
        data = { ...identities[role], accessToken: syntheticToken, refreshToken: syntheticRefresh };
      } else if (path === '/api/auth/driver/profile' || path === '/api/driver/profile') data = identities.driver;
      else if (path === '/api/auth/company/profile' || path === '/api/company/profile') data = identities.company;
      else if (path === '/api/payment/wallet') data = { balance: 1500, currency: 'LKR', driverId: 'DRV-UI' };
      else if (path === '/api/driver/stations/nearby') data = stations.map(s => ({ station: s, distanceKm: 0.2 }));
      else if (path === '/api/map/company/stations' || path === '/api/company/stations') {
        if (route.request().method() === 'POST') {
          const created = { ...station, ...route.request().postDataJSON(), id: `STN-${randomUUID()}` };
          stations = [...stations, created];
          return route.fulfill({ status: 201, json: { success: true, id: created.id, code: 'UI-CODE' } });
        }
        data = stations;
      } else if (/\/chargers\/[^/]+\/qr$/.test(path)) data = { system: 'EVNEXUS', companyId: 'TEN-UI', stationId: station.id, chargerId: charger.id };
      else if (/\/chargers$/.test(path)) {
        if (route.request().method() === 'POST') return route.fulfill({ status: 201, json: { success: true, id: charger.id } });
        data = [charger];
      } else if (path === '/api/map/driver/sessions/active') data = null;
      else if (/\/dashboard\/company\/[^/]+$/.test(path)) data = { totalRevenue: 1200, completedTransactions: 2, totalEnergyKwh: 40, totalRevenueToday: 100 };
      else if (/\/forecast$/.test(path)) data = { forecast: [], model: 'UI fixture' };
      else if (/\/billing$/.test(path)) data = { plan: 'Test' };
      else if (path === '/api/auth/logout') data = null;
      else if (/\/(history|transactions|revenue-trend|stations|active|vehicles|staff)$/.test(path)) data = [];
      else {
        unknown.push(`${route.request().method()} ${path}`);
        return route.fulfill({ status: 501, json: { success: false, message: `Unconfigured UI fixture: ${path}` } });
      }
      return route.fulfill({ json: { success: true, data } });
    });
    await use(api);
    expect(unknown, 'Every API dependency must be explicitly configured; UI tests must never contact a real API').toEqual([]);
  },
});
export { expect };

export async function navigate(page, label) {
  const menu = page.getByRole('button', { name: 'Open navigation menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: /portal navigation/ }).getByRole('button', { name: label, exact: true }).click();
}
