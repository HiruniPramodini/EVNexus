import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, RefreshCw, Zap, DollarSign, Receipt, Download } from 'lucide-react';
import { getDailyUsageReport, downloadUsageCsv } from '../../services/dashboardApi';

const toYmd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6); // last 7 days
  return { from: toYmd(from), to: toYmd(to) };
};

export default function DailyUsageReportPage() {
  const [range, setRange] = useState(defaultRange());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rangeError, setRangeError] = useState(null);

  const load = useCallback(async (r) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getDailyUsageReport(r.from, r.to));
    } catch (err) {
      setError(err.message || 'Failed to load daily usage report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); /* eslint-disable-next-line */ }, []);

  const apply = () => {
    if (!range.from || !range.to) return setRangeError('Please select both dates.');
    if (range.to < range.from) return setRangeError('End date cannot be earlier than start date.');
    setRangeError(null);
    load(range);
  };

  const reset = () => {
    const r = defaultRange();
    setRange(r);
    setRangeError(null);
    load(r);
  };

  const exportCsv = async () => {
    if (!range.from || !range.to) return setRangeError('Please select both dates.');
    if (range.to < range.from) return setRangeError('End date cannot be earlier than start date.');
    setRangeError(null);
    try {
      await downloadUsageCsv(range.from, range.to);
    } catch (e) {
      setError(e.message || 'Failed to export CSV.');
    }
  };

  const stat = (icon, label, value, color) => (
    <div className="card" style={{ flex: 1, minWidth: 180, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color, fontSize: '0.8rem', fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.3rem' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title"><BarChart3 size={18} color="#0284c7" /> Daily Usage Report</h3>
            <p className="dash-card-subtitle">Sessions, energy delivered and revenue per day for your stations.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">From</label>
            <input type="date" className="form-input" value={range.from} max={range.to || undefined}
              onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">To</label>
            <input type="date" className="form-input" value={range.to} min={range.from || undefined}
              onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </div>
          <button type="button" className="submit-btn" style={{ width: 'auto', margin: 0 }} onClick={apply}>Apply</button>
          <button type="button" className="btn-secondary" onClick={reset}>Last 7 days</button>
          <button type="button" className="btn-secondary" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </button>
          <button type="button" className="btn-secondary" onClick={() => load(range)} title="Refresh">
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
          </button>
        </div>

        {rangeError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{rangeError}</div>}
        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

        {loading && !report ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw size={28} className="spinner" /></div>
        ) : report && (
          <>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
              {stat(<BarChart3 size={14} />, 'Total Sessions', report.totalSessions, '#0284c7')}
              {stat(<Zap size={14} />, 'Energy Delivered', `${Number(report.totalEnergyKwh).toFixed(2)} kWh`, '#059669')}
              {stat(<DollarSign size={14} />, 'Revenue', `$${Number(report.totalRevenue).toFixed(2)}`, '#d97706')}
              {stat(<Receipt size={14} />, 'Transactions', report.totalTransactions, '#7c3aed')}
            </div>

            {report.totalSessions === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '0.5rem 0 1rem' }}>
                No charging sessions in this period.
              </div>
            )}

            <div className="dash-table-wrapper">
              <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>Date</th><th>Sessions</th><th>Energy (kWh)</th><th>Revenue</th><th>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {report.days.map((d) => (
                    <tr key={d.date}>
                      <td>{new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td>{d.sessions}</td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{Number(d.energyKwh).toFixed(2)}</td>
                      <td style={{ color: '#0369a1', fontWeight: 600 }}>${Number(d.revenue).toFixed(2)}</td>
                      <td>{d.transactions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}