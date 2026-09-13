import React, { useState, useEffect } from 'react';
import { History, Zap, Clock, CreditCard, RefreshCw, FileText, X } from 'lucide-react';
import { getSessionHistory } from '../../services/api';

export default function SessionHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSessionHistory();
      setHistory(res?.data || []);
    } catch (err) {
      setError(err.message || 'Error loading history');
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
              <History size={18} color="var(--primary-600)" />
              Charging Session History
            </h3>
            <p className="dash-card-subtitle">Review your past charging sessions and receipts.</p>
          </div>
          <button 
            type="button" 
            className="submit-btn" 
            onClick={fetchHistory}
            style={{ width: 'auto', margin: 0, padding: '0.45rem 1rem', fontSize: '0.8rem' }}
          >
            {loading ? <RefreshCw size={14} className="spinner" /> : <RefreshCw size={14} />}
            <span>Refresh</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={32} className="spinner" color="var(--primary-400)" />
            </div>
          ) : error ? (
            <div className="alert alert-danger" style={{ margin: '1rem' }}>{error}</div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
              <p>You have no completed charging sessions yet.</p>
            </div>
          ) : (
            <div className="dash-table-wrapper">
              <table className="dash-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Station</th>
                  <th>Duration</th>
                  <th>Energy</th>
                  <th>Total Cost</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const s = item.session;
                  const start = new Date(s.startTime.endsWith('Z') ? s.startTime : s.startTime + 'Z');
                  const end = new Date(s.endTime.endsWith('Z') ? s.endTime : s.endTime + 'Z');
                  const durationMs = end - start;
                  const mins = Math.floor(durationMs / 60000);
                  const hrs = Math.floor(mins / 60);
                  const remMins = mins % 60;
                  
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          {start.toLocaleDateString()} {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </td>
                      <td>
                        <strong>{item.stationName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.address}</div>
                      </td>
                      <td>{hrs > 0 ? `${hrs}h ` : ''}{remMins}m</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#15803d', fontWeight: 600 }}>
                          <Zap size={14} /> {s.energyConsumedKwh.toFixed(2)} kWh
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0369a1', fontWeight: 700 }}>
                          <CreditCard size={14} /> ${s.totalCost.toFixed(2)}
                        </div>
                      </td>
                      <td>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => setSelectedReceipt(item)}
                        >
                          View
                        </button>
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

      {selectedReceipt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3><FileText size={18} /> Charging Receipt</h3>
              <button className="icon-btn" onClick={() => setSelectedReceipt(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: '0 0 0.5rem 0', color: '#10b981', fontSize: '2rem' }}>
                  ${selectedReceipt.session.totalCost.toFixed(2)}
                </h2>
                <span className="badge badge-success">Payment Successful</span>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Station</span>
                  <span style={{ fontWeight: 600 }}>{selectedReceipt.stationName}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Start Time</span>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(selectedReceipt.session.startTime.endsWith('Z') ? selectedReceipt.session.startTime : selectedReceipt.session.startTime + 'Z').toLocaleString()}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>End Time</span>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(selectedReceipt.session.endTime.endsWith('Z') ? selectedReceipt.session.endTime : selectedReceipt.session.endTime + 'Z').toLocaleString()}
                  </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Energy Delivered</span>
                  <span style={{ fontWeight: 600 }}>{selectedReceipt.session.energyConsumedKwh.toFixed(2)} kWh</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Session ID</span>
                  <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>{selectedReceipt.session.id.split('-')[0]}</span>
                </div>
              </div>
              
              <button type="button" className="hero-btn" onClick={() => setSelectedReceipt(null)} style={{ width: '100%', justifyContent: 'center' }}>
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
