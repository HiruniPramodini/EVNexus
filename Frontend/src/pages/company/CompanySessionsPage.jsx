import React, { useState, useEffect } from 'react';
import { Activity, Zap, RefreshCw, AlertCircle, Clock, BatteryCharging, DollarSign } from 'lucide-react';
import { getActiveCompanySessions } from '../../services/api';

export default function CompanySessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 15000); // 15s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getActiveCompanySessions();
      setSessions(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load active sessions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* KPI Overview */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-amber">
            <Activity size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Concurrent Active Charging</div>
            <div className="kpi-value">{sessions.length}</div>
            <div className="kpi-subtext">Drivers currently plugged in</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <Zap size={24} />
          </div>
          <div className="kpi-body">
            <div className="kpi-label">Active Power Delivery</div>
            <div className="kpi-value">{(sessions.length * 50).toFixed(0)} <span style={{ fontSize: '0.9rem' }}>kW</span></div>
            <div className="kpi-subtext">Estimated grid draw</div>
          </div>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title">
              <Activity size={18} color="#d97706" />
              Real-Time Station Charging Telemetry
            </h3>
            <p className="dash-card-subtitle">
              Live monitor of active charging sessions happening across your corporate charging network.
            </p>
          </div>
          <button
            type="button"
            className="submit-btn"
            onClick={fetchSessions}
            style={{ width: 'auto', margin: 0, padding: '0.45rem 1rem', fontSize: '0.8rem', background: '#d97706' }}
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Refresh Live</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading && sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <RefreshCw size={32} className="spinner" color="#d97706" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Listening for active charging hardware...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger" style={{ margin: '1rem' }}>{error}</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <Zap size={48} style={{ opacity: 0.2, margin: '0 auto 1rem', display: 'block' }} />
              <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>No active charging sessions at the moment</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                When drivers unlock and start charging at any of your stations, live telemetry will appear here.
              </p>
            </div>
          ) : (
            <div className="dash-table-wrapper">
              <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>Session & Station</th>
                    <th>Dispenser Code</th>
                    <th>Start Time (UTC)</th>
                    <th>Elapsed Duration</th>
                    <th>Current Accrual</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((item) => {
                    const s = item.session;
                    const startTimeStr = s.startTime?.endsWith('Z') ? s.startTime : s.startTime + 'Z';
                    const start = new Date(startTimeStr);
                    const now = new Date();
                    const durationMs = Math.max(0, now - start);
                    const mins = Math.floor(durationMs / 60000);
                    const hrs = Math.floor(mins / 60);
                    const remMins = mins % 60;
                    const estimatedCost = (mins * 0.5 * 0.45).toFixed(2);

                    return (
                      <tr key={s.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.stationName}</div>
                          <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                            ID: {s.id.substring(0, 8)}...
                          </code>
                        </td>
                        <td>
                          <span className="badge badge-warning" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {item.chargingCode}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={14} color="var(--text-muted)" />
                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: 'var(--primary-700)' }}>
                            <BatteryCharging size={15} className="spinner" />
                            <span>{hrs > 0 ? `${hrs}h ` : ''}{remMins}m</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#0369a1' }}>
                            ${estimatedCost} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(est.)</span>
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-success">
                            ● In Progress
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
