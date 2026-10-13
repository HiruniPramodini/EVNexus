import React, { useState } from 'react';
import { CalendarDays, RefreshCw, Download } from 'lucide-react';
import { useReport } from '../../hooks/useReport';
import { getMonthlyReport } from '../../services/dashboardApi';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function MonthlyReportPage() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1); // default = last completed month
  const [ym, setYm] = useState({ year: prev.getFullYear(), month: prev.getMonth() + 1 });
  const { data, loading, error } = useReport(() => getMonthlyReport(ym.year, ym.month), [ym.year, ym.month]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const exportCsv = () => {
    if (!data) return;
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = ['Station,Sessions,EnergyDeliveredKwh,Revenue',
      ...data.stations.map((s) => `${q(s.stationName)},${s.sessions},${Number(s.energyKwh).toFixed(2)},${Number(s.revenue).toFixed(2)}`),
      `Total,${data.totalSessions},${Number(data.totalEnergyKwh).toFixed(2)},${Number(data.totalRevenue).toFixed(2)}`];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `monthly-report_${ym.year}-${String(ym.month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h3 className="dash-card-title"><CalendarDays size={18} color="#7c3aed" /> Monthly Report</h3>
          <p className="dash-card-subtitle">Sessions, energy delivered and revenue per station for a month.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Month</label>
          <select className="form-input" value={ym.month} onChange={(e) => setYm({ ...ym, month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Year</label>
          <select className="form-input" value={ym.year} onChange={(e) => setYm({ ...ym, year: Number(e.target.value) })}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!data || loading}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="spinner" size={28} /></div>
      ) : data && (
        <>
          {!data.isComplete && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>This month is not finished yet, so the numbers are partial.</div>}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div className="card" style={{ flex: 1, minWidth: 160, padding: '1rem' }}><div className="text-caption">Sessions</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.totalSessions}</div></div>
            <div className="card" style={{ flex: 1, minWidth: 160, padding: '1rem' }}><div className="text-caption">Energy</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{Number(data.totalEnergyKwh).toFixed(2)} kWh</div></div>
            <div className="card" style={{ flex: 1, minWidth: 160, padding: '1rem' }}><div className="text-caption">Revenue</div><div style={{ fontSize: '1.5rem', fontWeight: 700 }}>${Number(data.totalRevenue).toFixed(2)}</div></div>
          </div>
          <div className="dash-table-wrapper">
            <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead><tr><th>Station</th><th>Sessions</th><th>Energy (kWh)</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.stations.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No activity in this month.</td></tr>}
                {data.stations.map((s) => (
                  <tr key={s.stationId}>
                    <td><strong>{s.stationName}</strong></td><td>{s.sessions}</td>
                    <td>{Number(s.energyKwh).toFixed(2)}</td><td>${Number(s.revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}