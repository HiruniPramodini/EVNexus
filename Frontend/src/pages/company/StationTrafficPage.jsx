import React, { useMemo, useState } from 'react';
import { Trophy, RefreshCw, ArrowUpDown } from 'lucide-react';
import DateRangeFilter, { defaultRange } from '../../components/DateRangeFilter';
import { useReport, useStations } from '../../hooks/useReport';
import { getStationTraffic } from '../../services/dashboardApi';

export default function StationTrafficPage() {
  const [range, setRange] = useState(defaultRange());
  const [sort, setSort] = useState({ key: 'sessions', dir: 'desc' });
  const { stations } = useStations();
  const { data, loading, error } = useReport(() => getStationTraffic(range.from, range.to), [range.from, range.to]);

  const rows = useMemo(() => {
    const byId = new Map((data || []).map((r) => [String(r.stationId), r]));
    const merged = stations.map((s) => {
      const r = byId.get(String(s.id));
      byId.delete(String(s.id));
      return { id: s.id, name: s.name, sessions: r?.sessions || 0, energyKwh: r?.energyKwh || 0, revenue: r?.revenue || 0 };
    });
    byId.forEach((r) => merged.push({ id: r.stationId, name: r.stationName, sessions: r.sessions, energyKwh: r.energyKwh, revenue: r.revenue }));
    return merged;
  }, [data, stations]);

  const ranking = useMemo(
    () => [...rows].sort((a, b) => b.sessions - a.sessions || b.energyKwh - a.energyKwh),
    [rows]
  );
  const sorted = useMemo(() => {
    const m = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) =>
      typeof a[sort.key] === 'string' ? m * a[sort.key].localeCompare(b[sort.key]) : m * (a[sort.key] - b[sort.key]));
  }, [rows, sort]);

  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const Th = ({ k, children }) => (
    <th style={{ cursor: 'pointer' }} onClick={() => toggle(k)}>
      {children} <ArrowUpDown size={12} style={{ opacity: sort.key === k ? 1 : 0.3 }} />
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title"><Trophy size={18} color="#d97706" /> Highest Traffic Stations</h3>
            <p className="dash-card-subtitle">Ranked by total sessions in the selected period.</p>
          </div>
        </div>
        <DateRangeFilter value={range} onApply={setRange} />
        {error && <div className="alert alert-danger">{error}</div>}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw className="spinner" size={24} /></div>
        ) : ranking.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No stations found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ranking.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', borderRadius: 8,
                border: i === 0 && r.sessions > 0 ? '2px solid #d97706' : '1px solid var(--border-subtle)',
                background: i === 0 && r.sessions > 0 ? '#fffbeb' : '#fff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <strong style={{ width: 28 }}>#{i + 1}</strong>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  {i === 0 && r.sessions > 0 && <span className="badge badge-warning"><Trophy size={11} /> Top station</span>}
                </div>
                <span>{r.sessions} sessions · {Number(r.energyKwh).toFixed(2)} kWh</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title">Charging Point Traffic</h3>
            <p className="dash-card-subtitle">Click a column header to sort.</p>
          </div>
        </div>
        <div className="dash-table-wrapper">
          <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr><Th k="name">Station</Th><Th k="sessions">Sessions</Th><Th k="energyKwh">Energy (kWh)</Th><Th k="revenue">Revenue</Th></tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data.</td></tr>}
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.sessions}</td>
                  <td style={{ color: '#059669', fontWeight: 600 }}>{Number(r.energyKwh).toFixed(2)}</td>
                  <td style={{ color: '#0369a1', fontWeight: 600 }}>${Number(r.revenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}