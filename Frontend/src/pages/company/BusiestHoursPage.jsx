import React, { useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import DateRangeFilter, { defaultRange } from '../../components/DateRangeFilter';
import { useReport, useStations } from '../../hooks/useReport';
import { getHourlyUsage } from '../../services/dashboardApi';

const label = (h) => `${String(h).padStart(2, '0')}:00`;

export default function BusiestHoursPage() {
  const [range, setRange] = useState(defaultRange());
  const [stationId, setStationId] = useState('');
  const { stations } = useStations();
  const { data, loading, error } = useReport(
    () => getHourlyUsage(range.from, range.to, stationId || undefined),
    [range.from, range.to, stationId]
  );

  const busiest = data?.busiestHours || [];
  const chart = (data?.hours || []).map((h) => ({ ...h, name: label(h.hour) }));

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h3 className="dash-card-title"><Clock size={18} color="#0284c7" /> Busiest Time of Day</h3>
          <p className="dash-card-subtitle">Charging sessions grouped by start hour (your local time).</p>
        </div>
      </div>

      <DateRangeFilter value={range} onApply={setRange}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Station</label>
          <select className="form-input" value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="">All stations</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </DateRangeFilter>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><RefreshCw className="spinner" size={28} /></div>
      ) : data?.totalSessions === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No sessions in this period.</div>
      ) : (
        <>
          <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
            Busiest hour{busiest.length > 1 ? 's' : ''}: <strong>{busiest.map(label).join(', ')}</strong> ({data.totalSessions} sessions total)
          </div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" interval={1} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="sessions" name="Sessions">
                  {chart.map((c) => <Cell key={c.hour} fill={busiest.includes(c.hour) ? '#d97706' : '#38bdf8'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="dash-table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead><tr><th>Hour</th><th>Sessions</th></tr></thead>
              <tbody>
                {chart.filter((c) => c.sessions > 0).map((c) => (
                  <tr key={c.hour} style={busiest.includes(c.hour) ? { background: '#fffbeb', fontWeight: 700 } : undefined}>
                    <td>{c.name}</td><td>{c.sessions}</td>
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