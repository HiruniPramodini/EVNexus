import { getAuthToken } from './api';

async function get(path, params = {}) {
  const url = new URL(`${DASHBOARD_URL}/api/dashboard-reports/${path}`);
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.append(k, v); });
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

// SCRUM-130: default range = last 7 days
export function lastSevenDays() {
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(new Date(Date.now() - 6 * 86400000)), to: fmt(new Date()) };
}

export const getTrafficTable = (from, to) => get('traffic', { from, to });
export const getPriceList = () => get('prices');
export const getLocationTable = () => get('locations');
export const getDailyUsage = (from, to) => get('daily-usage', { from, to });
export const getDriverSummary = (from, to) => get('driver-summary', { from, to });

// SCRUM-131: build and download a CSV file in the browser
export function downloadCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
