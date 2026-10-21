import { getAuthToken } from './api';

const BASE = import.meta.env.VITE_DASHBOARD_API_URL || 'http://localhost:5100';

async function request(path, params = {}) {
  const token = await getAuthToken();
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();

  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json())?.message || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

const authFetch = async (path, params = {}) => {
  const token = await getAuthToken();
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json())?.message || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res;
};

const tzOffset = () => -new Date().getTimezoneOffset(); // minutes east of UTC (Sri Lanka = 330)

export const getDailyUsageReport = (from, to) =>
  request('/api/company/reports/daily-usage', { from, to });

export const getStationTraffic = (from, to) =>
  request('/api/company/analytics/station-traffic', { from, to });

export const getHourlyUsage = (from, to, stationId) =>
  request('/api/company/analytics/hourly', { from, to, stationId, tzOffset: tzOffset() });

export const getMonthlyReport = (year, month) =>
  request('/api/company/analytics/monthly', { year, month });

export const getPeakHours = (stationId) =>
  request('/api/company/analytics/peak-hours', { stationId, tzOffset: tzOffset() });

export const getDemandForecast = (stationId) =>
  request('/api/company/analytics/forecast', { stationId });

export async function downloadUsageCsv(from, to, stationId) {
  const res = await authFetch('/api/company/analytics/export.csv', { from, to, stationId });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usage-report_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
