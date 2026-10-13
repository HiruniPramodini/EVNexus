import React, { useState, useEffect, useCallback } from 'react';
import { Zap, CreditCard, Clock, Hash, RefreshCw } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import { getDriverSummary } from '../../services/dashboardApi';
import { defaultRange, isInvalidRange } from '../../utils/dateRange';

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 180, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <Icon size={16} /> {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '0.4rem' }}>{value}</div>
    </div>
  );
}

const fmtDuration = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${Math.round(m % 60)}m` : `${Math.round(m)}m`);
const toDate = (s) => new Date(s.endsWith('Z') ? s : s + 'Z');

export default function ChargingSummaryPage() {
  const [range, setRange] = useState(defaultRange());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (isInvalidRange(range)) return;
    if (!silent) setLoading(true);
    setError(null);
    try { setData(await getDriverSummary(range.from, range.to)); }
    catch (e) { setData(null); setError(e.message || 'Failed to load summary.'); }
    finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // Widgets refresh after each completed session (poll every 30s)
  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title">Charging History Summary</h3>
            <p className="dash-card-subtitle">Your completed charging sessions in the selected period.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => load()}>
            <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh
          </button>
        </div>
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw size={32} className="spinner" /></div>
      )}

      {data && (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <StatCard icon={Hash} label="Completed sessions" value={data.totalSessions} />
            <StatCard icon={Zap} label="Energy consumed" value={`${Number(data.totalEnergyKwh).toFixed(2)} kWh`} />
            <StatCard icon={CreditCard} label="Total spent" value={`$${Number(data.totalSpent).toFixed(2)}`} />
            <StatCard icon={Clock} label="Avg. duration" value={fmtDuration(data.avgSessionMinutes)} />
          </div>

          <div className="dash-card">
            <h3 className="dash-card-title" style={{ marginBottom: '1rem' }}>Recent sessions</h3>
            {data.recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Zap size={40} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                <p>No completed charging sessions in this period.</p>
              </div>
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead><tr><th>Date</th><th>Station</th><th>Duration</th><th>Energy</th><th>Cost</th></tr></thead>
                  <tbody>
                    {data.recent.map(r => (
                      <tr key={r.id}>
                        <td>{toDate(r.startUtc).toLocaleString()}</td>
                        <td>{r.stationName}</td>
                        <td>{fmtDuration(r.durationMinutes)}</td>
                        <td>{Number(r.energyKwh).toFixed(2)} kWh</td>
                        <td>${Number(r.cost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}