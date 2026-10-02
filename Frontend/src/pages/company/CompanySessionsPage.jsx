import React, { useState, useEffect } from 'react';
import { Activity, Zap, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { getActiveCompanySessions, getAuthToken } from '../../services/api';

export default function CompanySessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSessions();
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
      <div className="dash-card">
        <div className="dash-card-header">
          <div>
            <h3 className="dash-card-title">
              <Activity size={18} color="#d97706" />
              Live Charging Sessions
            </h3>
            <p className="dash-card-subtitle">Real-time view of drivers currently charging at your stations.</p>
          </div>
          <button 
            type="button" 
            className="submit-btn" 
            onClick={fetchSessions}
            style={{ width: 'auto', margin: 0, padding: '0.45rem 1rem', fontSize: '0.8rem', background: '#d97706' }}
          >
            <RefreshCw size={14} className={loading ? 'spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="spinner" color="#d97706" />
            </div>
          ) : error ? (
            <div className="alert alert-danger" style={{ margin: '1rem' }}>{error}</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Zap size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>No active charging sessions at the moment.</p>
            </div>
          ) : (
            <div className="dash-table-wrapper">
              <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Station</th>
                  <th>Code</th>
                  <th>Started At (UTC)</th>
                  <th>Current Cost</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((item) => {
                  const s = item.session;
                  const start = new Date(s.startTime + 'Z');
                  const now = new Date();
                  const durationMs = now - start;
                  const mins = Math.floor(durationMs / 60000);
                  
                  return (
                    <tr key={s.id}>
                      <td><code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{s.id.substring(0,8)}...</code></td>
                      <td><strong>{item.stationName}</strong></td>
                      <td><span className="badge badge-warning">{item.chargingCode}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          {start.toLocaleTimeString()} ({mins}m ago)
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0369a1' }}>
                          ${(mins * 0.5 * 0.5).toFixed(2)} (est.)
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
