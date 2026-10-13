import React, { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, LineChart, Line, Legend
} from 'recharts';
import { useReport, useStations } from '../../hooks/useReport';
import { getPeakHours, getDemandForecast } from '../../services/dashboardApi';

const label = (h) => `${String(h).padStart(2, '0')}:00`;

const Loader = () => (
  <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw className="spinner" size={24} /></div>
);

export default function AiInsightsPage() {
  const [stationId, setStationId] = useState('');
  const [metric, setMetric] = useState('sessions');
  const { stations } = useStations();
  const sid = stationId || undefined;

  const peak = useReport(() => getPeakHours(sid), [stationId]);
  const fc = useReport(() => getDemandForecast(sid), [stationId]);

  const peakData = (peak.data?.hours || []).map((h) => ({ ...h, name: label(h.hour) }));

  const key = metric === 'sessions' ? 'sessions' : 'energyKwh';
  const lineData = fc.data && !fc.data.insufficientData
    ? [
        ...fc.data.history.map((d) => ({ date: d.date.slice(5), actual: d[key] })),
        ...fc.data.forecast.map((d) => ({ date: d.date.slice(5), predicted: d[key] }))
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title"><Sparkles size={18} color="#7c3aed" /> AI Insights</h3>
            <p className="dash-card-subtitle">Predicted peak hours and demand forecast.</p>
          </div>
          <select className="form-input" style={{ width: 'auto' }} value={stationId}
            onChange={(e) => setStationId(e.target.value)}>
            <option value="">All stations (company-wide)</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      /* 165 + 167: peak hours chart */
      <div className="dash-card">
        <h4 style={{ marginTop: 0 }}>Predicted peak hours</h4>
        {peak.error && <div className="alert alert-danger">{peak.error}</div>}
        {peak.loading ? <Loader /> : peak.data?.insufficientData ? (
          <div className="alert alert-warning">
            {peak.data.message} ({peak.data.sessionsAnalysed} sessions so far)
          </div>
        ) : peak.data && (
          <>
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              Expected peak hour(s): <strong>{peak.data.peakHours.map(label).join(', ')}</strong>. {peak.data.message}
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={peakData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={1} tick={{ fontSize: 11 }} />
                  <YAxis label={{ value: 'Sessions / day', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="expectedSessionsPerDay" name="Expected sessions / day">
                    {peakData.map((c) => <Cell key={c.hour} fill={c.isPeak ? '#dc2626' : '#93c5fd'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-caption">Red bars = predicted peak hours. Blue = normal demand.</div>
          </>
        )}
      </div>

      /* 166: demand forecast */
      <div className="dash-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h4 style={{ margin: 0 }}>Demand forecast (next 7 days)</h4>
          <select className="form-input" style={{ width: 'auto' }} value={metric}
            onChange={(e) => setMetric(e.target.value)}>
            <option value="sessions">Sessions</option>
            <option value="energy">Energy (kWh)</option>
          </select>
        </div>
        {fc.error && <div className="alert alert-danger">{fc.error}</div>}
        {fc.loading ? <Loader /> : fc.data?.insufficientData ? (
          <div className="alert alert-warning">{fc.data.message}</div>
        ) : fc.data && (
          <>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#0284c7" dot={false} />
                  <Line type="monotone" dataKey="predicted" name="Predicted" stroke="#dc2626" strokeDasharray="6 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <details style={{ marginTop: '0.8rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How is this calculated? ({fc.data.method})</summary>
              <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {fc.data.assumptions.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </details>
          </>
        )}
      </div>
    </div>
  );
}